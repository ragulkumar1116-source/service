const Utils = {
  // Generate a random ticket number, e.g. TKT-2026-4812
  generateTicketNumber() {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `TKT-${year}-${rand}`;
  },

  // Format Date to YYYY-MM-DD
  formatDate(dateObjOrString) {
    if (!dateObjOrString) return '';
    const date = new Date(dateObjOrString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  },

  // Format Date for user friendly display e.g. "12 Jun 2026"
  formatDisplayDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  },

  // Calculate difference in days between two dates
  daysBetween(d1, d2) {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    const diffTime = date2 - date1;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  // Check if date is today
  isToday(dateString) {
    if (!dateString) return false;
    const todayStr = this.formatDate(new Date());
    const targetStr = this.formatDate(new Date(dateString));
    return todayStr === targetStr;
  },

  // Export array of objects to CSV
  exportToCSV(filename, data, headers) {
    if (!data || !data.length) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Add header row
    csvContent += headers.join(",") + "\r\n";
    
    // Add data rows
    data.forEach(item => {
      const row = headers.map(header => {
        let val = item[header] !== undefined ? item[header] : '';
        // Escape quotes
        val = String(val).replace(/"/g, '""');
        // Wrap in quotes if it contains commas or newlines
        if (val.includes(',') || val.includes('\n') || val.includes('"')) {
          val = `"${val}"`;
        }
        return val;
      });
      csvContent += row.join(",") + "\r\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // Generate Mock Seed Data
  getMockData() {
    const today = new Date();
    
    const d = (daysOffset) => {
      const target = new Date();
      target.setDate(today.getDate() + daysOffset);
      return target.toISOString().split('T')[0];
    };

    const customers = [
      {
        id: "cust-1",
        name: "Acme Diagnostics Labs",
        companyName: "Acme Healthcare Group",
        address: "Building B, Technology Park, North Phase",
        contactPerson: "Dr. Rachel Green",
        mobile: "+91 98765 43210",
        email: "rachel.green@acmehealth.com",
        gstNumber: "27AAACA1122D1Z5",
        notes: "Prestige customer. Requires calibration certificates within 24 hours of visit."
      },
      {
        id: "cust-2",
        name: "Apex Pharma Industries",
        companyName: "Apex Lifesciences Corp",
        address: "Plot 45, MIDC Industrial Area, Zone 3",
        contactPerson: "Mr. Vikram Shah",
        mobile: "+91 99887 76655",
        email: "v.shah@apexpharma.in",
        gstNumber: "27AAAPA5544K2Z9",
        notes: "Access permitted only during business hours (9 AM - 6 PM). Entry pass required."
      },
      {
        id: "cust-3",
        name: "Vanguard Scientific Research Center",
        companyName: "Vanguard Labs Inc",
        address: "7th Avenue, Research Boulevard, Phase II",
        contactPerson: "Dr. Alan Grant",
        mobile: "+91 91234 56789",
        email: "alan.grant@vanguardres.org",
        gstNumber: "27AAAVG7788P3Z1",
        notes: "Instruments kept in cleanroom. Requires protective booties and lab coats."
      }
    ];

    const instruments = [
      {
        id: "inst-1",
        name: "High-Performance Liquid Chromatograph (HPLC)",
        modelNumber: "LC-20AD",
        serialNumber: "HPLC-2024-0089",
        installationDate: d(-365),
        warrantyExpiryDate: d(0), // Expires today! Alert!
        amcStartDate: d(-180),
        amcEndDate: d(180), // AMC Active
        calibrationDueDate: d(-3), // Cal overdue by 3 days! Red alert!
        customerId: "cust-1",
        customerName: "Acme Diagnostics Labs"
      },
      {
        id: "inst-2",
        name: "UV-VIS Spectrophotometer",
        modelNumber: "UV-2600i",
        serialNumber: "UV-2023-1042",
        installationDate: d(-730),
        warrantyExpiryDate: d(-365), // Out of warranty
        amcStartDate: d(-30),
        amcEndDate: d(15), // AMC Due soon! Yellow alert!
        calibrationDueDate: d(0), // Calibration due today! Orange alert!
        customerId: "cust-1",
        customerName: "Acme Diagnostics Labs"
      },
      {
        id: "inst-3",
        name: "Gas Chromatography Mass Spectrometer (GC-MS)",
        modelNumber: "GCMS-QP2020",
        serialNumber: "GCMS-2025-0552",
        installationDate: d(-90),
        warrantyExpiryDate: d(275), // In warranty
        amcStartDate: d(-90),
        amcEndDate: d(275),
        calibrationDueDate: d(60), // OK
        customerId: "cust-2",
        customerName: "Apex Pharma Industries"
      },
      {
        id: "inst-4",
        name: "Thermal Cycler PCR System",
        modelNumber: "PCR-96G",
        serialNumber: "PCR-2024-7721",
        installationDate: d(-200),
        warrantyExpiryDate: d(165),
        amcStartDate: d(-200),
        amcEndDate: d(-20), // AMC Overdue by 20 days! Red alert!
        calibrationDueDate: d(45),
        customerId: "cust-3",
        customerName: "Vanguard Scientific Research Center"
      }
    ];

    const tickets = [
      {
        id: "tkt-1",
        ticketNumber: "TKT-2026-5120",
        customerId: "cust-1",
        customerName: "Acme Diagnostics Labs",
        instrumentId: "inst-1",
        instrumentName: "High-Performance Liquid Chromatograph (HPLC) (SN: HPLC-2024-0089)",
        requestType: "Breakdown",
        description: "Pump pressure fluctuating wildly, baseline noise is too high. Critical run planned for Friday.",
        requestDate: d(-2),
        priority: "Critical",
        assignedEngineerId: "eng-1",
        assignedEngineerName: "Alex Mercer",
        status: "In Progress",
        reminderFrequency: "Daily Reminder"
      },
      {
        id: "tkt-2",
        ticketNumber: "TKT-2026-8914",
        customerId: "cust-2",
        customerName: "Apex Pharma Industries",
        instrumentId: "inst-3",
        instrumentName: "Gas Chromatography Mass Spectrometer (GC-MS) (SN: GCMS-2025-0552)",
        requestType: "Calibration Request",
        description: "Annual calibration check and certificate renewal.",
        requestDate: d(-5),
        priority: "Medium",
        assignedEngineerId: "eng-1",
        assignedEngineerName: "Alex Mercer",
        status: "Assigned",
        reminderFrequency: "Weekly Reminder"
      },
      {
        id: "tkt-3",
        ticketNumber: "TKT-2026-1209",
        customerId: "cust-3",
        customerName: "Vanguard Scientific Research Center",
        instrumentId: "inst-4",
        instrumentName: "Thermal Cycler PCR System (SN: PCR-2024-7721)",
        requestType: "Technical Support",
        description: "Heated lid temperature fluctuates intermittently. Code E-04 showing.",
        requestDate: d(-10),
        priority: "High",
        assignedEngineerId: "eng-1",
        assignedEngineerName: "Alex Mercer",
        status: "Waiting for Spare Parts",
        reminderFrequency: "Daily Reminder"
      },
      {
        id: "tkt-4",
        ticketNumber: "TKT-2026-3022",
        customerId: "cust-1",
        customerName: "Acme Diagnostics Labs",
        instrumentId: "inst-2",
        instrumentName: "UV-VIS Spectrophotometer (SN: UV-2023-1042)",
        requestType: "Installation",
        description: "Install auto-sampler accessory, verify compliance.",
        requestDate: d(-30),
        priority: "Low",
        assignedEngineerId: "eng-1",
        assignedEngineerName: "Alex Mercer",
        status: "Closed",
        reminderFrequency: "Monthly Reminder"
      }
    ];

    const visits = [
      {
        id: "visit-1",
        ticketId: "tkt-4",
        visitDate: d(-28),
        customerId: "cust-1",
        customerName: "Acme Diagnostics Labs",
        instrumentId: "inst-2",
        instrumentName: "UV-VIS Spectrophotometer (SN: UV-2023-1042)",
        visitType: "Installation Visit",
        workPerformed: "Installed auto-sampler accessory, aligned optic mirrors.",
        observations: "Device working normally. Accessory detected successfully by software.",
        correctiveActions: "Standard optical path calibration completed.",
        sparePartsUsed: "Auto-sampler assembly (P/N: ASM-220)",
        systemStatus: "Operational",
        nextVisitDate: d(0), // Visit due today for calibration check
        remarks: "Customer trained on auto-sampler interface. Close ticket requested."
      },
      {
        id: "visit-2",
        ticketId: "tkt-3",
        visitDate: d(-8),
        customerId: "cust-3",
        customerName: "Vanguard Scientific Research Center",
        instrumentId: "inst-4",
        instrumentName: "Thermal Cycler PCR System (SN: PCR-2024-7721)",
        visitType: "Breakdown Visit",
        workPerformed: "Investigated heater block and lid connector.",
        observations: "Lid heating element resistance reads infinite. Heating element has burnt out.",
        correctiveActions: "Placed request for replacement heating element lid module.",
        sparePartsUsed: "None (Awaiting parts)",
        systemStatus: "Down",
        nextVisitDate: d(7),
        remarks: "Awaiting part replacement module. Switched status to Waiting for Spare Parts."
      }
    ];

    const followups = [
      {
        id: "fol-1",
        type: "Spare replacement",
        customerId: "cust-3",
        customerName: "Vanguard Scientific Research Center",
        description: "Follow up with procurement for PCR-96G heating lid element and schedule installation visit.",
        dueDate: d(0), // Due Today!
        status: "pending"
      },
      {
        id: "fol-2",
        type: "Calibration scheduling",
        customerId: "cust-1",
        customerName: "Acme Diagnostics Labs",
        description: "Schedule calibration visit for HPLC-2024-0089 since it is 3 days overdue.",
        dueDate: d(-1), // Overdue!
        status: "pending"
      },
      {
        id: "fol-3",
        type: "AMC renewal",
        customerId: "cust-3",
        customerName: "Vanguard Scientific Research Center",
        description: "Send AMC renewal quotation for PCR-96G (AMC expired on " + this.formatDisplayDate(d(-20)) + ").",
        dueDate: d(5), // Future
        status: "pending"
      }
    ];

    return { customers, instruments, tickets, visits, followups };
  }
};

// Export to window/module
window.Utils = Utils;
