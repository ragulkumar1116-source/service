const Database = {
  isFirebaseEnabled: false,
  syncListeners: [],
  isSyncing: false,
  
  init() {
    this.isFirebaseEnabled = AuthService.isFirebaseEnabled;
    
    // Seed default data if LocalStorage is empty
    if (!localStorage.getItem('sm_customers')) {
      const mock = Utils.getMockData();
      localStorage.setItem('sm_customers', JSON.stringify(mock.customers));
      localStorage.setItem('sm_instruments', JSON.stringify(mock.instruments));
      localStorage.setItem('sm_tickets', JSON.stringify(mock.tickets));
      localStorage.setItem('sm_visits', JSON.stringify(mock.visits));
      localStorage.setItem('sm_followups', JSON.stringify(mock.followups));
    }
    
    // Initialize empty sync queue if not exists
    if (!localStorage.getItem('sm_sync_queue')) {
      localStorage.setItem('sm_sync_queue', JSON.stringify([]));
    }

    // Set up network listeners
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));

    // Initial check
    setTimeout(() => {
      this.sync();
    }, 1000);
  },

  handleNetworkChange(online) {
    console.log(`[Database] Network status: ${online ? 'Online' : 'Offline'}`);
    this.notifySyncStatus();
    if (online) {
      this.sync();
    }
  },

  notifySyncStatus() {
    const queue = this.getSyncQueue();
    const status = {
      online: navigator.onLine,
      pendingCount: queue.length,
      firebase: this.isFirebaseEnabled,
      syncing: this.isSyncing
    };
    this.syncListeners.forEach(cb => cb(status));
  },

  onSyncChange(callback) {
    this.syncListeners.push(callback);
    this.notifySyncStatus();
    return () => {
      this.syncListeners = this.syncListeners.filter(cb => cb !== callback);
    };
  },

  getSyncQueue() {
    return JSON.parse(localStorage.getItem('sm_sync_queue') || '[]');
  },

  saveSyncQueue(queue) {
    localStorage.setItem('sm_sync_queue', JSON.stringify(queue));
    this.notifySyncStatus();
  },

  addToQueue(table, action, id, data) {
    const queue = this.getSyncQueue();
    // Prevent duplicate operations on the same ID in the queue by updating it
    const existingIndex = queue.findIndex(item => item.table === table && item.id === id && item.action === action);
    if (existingIndex > -1) {
      queue[existingIndex].data = data;
      queue[existingIndex].timestamp = Date.now();
    } else {
      queue.push({
        table,
        action,
        id,
        data,
        timestamp: Date.now()
      });
    }
    this.saveSyncQueue(queue);
    this.sync();
  },

  // Read Local Data
  getAll(table) {
    return JSON.parse(localStorage.getItem(`sm_${table}`) || '[]');
  },

  getById(table, id) {
    const list = this.getAll(table);
    return list.find(item => item.id === id) || null;
  },

  // Write Local Data and Queue Sync
  save(table, item) {
    const list = this.getAll(table);
    let isNew = false;
    
    if (!item.id) {
      item.id = table.substring(0, 4) + '-' + Math.random().toString(36).substr(2, 9);
      item.createdAt = new Date().toISOString();
      isNew = true;
    }
    
    item.updatedAt = new Date().toISOString();

    const idx = list.findIndex(x => x.id === item.id);
    if (idx > -1) {
      list[idx] = item;
    } else {
      list.push(item);
    }

    localStorage.setItem(`sm_${table}`, JSON.stringify(list));
    
    // Add to sync log
    this.addToQueue(table, isNew ? 'CREATE' : 'UPDATE', item.id, item);
    return item;
  },

  delete(table, id) {
    let list = this.getAll(table);
    list = list.filter(item => item.id !== id);
    localStorage.setItem(`sm_${table}`, JSON.stringify(list));
    this.addToQueue(table, 'DELETE', id, null);
  },

  // Bulk overwrite local cache (used during settings sync or imports)
  bulkOverwrite(table, list) {
    localStorage.setItem(`sm_${table}`, JSON.stringify(list));
    this.notifySyncStatus();
  },

  // Sync Offline Mutations to Firebase
  async sync() {
    if (this.isSyncing) return;
    if (!navigator.onLine || !this.isFirebaseEnabled) {
      this.notifySyncStatus();
      return;
    }

    this.isSyncing = true;
    this.notifySyncStatus();

    try {
      const queue = this.getSyncQueue();
      if (queue.length === 0) {
        // Queue is empty, pull latest data from Firebase to merge
        await this.pullFromFirebase();
        this.isSyncing = false;
        this.notifySyncStatus();
        return;
      }

      console.log(`[Database] Starting sync: ${queue.length} mutations pending.`);

      // Process mutations sequentially
      for (const item of [...queue]) {
        const { table, action, id, data } = item;
        const refPath = `${table}/${id}`;

        if (action === 'CREATE' || action === 'UPDATE') {
          await firebase.database().ref(refPath).set(data);
        } else if (action === 'DELETE') {
          await firebase.database().ref(refPath).remove();
        }

        // Dequeue
        const currentQueue = this.getSyncQueue();
        const updatedQueue = currentQueue.filter(q => !(q.table === table && q.id === id && q.action === action));
        this.saveSyncQueue(updatedQueue);
      }

      console.log("[Database] Sync queue completed successfully. Pulling fresh copy.");
      await this.pullFromFirebase();

    } catch (err) {
      console.error("[Database] Sync execution failed: ", err);
    } finally {
      this.isSyncing = false;
      this.notifySyncStatus();
    }
  },

  // Pull latest updates from Firebase and overwrite local cache
  async pullFromFirebase() {
    if (!this.isFirebaseEnabled || !navigator.onLine) return;
    
    try {
      const tables = ['customers', 'instruments', 'tickets', 'visits', 'followups'];
      for (const table of tables) {
        const snapshot = await firebase.database().ref(table).once('value');
        const dbData = snapshot.val();
        if (dbData) {
          // Firebase returns objects mapped by keys. Convert back to array
          const list = Object.keys(dbData).map(key => {
            const val = dbData[key];
            if (typeof val === 'object' && val !== null) {
              val.id = key;
            }
            return val;
          });
          localStorage.setItem(`sm_${table}`, JSON.stringify(list));
        } else {
          // If node doesn't exist, we don't clear the local storage if we already have seeded data,
          // instead we push the seeded data to Firebase if queue is somehow empty
          const localList = this.getAll(table);
          if (localList.length > 0) {
            console.log(`[Database] Seeding Firebase node: ${table}`);
            const seedObj = {};
            localList.forEach(item => {
              seedObj[item.id] = item;
            });
            await firebase.database().ref(table).set(seedObj);
          }
        }
      }
      console.log("[Database] Pulled and merged all tables from Firebase Realtime Database.");
    } catch (error) {
      console.warn("[Database] Could not pull from Firebase: ", error);
    }
  },

  // Setup Firebase dynamically from configuration view
  async setupFirebase(config) {
    try {
      if (firebase.apps.length > 0) {
        // App is already initialized, we delete it to re-initialize
        await Promise.all(firebase.apps.map(app => app.delete()));
      }
      
      firebase.initializeApp(config);
      this.isFirebaseEnabled = true;
      AuthService.isFirebaseEnabled = true;
      AuthService.init(); // re-init auth
      
      // Save settings to LocalStorage
      localStorage.setItem('sm_firebase_config', JSON.stringify(config));
      
      // Run sync immediately
      this.sync();
      return true;
    } catch (err) {
      console.error("Firebase dynamic setup failed:", err);
      throw err;
    }
  },

  // Clear Firebase settings and fallback to mock mode
  disconnectFirebase() {
    localStorage.removeItem('sm_firebase_config');
    this.isFirebaseEnabled = false;
    AuthService.isFirebaseEnabled = false;
    AuthService.currentUser = null;
    localStorage.removeItem('sm_session_user');
    
    // Re-initialize AuthService & Database to trigger mock flows
    AuthService.init();
    this.init();
  }
};

window.Database = Database;
Database.init();
