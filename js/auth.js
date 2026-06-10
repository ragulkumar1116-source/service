const AuthService = {
  currentUser: null,
  isFirebaseEnabled: false,
  authListeners: [],

  init() {
    // Check if Firebase settings exist in localStorage
    const fbConfig = localStorage.getItem('sm_firebase_config');
    if (fbConfig) {
      try {
        const config = JSON.parse(fbConfig);
        if (config && config.apiKey && config.databaseURL) {
          firebase.initializeApp(config);
          this.isFirebaseEnabled = true;
          console.log("Firebase Auth initialized successfully.");
        }
      } catch (err) {
        console.error("Failed to parse Firebase config, falling back to mock authentication.", err);
      }
    }

    if (this.isFirebaseEnabled) {
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          // Resolve role from Firebase Realtime Database
          firebase.database().ref('users/' + user.uid).once('value')
            .then((snapshot) => {
              const userData = snapshot.val();
              this.currentUser = {
                uid: user.uid,
                email: user.email,
                name: userData?.name || user.email.split('@')[0],
                role: userData?.role || 'engineer' // Default role
              };
              this.notifyListeners();
            })
            .catch(() => {
              // Fallback if DB check fails
              this.currentUser = {
                uid: user.uid,
                email: user.email,
                name: user.email.split('@')[0],
                role: 'engineer'
              };
              this.notifyListeners();
            });
        } else {
          this.currentUser = null;
          this.notifyListeners();
        }
      });
    } else {
      // Mock Authentication Session check
      const savedUser = localStorage.getItem('sm_session_user');
      if (savedUser) {
        this.currentUser = JSON.parse(savedUser);
      }
      setTimeout(() => this.notifyListeners(), 100);
    }
  },

  login(email, password) {
    if (this.isFirebaseEnabled) {
      return firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
          // User is handled by onAuthStateChanged
          return userCredential.user;
        });
    } else {
      // Mock Authentication Flow
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const cleanEmail = email.trim().toLowerCase();
          if (cleanEmail === 'admin@smartmanager.com' && password === 'admin123') {
            this.currentUser = {
              uid: 'mock-admin',
              email: cleanEmail,
              name: 'Admin Supervisor',
              role: 'admin'
            };
            localStorage.setItem('sm_session_user', JSON.stringify(this.currentUser));
            this.notifyListeners();
            resolve(this.currentUser);
          } else if (cleanEmail === 'engineer@smartmanager.com' && password === 'engineer123') {
            this.currentUser = {
              uid: 'mock-engineer',
              email: cleanEmail,
              name: 'Alex Mercer (Engineer)',
              role: 'engineer'
            };
            localStorage.setItem('sm_session_user', JSON.stringify(this.currentUser));
            this.notifyListeners();
            resolve(this.currentUser);
          } else {
            reject(new Error("Invalid credentials. Try admin@smartmanager.com (pw: admin123) or engineer@smartmanager.com (pw: engineer123)."));
          }
        }, 500);
      });
    }
  },

  logout() {
    if (this.isFirebaseEnabled) {
      return firebase.auth().signOut().then(() => {
        this.currentUser = null;
        this.notifyListeners();
      });
    } else {
      return new Promise((resolve) => {
        this.currentUser = null;
        localStorage.removeItem('sm_session_user');
        this.notifyListeners();
        resolve();
      });
    }
  },

  // Event listners for Auth changes
  onAuthChange(callback) {
    this.authListeners.push(callback);
    // Trigger immediate call for initial state
    callback(this.currentUser);
    return () => {
      this.authListeners = this.authListeners.filter(l => l !== callback);
    };
  },

  notifyListeners() {
    this.authListeners.forEach(callback => callback(this.currentUser));
  },

  getUserRole() {
    return this.currentUser ? this.currentUser.role : null;
  },

  isAdmin() {
    return this.getUserRole() === 'admin';
  },

  isLoggedIn() {
    return !!this.currentUser;
  }
};

window.AuthService = AuthService;
AuthService.init();
