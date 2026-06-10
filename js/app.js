// Core Controller - Service Engineer Smart Manager
const App = {
  activeView: 'login',
  selectedTicket: null,
  selectedCustomer: null,
  currentTicketFilter: 'open',
  activeCustSubTab: 'clients',
  activeReportSubTab: 'reports',

  init() {
    console.log("App Initializing...");

    // Setup Routing
    window.addEventListener('hashchange', () => this.handleRouting());
    
    // Setup Listeners for database changes and auth updates
    AuthService.onAuthChange((user) => this.handleAuthState(user));
    Database.onSyncChange((status) => this.handleSyncState(status));

    // Form Submissions bindings
    this.bindEvents();
    
    // Load theme setting
    const lightTheme = localStorage.getItem('sm_light_theme') === 'true';
    document.getElementById('settings-theme-toggle').checked = lightTheme;
    this.toggleTheme(lightTheme);
  },

  bindEvents() {
    // Login Form
    document.getElementById('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const remember = document.getElementById('login-remember').checked;
      
      const btn = document.getElementById('btn-login-submit');
      btn.disabled = true;
      btn.innerText = "Signing in...";

      try {
        await AuthService.login(email, password);
        // Successful login will trigger handleAuthState
      } catch (err) {
        alert(err.message);
        btn.disabled = false;
        btn.innerText = "Login";
      }
    });

    // Create Service Request (Ticket)
    document.getElementById('form-ticket').addEventListener('submit', (e) => {
      e.preventDefault();
      const custId = document.getElementById('tkt-cust-id').value;
      const instId = document.getElementById('tkt-inst-id').value;
      
      const cust = Database.getById('customers', custId);
      const inst = Database.getById('instruments', instId);

      const ticket = {
        ticketNumber: Utils.generateTicketNumber(),
        customerId: custId,
        customerName: cust.name,
        instrumentId: instId,
        instrumentName: `${inst.name} (SN: ${inst.serialNumber})`,
        requestType: document.getElementById('tkt-type').value,
        description: document.getElementById('tkt-desc').value,
        requestDate: Utils.formatDate(new Date()),
        priority: document.getElementById('tkt-priority').value,
        assignedEngineerId: AuthService.currentUser?.uid || 'eng-1',
        assignedEngineerName: AuthService.currentUser?.name || 'Engineer',
        status: 'New',
        reminderFrequency: document.getElementById('tkt-reminder').value
      };

      Database.save('tickets', ticket);
      this.closeModal('modal-ticket');
      document.getElementById('form-ticket').reset();
      this.render();
      alert(`Service Request ${ticket.ticketNumber} created successfully!`);
    });

    // Create Visit Entry
    document.getElementById('form-visit').addEventListener('submit', (e) => {
      e.preventDefault();
      
      const ticketId = document.getElementById('visit-tkt-id').value;
      const custId = document.getElementById('visit-cust-id').value;
      const instId = document.getElementById('visit-inst-id').value;
      
      const cust = Database.getById('customers', custId);
      const inst = Database.getById('instruments', instId);
      
      const visit = {
        ticketId: ticketId || 'none',
        customerId: custId,
        customerName: cust.name,
        instrumentId: instId,
        instrumentName: `${inst.name} (SN: ${inst.serialNumber})`,
        visitType: document.getElementById('visit-type').value,
        visitDate: document.getElementById('visit-date').value,
        workPerformed: document.getElementById('visit-performed').value,
        observations: document.getElementById('visit-obs').value,
        correctiveActions: document.getElementById('visit-corrective').value,
        sparePartsUsed: document.getElementById('visit-spares').value,
        systemStatus: document.getElementById('visit-status').value,
        nextVisitDate: document.getElementById('visit-next-date').value || '',
        remarks: document.getElementById('visit-remarks').value
      };

      Database.save('visits', visit);

      // Handle linked ticket update
      if (ticketId) {
        const ticket = Database.getById('tickets', ticketId);
        if (ticket) {
          const closeTkt = document.getElementById('visit-close-ticket').checked;
          ticket.status = closeTkt ? 'Closed' : 'Completed';
          Database.save('tickets', ticket);
        }
      }

      // Automatically create a follow-up task if next visit date exists
      if (visit.nextVisitDate) {
        let followType = "Customer callback";
        if (visit.visitType === 'Calibration Visit') followType = "Calibration scheduling";
        if (visit.visitType === 'AMC Visit') followType = "AMC renewal";
        if (visit.workPerformed.toLowerCase().includes('spare')) followType = "Spare replacement";
        
        const followup = {
          type: followType,
          customerId: custId,
          customerName: cust.name,
          description: `Scheduled follow-up for next visit: ${visit.remarks || 'Check system status'}.`,
          dueDate: visit.nextVisitDate,
          status: 'pending'
        };
        Database.save('followups', followup);
      }

      this.closeModal('modal-visit');
      document.getElementById('form-visit').reset();
      this.render();
      alert("Visit log and service records saved successfully!");
    });

    // Create / Edit Customer
    document.getElementById('form-customer').addEventListener('submit', (e) => {
      e.preventDefault();
      
      const customer = {
        id: document.getElementById('cust-id').value || undefined,
        name: document.getElementById('cust-name').value,
        companyName: document.getElementById('cust-company').value,
        address: document.getElementById('cust-address').value,
        contactPerson: document.getElementById('cust-person').value,
        mobile: document.getElementById('cust-mobile').value,
        email: document.getElementById('cust-email').value,
        gstNumber: document.getElementById('cust-gst').value,
        notes: document.getElementById('cust-notes').value
      };

      Database.save('customers', customer);
      this.closeModal('modal-customer');
      document.getElementById('form-customer').reset();
      this.render();
      alert("Customer database updated successfully!");
    });

    // Create Instrument
    document.getElementById('form-instrument').addEventListener('submit', (e) => {
      e.preventDefault();
      const custId = document.getElementById('inst-cust-mapping').value;
      const cust = Database.getById('customers', custId);

      const instrument = {
        customerId: custId,
        customerName: cust.name,
        name: document.getElementById('inst-name').value,
        modelNumber: document.getElementById('inst-model').value,
        serialNumber: document.getElementById('inst-serial').value,
        installationDate: document.getElementById('inst-install-date').value,
        warrantyExpiryDate: document.getElementById('inst-warranty-date').value,
        amcStartDate: document.getElementById('inst-amc-start').value || '',
        amcEndDate: document.getElementById('inst-amc-end').value || '',
        calibrationDueDate: document.getElementById('inst-calib-date').value || ''
      };

      Database.save('instruments', instrument);
      this.closeModal('modal-instrument');
      document.getElementById('form-instrument').reset();
      this.render();
      alert("Instrument mapped successfully!");
    });

    // Search bar event listeners
    document.getElementById('ticket-search').addEventListener('input', () => this.renderTickets());
    document.getElementById('visit-search').addEventListener('input', () => this.renderVisits());
    document.getElementById('customer-search').addEventListener('input', () => this.renderCustomers());
    document.getElementById('instrument-search').addEventListener('input', () => this.renderInstruments());

    // Connect Firebase Form
    document.getElementById('form-firebase-config').addEventListener('submit', async (e) => {
      e.preventDefault();
      const config = {
        apiKey: document.getElementById('fb-api-key').value,
        databaseURL: document.getElementById('fb-db-url').value,
        authDomain: document.getElementById('fb-auth-domain').value,
        projectId: document.getElementById('fb-project-id').value
      };
      
      try {
        await Database.setupFirebase(config);
        alert("Connected to Firebase Realtime Database. Syncing completed!");
      } catch (err) {
        alert("Failed to connect: " + err.message);
      }
    });
  },

  handleAuthState(user) {
    const header = document.getElementById('app-header');
    const nav = document.getElementById('app-nav');
    const fab = document.getElementById('quick-fab');
    
    if (user) {
      document.getElementById('header-user-name').innerText = user.name;
      document.getElementById('settings-role-select').value = user.role;
      
      header.style.display = 'flex';
      nav.style.display = 'flex';
      fab.style.display = 'flex';
      
      // Auto redirect to dashboard if on login view
      if (this.activeView === 'login') {
        location.hash = '#dashboard';
      } else {
        this.handleRouting();
      }
    } else {
      header.style.display = 'none';
      nav.style.display = 'none';
      fab.style.display = 'none';
      location.hash = '#login';
      this.switchView('login');
    }
  },

  handleSyncState(status) {
    const indicator = document.getElementById('sync-indicator');
    const txt = document.getElementById('sync-text');
    
    if (!status.online) {
      indicator.className = 'network-badge offline';
      txt.innerText = 'Offline';
    } else if (status.syncing) {
      indicator.className = 'network-badge';
      indicator.querySelector('span').classList.add('spinning');
      txt.innerText = `Syncing...`;
    } else {
      indicator.className = 'network-badge';
      indicator.querySelector('span').classList.remove('spinning');
      if (status.firebase) {
        txt.innerText = status.pendingCount > 0 ? `${status.pendingCount} pending` : 'Synced';
      } else {
        txt.innerText = 'Local Mode';
      }
    }
  },

  handleRouting() {
    const hash = location.hash || '#dashboard';
    
    if (!AuthService.isLoggedIn() && hash !== '#login') {
      location.hash = '#login';
      return;
    }

    const viewName = hash.replace('#', '');
    this.switchView(viewName);
  },

  switchView(viewId) {
    // Hide active view
    const views = document.querySelectorAll('.view');
    views.forEach(v => v.classList.remove('active'));

    const target = document.getElementById(`view-${viewId}`);
    if (target) {
      target.classList.add('active');
      this.activeView = viewId;
    }

    // Highlight Navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('href') === `#${viewId}`) {
        item.classList.add('active');
      }
    });

    // Close any open modals when navigating
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));

    // Render contents of current view
    this.render();
  },

  render() {
    this.updateNotificationBadgeCount();
    
    if (this.activeView === 'dashboard') {
      this.renderDashboard();
    } else if (this.activeView === 'tickets') {
      this.renderTickets();
    } else if (this.activeView === 'visits') {
      this.renderVisits();
    } else if (this.activeView === 'customers') {
      if (this.activeCustSubTab === 'clients') {
        this.renderCustomers();
      } else {
        this.renderInstruments();
      }
    } else if (this.activeView === 'reports') {
      this.renderSettingsFirebaseFields();
    }
  },

  updateNotificationBadgeCount() {
    const tickets = Database.getAll('tickets');
    const pendingCount = tickets.filter(t => t.status !== 'Completed' && t.status !== 'Closed').length;
    const badge = document.getElementById('badge-pending-tickets');
    if (pendingCount > 0) {
      badge.innerText = pendingCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  },

  // Renders the Settings Input fields if Firebase configuration exists in LocalStorage
  renderSettingsFirebaseFields() {
    const fbConfig = localStorage.getItem('sm_firebase_config');
    if (fbConfig) {
      try {
        const config = JSON.parse(fbConfig);
        document.getElementById('fb-api-key').value = config.apiKey || '';
        document.getElementById('fb-db-url').value = config.databaseURL || '';
        document.getElementById('fb-auth-domain').value = config.authDomain || '';
        document.getElementById('fb-project-id').value = config.projectId || '';
      } catch (e) {}
    }
  },

  // ---------------- DASHBOARD LOGIC ----------------
  renderDashboard() {
    const customers = Database.getAll('customers');
    const instruments = Database.getAll('instruments');
    const tickets = Database.getAll('tickets');
    const visits = Database.getAll('visits');
    const followups = Database.getAll('followups');
    const todayStr = Utils.formatDate(new Date());

    // Counters calculation
    document.getElementById('stat-customers').innerText = customers.length;
    document.getElementById('stat-instruments').innerText = instruments.length;
    
    const pendingTickets = tickets.filter(t => t.status !== 'Completed' && t.status !== 'Closed');
    document.getElementById('stat-pending-requests').innerText = pendingTickets.length;
    
    const openComplaints = tickets.filter(t => t.requestType === 'Breakdown' && t.status !== 'Completed' && t.status !== 'Closed');
    document.getElementById('stat-open-complaints').innerText = openComplaints.length;
    
    // Today's Visits: logged today + scheduled for today
    const visitsToday = visits.filter(v => v.visitDate === todayStr).length;
    document.getElementById('stat-today-visits').innerText = visitsToday;

    // Completed this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const startOfMonthStr = Utils.formatDate(startOfMonth);
    const monthVisits = visits.filter(v => v.visitDate >= startOfMonthStr).length;
    document.getElementById('stat-month-visits').innerText = monthVisits;

    // Overdue Follow-ups
    const overdueFollows = followups.filter(f => f.status === 'pending' && f.dueDate < todayStr);
    document.getElementById('stat-overdue-followups').innerText = overdueFollows.length;

    // AMC due (within 30 days)
    const amcDueCount = instruments.filter(inst => {
      if (!inst.amcEndDate) return false;
      const days = Utils.daysBetween(todayStr, inst.amcEndDate);
      return days >= -10 && days <= 30; // expired within last 10 days, or due in next 30 days
    }).length;
    document.getElementById('stat-amc-due').innerText = amcDueCount;

    // Calibration Due (within 30 days or overdue)
    const calibDueCount = instruments.filter(inst => {
      if (!inst.calibrationDueDate) return false;
      const days = Utils.daysBetween(todayStr, inst.calibrationDueDate);
      return days <= 30;
    }).length;
    document.getElementById('stat-calib-due').innerText = calibDueCount;

    // Warranty Expired
    const warrantyAlerts = instruments.filter(inst => inst.warrantyExpiryDate && inst.warrantyExpiryDate <= todayStr).length;
    document.getElementById('stat-warranty-alerts').innerText = warrantyAlerts;

    // BUILD SYSTEM ALERTS & NOTIFICATIONS
    const alertsContainer = document.getElementById('dashboard-notifications');
    alertsContainer.innerHTML = '';
    
    let notificationCount = 0;

    // 1. Red Overdue Tickets Alert (> 3 days old and active)
    tickets.forEach(tkt => {
      if (tkt.status !== 'Completed' && tkt.status !== 'Closed') {
        const days = Utils.daysBetween(tkt.requestDate, todayStr);
        if (days > 3) {
          notificationCount++;
          alertsContainer.appendChild(this.createNotificationDOM(
            'red',
            `Critical: ${tkt.ticketNumber} is Overdue!`,
            `Active for ${days} days: "${tkt.description.substring(0, 40)}..."`,
            () => this.openTicketDetailModal(tkt.id)
          ));
        }
      }
    });

    // 2. Red / Orange Instrument Alerts (Calibration or AMC overdue)
    instruments.forEach(inst => {
      if (inst.calibrationDueDate) {
        const calDays = Utils.daysBetween(todayStr, inst.calibrationDueDate);
        if (calDays < 0) {
          notificationCount++;
          alertsContainer.appendChild(this.createNotificationDOM(
            'red',
            `Calibration OVERDUE: ${inst.name}`,
            `Serial: ${inst.serialNumber} calibration was due on ${Utils.formatDisplayDate(inst.calibrationDueDate)}.`,
            () => this.openCustomerDetailModal(inst.customerId)
          ));
        } else if (calDays === 0) {
          notificationCount++;
          alertsContainer.appendChild(this.createNotificationDOM(
            'orange',
            `Calibration Due TODAY: ${inst.name}`,
            `Serial: ${inst.serialNumber} requires calibration today.`,
            () => this.openCustomerDetailModal(inst.customerId)
          ));
        } else if (calDays > 0 && calDays <= 30) {
          notificationCount++;
          alertsContainer.appendChild(this.createNotificationDOM(
            'yellow',
            `Calibration due soon: ${inst.name}`,
            `In ${calDays} days (due ${Utils.formatDisplayDate(inst.calibrationDueDate)}).`,
            () => this.openCustomerDetailModal(inst.customerId)
          ));
        }
      }

      if (inst.amcEndDate) {
        const amcDays = Utils.daysBetween(todayStr, inst.amcEndDate);
        if (amcDays < 0) {
          notificationCount++;
          alertsContainer.appendChild(this.createNotificationDOM(
            'red',
            `AMC EXPIRED: ${inst.name}`,
            `Contract for ${inst.customerName} expired on ${Utils.formatDisplayDate(inst.amcEndDate)}.`,
            () => this.openCustomerDetailModal(inst.customerId)
          ));
        } else if (amcDays > 0 && amcDays <= 30) {
          notificationCount++;
          alertsContainer.appendChild(this.createNotificationDOM(
            'yellow',
            `AMC Contract Renewal Due: ${inst.name}`,
            `Expires in ${amcDays} days on ${Utils.formatDisplayDate(inst.amcEndDate)}.`,
            () => this.openCustomerDetailModal(inst.customerId)
          ));
        }
      }

      if (inst.warrantyExpiryDate) {
        const warDays = Utils.daysBetween(todayStr, inst.warrantyExpiryDate);
        if (warDays < 0 && warDays > -60) { // Notify if expired recently
          notificationCount++;
          alertsContainer.appendChild(this.createNotificationDOM(
            'yellow',
            `Warranty Expired: ${inst.name}`,
            `Expired on ${Utils.formatDisplayDate(inst.warrantyExpiryDate)}. AMC renewal recommended.`,
            () => this.openCustomerDetailModal(inst.customerId)
          ));
        }
      }
    });

    // 3. Waiting customer responses (Yellow)
    tickets.forEach(tkt => {
      if (tkt.status === 'Waiting for Customer Reply') {
        notificationCount++;
        alertsContainer.appendChild(this.createNotificationDOM(
          'yellow',
          `Awaiting Client Reply: ${tkt.ticketNumber}`,
          `Customer: ${tkt.customerName}. Problem: ${tkt.description.substring(0, 30)}...`,
          () => this.openTicketDetailModal(tkt.id)
        ));
      }
    });

    // 4. Overdue Follow-up Tasks (Red)
    overdueFollows.forEach(fol => {
      notificationCount++;
      alertsContainer.appendChild(this.createNotificationDOM(
        'red',
        `Overdue Task: ${fol.type}`,
        `Due ${Utils.formatDisplayDate(fol.dueDate)} for ${fol.customerName}`,
        () => this.completeFollowup(fol.id)
      ));
    });

    // Green Normal Status if no notifications
    if (notificationCount === 0) {
      alertsContainer.innerHTML = `
        <div class="notification-item green">
          <div class="notification-desc">
            <strong>System Normal</strong>
            <span class="meta">No overdue calls, calibrations, or AMC renewals found!</span>
          </div>
        </div>
      `;
    }

    // Render Dashboard Tasks / Followups
    const followsList = document.getElementById('dashboard-followups');
    followsList.innerHTML = '';
    
    const todaysFollows = followups.filter(f => f.status === 'pending' && f.dueDate <= todayStr);
    
    if (todaysFollows.length === 0) {
      followsList.innerHTML = `<p class="muted-text" style="text-align: center; padding: 12px 0;">No tasks or follow-ups scheduled for today.</p>`;
    } else {
      todaysFollows.forEach(fol => {
        const el = document.createElement('div');
        el.className = 'card';
        el.style.margin = '0';
        el.style.padding = '10px 12px';
        el.style.display = 'flex';
        el.style.justifyContent = 'space-between';
        el.style.alignItems = 'center';
        
        const isOverdue = fol.dueDate < todayStr;
        
        el.innerHTML = `
          <div style="font-size: 0.8rem;">
            <strong style="color: ${isOverdue ? 'var(--color-red)' : 'inherit'};">${fol.type}</strong>
            <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px;">${fol.customerName}</div>
            <div class="muted-text" style="font-size: 0.7rem; margin-top: 4px;">${fol.description}</div>
          </div>
          <button class="btn btn-secondary btn-sm" style="width: auto; padding: 4px 8px;" onclick="App.completeFollowup('${fol.id}')">Done</button>
        `;
        followsList.appendChild(el);
      });
    }
  },

  createNotificationDOM(color, title, message, clickHandler) {
    const div = document.createElement('div');
    div.className = `notification-item ${color}`;
    div.style.cursor = 'pointer';
    div.onclick = clickHandler;
    div.innerHTML = `
      <div class="notification-desc">
        <strong>${title}</strong>
        <span class="meta">${message}</span>
      </div>
      <span class="notification-close">➔</span>
    `;
    return div;
  },

  completeFollowup(id) {
    const fol = Database.getById('followups', id);
    if (fol) {
      fol.status = 'completed';
      Database.save('followups', fol);
      this.render();
      alert("Follow-up task marked as Completed!");
    }
  },

  // ---------------- TICKET LIST LOGIC ----------------
  filterTickets(filter) {
    this.currentTicketFilter = filter;
    document.querySelectorAll('#view-tickets .tab-btn').forEach(btn => btn.classList.remove('active'));
    
    if (filter === 'open') document.getElementById('ticket-tab-open').classList.add('active');
    else if (filter === 'closed') document.getElementById('ticket-tab-closed').classList.add('active');
    else document.getElementById('ticket-tab-all').classList.add('active');
    
    this.renderTickets();
  },

  renderTickets() {
    const container = document.getElementById('tickets-list');
    container.innerHTML = '';
    
    const tickets = Database.getAll('tickets');
    const searchVal = document.getElementById('ticket-search').value.toLowerCase();
    
    const filtered = tickets.filter(t => {
      // Search logic
      const matchesSearch = t.ticketNumber.toLowerCase().includes(searchVal) || 
                            t.customerName.toLowerCase().includes(searchVal) || 
                            t.instrumentName.toLowerCase().includes(searchVal) || 
                            t.description.toLowerCase().includes(searchVal);
      
      if (!matchesSearch) return false;
      
      // Tab filter
      if (this.currentTicketFilter === 'open') {
        return t.status !== 'Completed' && t.status !== 'Closed';
      } else if (this.currentTicketFilter === 'closed') {
        return t.status === 'Completed' || t.status === 'Closed';
      }
      
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<p class="muted-text" style="text-align: center; padding: 24px 0;">No service requests matching filters.</p>`;
      return;
    }

    filtered.forEach(tkt => {
      const el = document.createElement('div');
      el.className = 'ticket-item';
      el.style.cursor = 'pointer';
      el.onclick = () => this.openTicketDetailModal(tkt.id);
      
      el.innerHTML = `
        <div class="ticket-header">
          <span class="ticket-id">${tkt.ticketNumber}</span>
          <span class="badge ${tkt.priority.toLowerCase()}">${tkt.priority}</span>
        </div>
        <div style="font-size: 0.85rem; font-weight: 600;">${tkt.customerName}</div>
        <div class="muted-text" style="font-size: 0.75rem;">${tkt.instrumentName}</div>
        <p style="font-size: 0.8rem; line-height: 1.3; color: #cbd5e1; margin-top: 4px;">${tkt.description.substring(0, 80)}${tkt.description.length > 80 ? '...' : ''}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
          <span class="badge status-${tkt.status.toLowerCase().replace(/ /g, '_')}">${tkt.status}</span>
          <span class="muted-text" style="font-size: 0.7rem; font-family: var(--font-mono);">${Utils.formatDisplayDate(tkt.requestDate)}</span>
        </div>
      `;
      container.appendChild(el);
    });
  },

  // ---------------- VISITS HISTORY LOGIC ----------------
  renderVisits() {
    const container = document.getElementById('visits-list');
    container.innerHTML = '';
    
    const visits = Database.getAll('visits');
    const searchVal = document.getElementById('visit-search').value.toLowerCase();
    
    const filtered = visits.filter(v => {
      return v.customerName.toLowerCase().includes(searchVal) ||
             v.instrumentName.toLowerCase().includes(searchVal) ||
             v.workPerformed.toLowerCase().includes(searchVal) ||
             v.sparePartsUsed.toLowerCase().includes(searchVal) ||
             v.visitType.toLowerCase().includes(searchVal);
    });

    if (filtered.length === 0) {
      container.innerHTML = `<p class="muted-text" style="text-align: center; padding: 24px 0;">No logged service visits found.</p>`;
      return;
    }

    // Sort: Latest visits first
    filtered.sort((a,b) => new Date(b.visitDate) - new Date(a.visitDate));

    filtered.forEach(visit => {
      const el = document.createElement('div');
      el.className = 'ticket-item';
      
      const sparesText = visit.sparePartsUsed ? `<strong>Spares Used:</strong> ${visit.sparePartsUsed}` : 'No spares used';
      const statusColor = visit.systemStatus === 'Operational' ? 'var(--color-green)' : (visit.systemStatus === 'Partially Operational' ? 'var(--color-yellow)' : 'var(--color-red)');

      el.innerHTML = `
        <div class="ticket-header">
          <span class="info-pill" style="color: var(--primary); background-color: var(--primary-glow);">${visit.visitType}</span>
          <span class="muted-text" style="font-family: var(--font-mono); font-size: 0.75rem;">${Utils.formatDisplayDate(visit.visitDate)}</span>
        </div>
        <div style="font-size: 0.85rem; font-weight: 600;">${visit.customerName}</div>
        <div class="muted-text" style="font-size: 0.75rem;">${visit.instrumentName}</div>
        <div style="font-size: 0.8rem; margin-top: 6px; line-height: 1.35; color: #e2e8f0;">
          <div><strong>Work:</strong> ${visit.workPerformed}</div>
          <div style="margin-top: 2px;"><strong>Obs:</strong> ${visit.observations}</div>
          <div style="margin-top: 2px; color: #94a3b8; font-size: 0.75rem;">${sparesText}</div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; border-top: 1px dashed var(--border-color); padding-top: 6px;">
          <span style="font-size: 0.75rem; font-weight: 500; color: ${statusColor};">● System ${visit.systemStatus}</span>
          <span class="muted-text" style="font-size: 0.7rem;">Rep: ${visit.remarks || 'None'}</span>
        </div>
      `;
      container.appendChild(el);
    });
  },

  // ---------------- CUSTOMERS & INSTRUMENTS LOGIC ----------------
  switchCustSubTab(subTab) {
    this.activeCustSubTab = subTab;
    document.getElementById('cust-tab-list').classList.remove('active');
    document.getElementById('cust-tab-instruments').classList.remove('active');
    
    if (subTab === 'clients') {
      document.getElementById('cust-tab-list').classList.add('active');
      document.getElementById('subtab-clients').style.display = 'block';
      document.getElementById('subtab-instruments').style.display = 'none';
      this.renderCustomers();
    } else {
      document.getElementById('cust-tab-instruments').classList.add('active');
      document.getElementById('subtab-clients').style.display = 'none';
      document.getElementById('subtab-instruments').style.display = 'block';
      this.renderInstruments();
    }
  },

  renderCustomers() {
    const container = document.getElementById('customers-list');
    container.innerHTML = '';
    
    const customers = Database.getAll('customers');
    const searchVal = document.getElementById('customer-search').value.toLowerCase();
    
    const filtered = customers.filter(c => {
      return c.name.toLowerCase().includes(searchVal) ||
             c.companyName.toLowerCase().includes(searchVal) ||
             c.contactPerson.toLowerCase().includes(searchVal) ||
             c.address.toLowerCase().includes(searchVal);
    });

    if (filtered.length === 0) {
      container.innerHTML = `<p class="muted-text" style="text-align: center; padding: 24px 0;">No customers found.</p>`;
      return;
    }

    filtered.forEach(cust => {
      const el = document.createElement('div');
      el.className = 'card';
      el.style.cursor = 'pointer';
      el.onclick = () => this.openCustomerDetailModal(cust.id);
      
      el.innerHTML = `
        <div style="font-weight: 700; font-size: 0.95rem; color: #f8fafc;">${cust.name}</div>
        <div style="font-size: 0.8rem; color: var(--primary); font-weight: 500; margin-top: 2px;">${cust.companyName}</div>
        <div class="muted-text" style="font-size: 0.75rem; margin-top: 6px; display: flex; align-items: center; gap: 4px;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px; height:12px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          ${cust.address.substring(0, 50)}${cust.address.length > 50 ? '...' : ''}
        </div>
        <div style="margin-top: 10px; display: flex; justify-content: space-between; font-size: 0.75rem;">
          <span><strong>Contact:</strong> ${cust.contactPerson}</span>
          <span style="color: #94a3b8;">${cust.mobile}</span>
        </div>
      `;
      container.appendChild(el);
    });
  },

  renderInstruments() {
    const container = document.getElementById('instruments-list');
    container.innerHTML = '';
    
    const instruments = Database.getAll('instruments');
    const searchVal = document.getElementById('instrument-search').value.toLowerCase();
    
    const filtered = instruments.filter(inst => {
      return inst.name.toLowerCase().includes(searchVal) ||
             inst.serialNumber.toLowerCase().includes(searchVal) ||
             inst.modelNumber.toLowerCase().includes(searchVal) ||
             inst.customerName.toLowerCase().includes(searchVal);
    });

    if (filtered.length === 0) {
      container.innerHTML = `<p class="muted-text" style="text-align: center; padding: 24px 0;">No instruments mapped.</p>`;
      return;
    }

    filtered.forEach(inst => {
      const el = document.createElement('div');
      el.className = 'card';
      
      const isAmcActive = inst.amcEndDate && inst.amcEndDate >= Utils.formatDate(new Date());
      const amcStatusText = isAmcActive ? 'Active AMC' : 'AMC Lapsed/None';
      const amcColor = isAmcActive ? 'var(--color-green)' : 'var(--color-red)';

      el.innerHTML = `
        <div class="flex-row-spaced">
          <strong style="font-size: 0.9rem; color: #f8fafc;">${inst.name}</strong>
          <span class="info-pill" style="color: ${amcColor}; border-color: ${amcColor};">${amcStatusText}</span>
        </div>
        <div style="font-size: 0.75rem; color: #94a3b8; font-family: var(--font-mono);">Model: ${inst.modelNumber} | S/N: ${inst.serialNumber}</div>
        <div style="font-size: 0.8rem; margin-top: 6px; font-weight: 600;">Client: ${inst.customerName}</div>
        
        <div style="margin-top: 10px; padding-top: 6px; border-top: 1px dashed var(--border-color); display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.7rem;">
          <div>Calibration Due: <strong style="color: var(--primary);">${Utils.formatDisplayDate(inst.calibrationDueDate)}</strong></div>
          <div>Warranty Expire: <strong>${Utils.formatDisplayDate(inst.warrantyExpiryDate)}</strong></div>
        </div>
      `;
      container.appendChild(el);
    });
  },

  // ---------------- MODAL MANAGEMENT ----------------
  openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
  },

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
  },

  // Dynamic selector population
  populateCustomerSelects(selectIds) {
    const customers = Database.getAll('customers');
    selectIds.forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = '<option value="">-- Select Customer --</option>';
      customers.forEach(cust => {
        select.innerHTML += `<option value="${cust.id}">${cust.name} (${cust.companyName})</option>`;
      });
    });
  },

  populateInstrumentSelect(selectId, customerId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">-- Select Instrument --</option>';
    
    if (!customerId) return;
    
    const instruments = Database.getAll('instruments');
    const filtered = instruments.filter(inst => inst.customerId === customerId);
    
    filtered.forEach(inst => {
      select.innerHTML += `<option value="${inst.id}">${inst.name} [S/N: ${inst.serialNumber}]</option>`;
    });
  },

  openCreateTicketModal() {
    this.openModal('modal-ticket');
    document.getElementById('ticket-modal-title').innerText = "New Service Request";
    document.getElementById('form-ticket').style.display = 'block';
    document.getElementById('ticket-modal-detail').style.display = 'none';
    
    this.populateCustomerSelects(['tkt-cust-id']);
    document.getElementById('tkt-inst-id').innerHTML = '<option value="">-- Select Customer First --</option>';
  },

  handleTicketCustomerChange(custId) {
    this.populateInstrumentSelect('tkt-inst-id', custId);
  },

  openTicketDetailModal(ticketId) {
    this.selectedTicket = Database.getById('tickets', ticketId);
    if (!this.selectedTicket) return;

    this.openModal('modal-ticket');
    document.getElementById('ticket-modal-title').innerText = `Ticket Details`;
    document.getElementById('form-ticket').style.display = 'none';
    
    const detailsPanel = document.getElementById('ticket-modal-detail');
    detailsPanel.style.display = 'block';

    document.getElementById('dtl-tkt-no').innerText = this.selectedTicket.ticketNumber;
    document.getElementById('dtl-tkt-status').innerHTML = `<span class="badge status-${this.selectedTicket.status.toLowerCase().replace(/ /g, '_')}">${this.selectedTicket.status}</span>`;
    document.getElementById('dtl-tkt-priority').innerHTML = `<span class="badge ${this.selectedTicket.priority.toLowerCase()}">${this.selectedTicket.priority}</span>`;
    document.getElementById('dtl-tkt-cust').innerText = this.selectedTicket.customerName;
    document.getElementById('dtl-tkt-inst').innerText = this.selectedTicket.instrumentName;
    document.getElementById('dtl-tkt-type').innerText = this.selectedTicket.requestType;
    document.getElementById('dtl-tkt-date').innerText = Utils.formatDisplayDate(this.selectedTicket.requestDate);
    document.getElementById('dtl-tkt-desc').innerText = `Problem: ${this.selectedTicket.description}`;
    
    document.getElementById('detail-tkt-status-select').value = this.selectedTicket.status;

    // Action button to log visit directly linked
    const btnLogVisit = document.getElementById('btn-dtl-log-visit');
    btnLogVisit.onclick = () => {
      this.closeModal('modal-ticket');
      this.openCreateVisitModal(this.selectedTicket.id);
    };
  },

  updateTicketStatusFromDetail() {
    if (!this.selectedTicket) return;
    const newStatus = document.getElementById('detail-tkt-status-select').value;
    this.selectedTicket.status = newStatus;
    Database.save('tickets', this.selectedTicket);
    this.render();
    document.getElementById('dtl-tkt-status').innerHTML = `<span class="badge status-${newStatus.toLowerCase().replace(/ /g, '_')}">${newStatus}</span>`;
  },

  openCreateVisitModal(linkedTicketId = '') {
    this.openModal('modal-visit');
    
    this.populateCustomerSelects(['visit-cust-id']);
    
    const tktSelect = document.getElementById('visit-tkt-id');
    tktSelect.innerHTML = '<option value="">-- None (General Visit) --</option>';
    
    const tickets = Database.getAll('tickets').filter(t => t.status !== 'Completed' && t.status !== 'Closed');
    tickets.forEach(t => {
      tktSelect.innerHTML += `<option value="${t.id}">${t.ticketNumber} - ${t.customerName}</option>`;
    });

    // Set defaults
    document.getElementById('visit-date').value = Utils.formatDate(new Date());
    document.getElementById('visit-close-ticket').checked = true;

    if (linkedTicketId) {
      const ticket = Database.getById('tickets', linkedTicketId);
      if (ticket) {
        tktSelect.value = linkedTicketId;
        this.handleVisitTicketChange(linkedTicketId);
      }
    } else {
      document.getElementById('visit-inst-id').innerHTML = '<option value="">-- Select Customer First --</option>';
      document.getElementById('visit-close-ticket-group').style.display = 'none';
    }
  },

  handleVisitTicketChange(ticketId) {
    if (!ticketId) {
      document.getElementById('visit-close-ticket-group').style.display = 'none';
      return;
    }

    const ticket = Database.getById('tickets', ticketId);
    if (ticket) {
      document.getElementById('visit-cust-id').value = ticket.customerId;
      this.populateInstrumentSelect('visit-inst-id', ticket.customerId);
      document.getElementById('visit-inst-id').value = ticket.instrumentId;
      
      // Auto prefill visit type based on ticket type
      const vType = document.getElementById('visit-type');
      if (ticket.requestType === 'Breakdown') vType.value = 'Breakdown Visit';
      else if (ticket.requestType === 'Calibration Request') vType.value = 'Calibration Visit';
      else if (ticket.requestType === 'Installation') vType.value = 'Installation Visit';
      else if (ticket.requestType === 'AMC Request') vType.value = 'AMC Visit';

      document.getElementById('visit-close-ticket-group').style.display = 'flex';
    }
  },

  handleVisitCustomerChange(custId) {
    this.populateInstrumentSelect('visit-inst-id', custId);
    document.getElementById('visit-tkt-id').value = '';
    document.getElementById('visit-close-ticket-group').style.display = 'none';
  },

  openCustomerModal() {
    this.openModal('modal-customer');
    document.getElementById('customer-modal-title').innerText = "Create Client Profile";
    document.getElementById('form-customer').style.display = 'block';
    document.getElementById('customer-modal-detail').style.display = 'none';
    document.getElementById('cust-id').value = '';
    document.getElementById('form-customer').reset();
  },

  openCustomerDetailModal(custId) {
    this.selectedCustomer = Database.getById('customers', custId);
    if (!this.selectedCustomer) return;

    this.openModal('modal-customer');
    document.getElementById('customer-modal-title').innerText = this.selectedCustomer.name;
    document.getElementById('form-customer').style.display = 'none';
    
    const detail = document.getElementById('customer-modal-detail');
    detail.style.display = 'block';

    document.getElementById('dtl-cust-comp').innerText = this.selectedCustomer.companyName;
    document.getElementById('dtl-cust-addr').innerText = this.selectedCustomer.address;
    document.getElementById('dtl-cust-person').innerText = this.selectedCustomer.contactPerson;
    document.getElementById('dtl-cust-mobile').innerText = this.selectedCustomer.mobile;
    document.getElementById('dtl-cust-email').innerText = this.selectedCustomer.email;
    document.getElementById('dtl-cust-gst').innerText = this.selectedCustomer.gstNumber || 'N/A';
    document.getElementById('dtl-cust-notes').innerText = this.selectedCustomer.notes || 'No remarks recorded.';

    // Load History Timeline
    const timeline = document.getElementById('customer-history-timeline');
    timeline.innerHTML = '';
    
    const visits = Database.getAll('visits').filter(v => v.customerId === custId);
    const tickets = Database.getAll('tickets').filter(t => t.customerId === custId);

    // Merge logs
    const logs = [];
    visits.forEach(v => logs.push({ type: 'visit', date: v.visitDate, text: `Logged ${v.visitType}: ${v.workPerformed} (Status: ${v.systemStatus})` }));
    tickets.forEach(t => logs.push({ type: 'ticket', date: t.requestDate, text: `Request ticket ${t.ticketNumber} (${t.requestType}): Status: ${t.status} - "${t.description}"` }));

    // Sort by date latest
    logs.sort((a,b) => new Date(b.date) - new Date(a.date));

    if (logs.length === 0) {
      timeline.innerHTML = `<p class="muted-text" style="padding: 10px 0;">No previous history found.</p>`;
    } else {
      logs.forEach(log => {
        timeline.innerHTML += `
          <div class="timeline-item">
            <div class="timeline-date">${Utils.formatDisplayDate(log.date)}</div>
            <div class="timeline-desc">${log.text}</div>
          </div>
        `;
      });
    }
  },

  openInstrumentModal() {
    this.openModal('modal-instrument');
    this.populateCustomerSelects(['inst-cust-mapping']);
    document.getElementById('form-instrument').reset();
    
    // Set default dates
    const today = Utils.formatDate(new Date());
    document.getElementById('inst-install-date').value = today;
    
    // Auto calculate warranty expiry (1 year default)
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 1);
    document.getElementById('inst-warranty-date').value = Utils.formatDate(exp);
  },

  // ---------------- REPORTS SUBTAB & ENGINE ----------------
  switchReportSubTab(sub) {
    this.activeReportSubTab = sub;
    document.getElementById('report-tab-gen').classList.remove('active');
    document.getElementById('report-tab-settings').classList.remove('active');
    
    if (sub === 'reports') {
      document.getElementById('report-tab-gen').classList.add('active');
      document.getElementById('subtab-reports-content').style.display = 'block';
      document.getElementById('subtab-settings-content').style.display = 'none';
    } else {
      document.getElementById('report-tab-settings').classList.add('active');
      document.getElementById('subtab-reports-content').style.display = 'none';
      document.getElementById('subtab-settings-content').style.display = 'block';
      this.renderSettingsFirebaseFields();
    }
  },

  generateReport() {
    const reportType = document.getElementById('report-select-type').value;
    const resultsContainer = document.getElementById('report-results');
    const resultCard = document.getElementById('report-result-card');
    const titleEl = document.getElementById('report-title');
    const exportBtn = document.getElementById('btn-export-report');
    
    resultsContainer.innerHTML = '';
    resultCard.style.display = 'block';
    
    const todayStr = Utils.formatDate(new Date());

    let reportTitle = "";
    let data = [];
    let headers = [];

    if (reportType === 'daily') {
      reportTitle = `Daily Service Summary (${Utils.formatDisplayDate(new Date())})`;
      const visits = Database.getAll('visits').filter(v => v.visitDate === todayStr);
      headers = ['visitDate', 'customerName', 'instrumentName', 'visitType', 'systemStatus', 'workPerformed'];
      data = visits;
      
      if (visits.length === 0) {
        resultsContainer.innerHTML = `<p class="muted-text">No visits logged today.</p>`;
      } else {
        visits.forEach(v => {
          resultsContainer.innerHTML += `
            <div class="report-item">
              <div>
                <strong>${v.customerName}</strong><br>
                <span class="muted-text">${v.instrumentName}</span>
              </div>
              <div style="text-align: right;">
                <span class="badge info-pill" style="color: var(--primary);">${v.visitType}</span><br>
                <span style="font-size: 0.75rem;">Status: ${v.systemStatus}</span>
              </div>
            </div>
          `;
        });
      }
    } else if (reportType === 'monthly') {
      const monthLabel = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
      reportTitle = `Monthly Service Summary (${monthLabel})`;
      
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const startOfMonthStr = Utils.formatDate(startOfMonth);
      
      const visits = Database.getAll('visits').filter(v => v.visitDate >= startOfMonthStr);
      headers = ['visitDate', 'customerName', 'instrumentName', 'visitType', 'systemStatus', 'workPerformed', 'sparePartsUsed'];
      data = visits;

      if (visits.length === 0) {
        resultsContainer.innerHTML = `<p class="muted-text">No visits logged this month.</p>`;
      } else {
        visits.forEach(v => {
          resultsContainer.innerHTML += `
            <div class="report-item">
              <div>
                <strong>${v.customerName}</strong> - <span class="muted-text">${Utils.formatDisplayDate(v.visitDate)}</span><br>
                <span style="font-size: 0.75rem; opacity: 0.8;">${v.instrumentName}</span>
              </div>
              <div style="text-align: right;">
                <span class="badge info-pill">${v.visitType}</span><br>
                <span style="font-size: 0.7rem;">Spares: ${v.sparePartsUsed || 'None'}</span>
              </div>
            </div>
          `;
        });
      }
    } else if (reportType === 'amc') {
      reportTitle = "AMC Contracts Due Report (Next 30 Days)";
      const instruments = Database.getAll('instruments').filter(inst => {
        if (!inst.amcEndDate) return false;
        const days = Utils.daysBetween(todayStr, inst.amcEndDate);
        return days >= -15 && days <= 30; // 15 days expired, 30 days due
      });
      headers = ['customerName', 'name', 'modelNumber', 'serialNumber', 'amcStartDate', 'amcEndDate'];
      data = instruments;

      if (instruments.length === 0) {
        resultsContainer.innerHTML = `<p class="muted-text">No AMC contracts expiring soon.</p>`;
      } else {
        instruments.forEach(inst => {
          const amcDays = Utils.daysBetween(todayStr, inst.amcEndDate);
          const activeStatus = amcDays >= 0 ? `Due in ${amcDays} days` : `Expired ${Math.abs(amcDays)} days ago`;
          const activeColor = amcDays >= 0 ? 'var(--color-yellow)' : 'var(--color-red)';
          
          resultsContainer.innerHTML += `
            <div class="report-item">
              <div>
                <strong>${inst.customerName}</strong><br>
                <span class="muted-text">${inst.name} [S/N: ${inst.serialNumber}]</span>
              </div>
              <div style="text-align: right;">
                <span style="color: ${activeColor}; font-weight: 600;">${activeStatus}</span><br>
                <span style="font-size: 0.7rem;">Expires: ${Utils.formatDisplayDate(inst.amcEndDate)}</span>
              </div>
            </div>
          `;
        });
      }
    } else if (reportType === 'complaints') {
      reportTitle = "Open Breakdown Complaints Report";
      const tickets = Database.getAll('tickets').filter(t => t.requestType === 'Breakdown' && t.status !== 'Completed' && t.status !== 'Closed');
      headers = ['ticketNumber', 'customerName', 'instrumentName', 'description', 'requestDate', 'priority', 'status'];
      data = tickets;

      if (tickets.length === 0) {
        resultsContainer.innerHTML = `<p class="muted-text">No active breakdown complaints! Great job!</p>`;
      } else {
        tickets.forEach(tkt => {
          resultsContainer.innerHTML += `
            <div class="report-item">
              <div>
                <strong>${tkt.ticketNumber}</strong> - <span style="font-weight: 600; color: var(--color-red);">${tkt.priority}</span><br>
                <span class="muted-text">${tkt.customerName}</span><p style="font-size: 0.75rem; margin-top: 2px;">${tkt.description}</p>
              </div>
              <div style="text-align: right; min-width: 90px;">
                <span class="badge status-${tkt.status.toLowerCase().replace(/ /g, '_')}">${tkt.status}</span><br>
                <span style="font-size: 0.7rem;">Created: ${Utils.formatDisplayDate(tkt.requestDate)}</span>
              </div>
            </div>
          `;
        });
      }
    } else if (reportType === 'completed') {
      reportTitle = "Completed Visits & Closed Tickets Report (Month)";
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const startOfMonthStr = Utils.formatDate(startOfMonth);
      
      const visits = Database.getAll('visits').filter(v => v.visitDate >= startOfMonthStr);
      headers = ['visitDate', 'customerName', 'instrumentName', 'visitType', 'systemStatus', 'workPerformed'];
      data = visits;

      if (visits.length === 0) {
        resultsContainer.innerHTML = `<p class="muted-text">No visits completed this month yet.</p>`;
      } else {
        visits.forEach(v => {
          resultsContainer.innerHTML += `
            <div class="report-item">
              <div>
                <strong>${v.customerName}</strong><br>
                <span class="muted-text">${v.instrumentName} - ${v.visitType}</span>
              </div>
              <div style="text-align: right;">
                <span class="badge" style="background-color: var(--color-green-glow); color: var(--color-green);">Completed</span><br>
                <span style="font-size: 0.70rem;">Date: ${Utils.formatDisplayDate(v.visitDate)}</span>
              </div>
            </div>
          `;
        });
      }
    }

    titleEl.innerText = reportTitle;
    
    // Bind Export CSV action
    exportBtn.onclick = () => {
      const safeFilename = reportTitle.toLowerCase().replace(/[^a-z0-9]/g, '_') + '.csv';
      Utils.exportToCSV(safeFilename, data, headers);
    };
  },

  // ---------------- GENERAL SETTINGS LOGIC ----------------
  toggleTheme(isChecked) {
    if (isChecked) {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('sm_light_theme', 'true');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('sm_light_theme', 'false');
    }
  },

  updateSimulatedRole(role) {
    if (AuthService.currentUser) {
      AuthService.currentUser.role = role;
      localStorage.setItem('sm_session_user', JSON.stringify(AuthService.currentUser));
      this.render();
      alert(`Role switched to: ${role === 'admin' ? 'Supervisor Admin' : 'Field Service Engineer'}`);
    }
  },

  disconnectFirebase() {
    if (confirm("Are you sure you want to disconnect from Firebase cloud database? The application will fall back to secure offline local storage mode.")) {
      Database.disconnectFirebase();
      document.getElementById('form-firebase-config').reset();
      this.render();
      alert("Disconnected from Firebase. Reverted to Mock Local Storage mode.");
    }
  },

  handleLogout() {
    AuthService.logout().then(() => {
      this.switchView('login');
      alert("Logged out successfully.");
    });
  },

  // Backup Export
  exportBackup() {
    const backupData = {
      customers: Database.getAll('customers'),
      instruments: Database.getAll('instruments'),
      tickets: Database.getAll('tickets'),
      visits: Database.getAll('visits'),
      followups: Database.getAll('followups'),
      exportedAt: new Date().toISOString()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `smart_manager_backup_${Utils.formatDate(new Date())}.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    document.body.removeChild(dlAnchorElem);
  },

  // Backup Import
  importBackup(event) {
    const input = event.target;
    const reader = new FileReader();
    
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.customers && data.instruments && data.tickets && data.visits && data.followups) {
          Database.bulkOverwrite('customers', data.customers);
          Database.bulkOverwrite('instruments', data.instruments);
          Database.bulkOverwrite('tickets', data.tickets);
          Database.bulkOverwrite('visits', data.visits);
          Database.bulkOverwrite('followups', data.followups);
          this.render();
          alert("Database backup imported and restored successfully!");
        } else {
          alert("Invalid backup file format. Missing tables.");
        }
      } catch (err) {
        alert("Failed to parse JSON file: " + err.message);
      }
    };
    
    if (input.files && input.files[0]) {
      reader.readAsText(input.files[0]);
    }
  }
};

window.App = App;
window.addEventListener('DOMContentLoaded', () => App.init());
