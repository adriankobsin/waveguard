import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.2.1';

// ─── Colour palette ───────────────────────────────────────────────────────────
const C = {
  bg:        [6,   9,  18],
  card:      [13,  20,  36],
  border:    [30,  40,  60],
  primary:   [0,  210, 220],
  white:     [235, 240, 255],
  muted:     [120, 140, 170],
  amber:     [251, 191,  36],
  green:     [ 52, 211, 153],
  red:       [239,  68,  68],
  purple:    [167, 139, 250],
  blue:      [ 96, 165, 250],
  orange:    [251, 146,  60],
  pink:      [244, 114, 182],
};

// ─── Layout helpers ───────────────────────────────────────────────────────────
const PW = 210; // A4 width mm
const PH = 297; // A4 height mm
const ML = 14;  // margin left
const MR = PW - 14; // margin right
const TW = MR - ML; // text width

function setRGB(doc, [r, g, b]) { doc.setTextColor(r, g, b); }
function setFillRGB(doc, [r, g, b]) { doc.setFillColor(r, g, b); }
function setDrawRGB(doc, [r, g, b]) { doc.setDrawColor(r, g, b); }

// Wrap long text into lines
function splitText(doc, text, maxWidth) {
  return doc.splitTextToSize(text, maxWidth);
}

// Return estimated height of wrapped text block
function textBlockH(doc, text, maxWidth, lineH) {
  return splitText(doc, text, maxWidth).length * lineH;
}

// Add a page with dark background
function addPage(doc) {
  doc.addPage();
  setFillRGB(doc, C.bg);
  doc.rect(0, 0, PW, PH, 'F');
}

// Check if we need a new page; adds one and returns new y
function checkPage(doc, y, needed, state) {
  if (y + needed > PH - 16) {
    addPage(doc);
    addFooter(doc, state);
    return 20;
  }
  return y;
}

// Footer on each page
function addFooter(doc, state) {
  const pg = doc.internal.getCurrentPageInfo().pageNumber;
  setRGB(doc, C.muted);
  doc.setFontSize(7.5);
  doc.text('Guardian AI — Complete Platform Manual', ML, PH - 8);
  doc.text(`Page ${pg}`, MR, PH - 8, { align: 'right' });
  setDrawRGB(doc, C.border);
  doc.setLineWidth(0.3);
  doc.line(ML, PH - 12, MR, PH - 12);
}

// Horizontal rule
function hRule(doc, y, color = C.border) {
  setDrawRGB(doc, color);
  doc.setLineWidth(0.3);
  doc.line(ML, y, MR, y);
}

// Filled badge
function badge(doc, x, y, text, bgColor, textColor) {
  doc.setFontSize(7);
  const w = doc.getTextWidth(text) + 6;
  setFillRGB(doc, bgColor);
  doc.roundedRect(x, y - 4, w, 5.5, 1, 1, 'F');
  setRGB(doc, textColor);
  doc.text(text, x + 3, y);
  return x + w + 3;
}

// ─── Cover page ───────────────────────────────────────────────────────────────
function buildCover(doc) {
  setFillRGB(doc, C.bg);
  doc.rect(0, 0, PW, PH, 'F');

  // Top accent bar
  setFillRGB(doc, C.primary);
  doc.rect(0, 0, PW, 2, 'F');

  // Large title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  setRGB(doc, C.white);
  doc.text('Guardian AI', PW / 2, 72, { align: 'center' });

  doc.setFontSize(16);
  setRGB(doc, C.primary);
  doc.text('Complete Platform Manual', PW / 2, 85, { align: 'center' });

  // Subtitle band
  setFillRGB(doc, C.card);
  doc.roundedRect(ML, 95, TW, 28, 3, 3, 'F');
  setDrawRGB(doc, C.primary);
  doc.setLineWidth(0.6);
  doc.roundedRect(ML, 95, TW, 28, 3, 3, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setRGB(doc, C.muted);
  const subtitle = 'Enterprise AV & Network Management Platform for Superyachts, Vessels & Marine Facilities';
  const subLines = splitText(doc, subtitle, TW - 10);
  subLines.forEach((l, i) => doc.text(l, PW / 2, 105 + i * 6, { align: 'center' }));

  // Feature grid
  const features = [
    'Real-time SNMP Monitoring', 'Network Topology Mapping', 'Maintenance Scheduling',
    'Cable Register', 'Lighting Control', 'AI Diagnostics',
    'Automation Rules', 'Report Generation', 'Multi-Protocol Support',
  ];
  const cols = 3;
  const colW = TW / cols;
  let gy = 140;
  features.forEach((f, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = ML + col * colW;
    const y = gy + row * 12;
    setFillRGB(doc, C.card);
    doc.roundedRect(x + 2, y - 5, colW - 4, 10, 1.5, 1.5, 'F');
    setRGB(doc, C.primary);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('✓', x + 6, y);
    setRGB(doc, C.white);
    doc.setFont('helvetica', 'normal');
    doc.text(f, x + 12, y);
  });

  // Date and version
  const now = new Date();
  doc.setFontSize(8);
  setRGB(doc, C.muted);
  doc.text(`Generated: ${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`, PW / 2, 212, { align: 'center' });
  doc.text('Version 1.0  ·  Confidential', PW / 2, 220, { align: 'center' });

  // Bottom bar
  setFillRGB(doc, C.primary);
  doc.rect(0, PH - 2, PW, 2, 'F');
}

// ─── Table of Contents ────────────────────────────────────────────────────────
function buildTOC(doc, state) {
  addPage(doc);
  addFooter(doc, state);

  let y = 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  setRGB(doc, C.primary);
  doc.text('Table of Contents', ML, y);
  y += 10;
  hRule(doc, y, C.primary);
  y += 10;

  const entries = [
    { num: '1', title: 'Platform Overview', page: 3 },
    { num: '1.1', title: 'What is Guardian AI?', page: 3 },
    { num: '1.2', title: 'User Roles & Access Control', page: 3 },
    { num: '2', title: 'Using the Platform', page: 4 },
    { num: '2.1', title: 'Dashboard', page: 4 },
    { num: '2.2', title: 'Topology & Network Map', page: 5 },
    { num: '2.3', title: 'Maintenance Scheduling', page: 7 },
    { num: '2.4', title: 'Cable Register', page: 8 },
    { num: '2.5', title: 'Lighting Control', page: 9 },
    { num: '2.6', title: 'AI Assistant & Diagnostics', page: 10 },
    { num: '2.7', title: 'Automation Rules', page: 11 },
    { num: '2.8', title: 'SNMP Monitoring', page: 12 },
    { num: '2.9', title: 'Reports & Export', page: 13 },
    { num: '2.10', title: 'Documents & Inventory', page: 14 },
    { num: '3', title: 'Local Server Deployment', page: 15 },
    { num: '3.1', title: 'Hardware Requirements', page: 15 },
    { num: '3.2', title: 'Ubuntu Installation', page: 15 },
    { num: '3.3', title: 'Node.js & Dependencies', page: 16 },
    { num: '3.4', title: 'Application Deployment', page: 16 },
    { num: '3.5', title: 'Environment Variables', page: 17 },
    { num: '3.6', title: 'systemd Service & Auto-start', page: 17 },
    { num: '3.7', title: 'Nginx Reverse Proxy & HTTPS', page: 18 },
    { num: '3.8', title: 'Local DNS Configuration', page: 18 },
    { num: '3.9', title: 'Docker Deployment', page: 19 },
    { num: '4', title: 'Integration APIs', page: 20 },
    { num: '4.1', title: 'Cisco Networks (SNMP, RESTCONF, Meraki)', page: 20 },
    { num: '4.2', title: 'QSC Q-SYS Audio DSP', page: 21 },
    { num: '4.3', title: 'Crestron Control System', page: 22 },
    { num: '4.4', title: 'Lutron Lighting (LEAP / Telnet)', page: 23 },
    { num: '4.5', title: 'DALI Lighting Control', page: 24 },
    { num: '4.6', title: 'DMX / Art-Net', page: 25 },
    { num: '4.7', title: 'KNX Building Automation', page: 26 },
    { num: '5', title: 'Security Best Practices', page: 27 },
    { num: '6', title: 'Troubleshooting', page: 28 },
  ];

  entries.forEach(e => {
    y = checkPage(doc, y, 8, state);
    const isMain = e.num.indexOf('.') === -1;
    if (isMain) {
      y += 3;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      setRGB(doc, C.white);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setRGB(doc, C.muted);
    }
    doc.text(e.num, ML + (isMain ? 0 : 6), y);
    doc.text(e.title, ML + 18, y);
    // Dotted line
    setRGB(doc, C.border);
    doc.setFontSize(9);
    const dotX = ML + 18 + doc.getTextWidth(e.title) + 3;
    const pageNumX = MR - 10;
    if (pageNumX > dotX) {
      doc.text('.'.repeat(Math.floor((pageNumX - dotX) / doc.getTextWidth('.'))), dotX, y);
    }
    setRGB(doc, isMain ? C.primary : C.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(String(e.page), MR, y, { align: 'right' });
    y += isMain ? 8 : 7;
  });
}

// ─── Section heading helpers ──────────────────────────────────────────────────
function sectionHeading(doc, y, num, title, state) {
  y = checkPage(doc, y, 20, state);
  setFillRGB(doc, C.primary);
  doc.rect(ML, y - 5, 3, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  setRGB(doc, C.white);
  doc.text(`${num}  ${title}`, ML + 8, y + 5);
  y += 14;
  hRule(doc, y, C.primary);
  return y + 8;
}

function subHeading(doc, y, title, state) {
  y = checkPage(doc, y, 14, state);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setRGB(doc, C.primary);
  doc.text(title, ML, y);
  return y + 8;
}

function bodyText(doc, y, text, state, indent = 0) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setRGB(doc, C.white);
  const lines = splitText(doc, text, TW - indent);
  const lineH = 5.5;
  lines.forEach(line => {
    y = checkPage(doc, y, lineH, state);
    doc.text(line, ML + indent, y);
    y += lineH;
  });
  return y + 2;
}

function codeBlock(doc, y, code, state) {
  const lineH = 4.8;
  const lines = code.split('\n');
  const blockH = lines.length * lineH + 8;
  // Don't split a code block across pages if small enough
  if (y + blockH < PH - 20 || blockH < 60) {
    y = checkPage(doc, y, Math.min(blockH, 50), state);
  }
  setFillRGB(doc, C.card);
  setDrawRGB(doc, C.border);
  doc.setLineWidth(0.3);
  const actualH = lines.length * lineH + 8;
  doc.roundedRect(ML, y, TW, Math.min(actualH, PH - y - 20), 2, 2, 'FD');
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  let cy = y + 6;
  lines.forEach(line => {
    if (cy > PH - 20) {
      addPage(doc);
      addFooter(doc, state);
      cy = 22;
      setFillRGB(doc, C.card);
      setDrawRGB(doc, C.border);
      doc.roundedRect(ML, cy - 4, TW, PH - cy - 14, 2, 2, 'FD');
      cy += 2;
    }
    const trimmed = line.trimEnd();
    if (trimmed.startsWith('#') || trimmed.startsWith('!') || trimmed.startsWith('>')) {
      setRGB(doc, C.primary);
    } else if (trimmed.startsWith('{') || trimmed.startsWith('}') || trimmed.startsWith('[')) {
      setRGB(doc, C.purple);
    } else {
      setRGB(doc, C.white);
    }
    doc.text(trimmed, ML + 4, cy);
    cy += lineH;
  });
  return cy + 6;
}

function stepCard(doc, y, stepNum, label, body, state) {
  y = checkPage(doc, y, 20, state);
  // Step number badge
  setFillRGB(doc, C.primary);
  doc.circle(ML + 4, y + 1, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setRGB(doc, C.bg);
  doc.text(String(stepNum), ML + 4, y + 3, { align: 'center' });

  // Step label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setRGB(doc, C.white);
  doc.text(label, ML + 11, y + 3);
  y += 10;

  // Body — detect code blocks (lines with leading spaces or special chars)
  const isCode = body.includes('sudo ') || body.includes('apt ') || body.includes('curl ')
    || body.includes('docker ') || body.includes('npm ') || body.includes('git ')
    || body.includes('nano ') || body.includes('systemctl ') || body.includes('json')
    || body.includes('{"') || body.includes('cat ') || body.includes('openssl ')
    || body.includes('>V:');

  if (isCode) {
    y = codeBlock(doc, y, body, state);
  } else {
    // Render as bulleted rich text
    const lines = body.split('\n');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) { y += 2; return; }
      if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
        y = checkPage(doc, y, 6, state);
        setRGB(doc, C.primary);
        doc.text('•', ML + 4, y);
        setRGB(doc, C.white);
        const txt = trimmed.replace(/^[•\-]\s*/, '');
        const wrapped = splitText(doc, txt, TW - 14);
        wrapped.forEach((wl, wi) => {
          y = checkPage(doc, y, 5.5, state);
          doc.text(wl, ML + 9, y);
          y += 5.5;
        });
      } else {
        y = checkPage(doc, y, 5.5, state);
        setRGB(doc, C.white);
        const wrapped = splitText(doc, trimmed, TW - 8);
        wrapped.forEach(wl => {
          y = checkPage(doc, y, 5.5, state);
          doc.text(wl, ML + 4, y);
          y += 5.5;
        });
      }
    });
    y += 3;
  }
  hRule(doc, y, C.border);
  return y + 6;
}

function infoBox(doc, y, text, color, state) {
  y = checkPage(doc, y, 16, state);
  const lines = splitText(doc, text, TW - 12);
  const h = lines.length * 5.5 + 8;
  setFillRGB(doc, color.map(v => Math.round(v * 0.15)));
  setDrawRGB(doc, color);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML, y, TW, h, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setRGB(doc, color);
  lines.forEach((l, i) => doc.text(l, ML + 6, y + 6 + i * 5.5));
  return y + h + 6;
}

// ─── Content builders ─────────────────────────────────────────────────────────

function buildSection1(doc, state) {
  addPage(doc);
  addFooter(doc, state);
  let y = 22;
  y = sectionHeading(doc, y, '1', 'Platform Overview', state);

  y = subHeading(doc, y, '1.1  What is Guardian AI?', state);
  y = bodyText(doc, y, 'Guardian AI is an enterprise AV & network management platform designed for superyachts, large vessels, commercial facilities, and marine environments. It provides a unified interface for all technical systems on board, reducing the need for multiple separate management tools.', state);
  y += 2;

  const features = [
    ['Real-time SNMP Monitoring', 'Polls all network devices via SNMPv2c/v3 at configurable intervals. Detects device offline events within minutes and raises alarms.'],
    ['Network Topology Mapping', 'Interactive radial graph showing all devices and their physical connections. Supports path tracing, group management, and custom layouts.'],
    ['Maintenance Scheduling', 'Create recurring maintenance tasks with due dates and intervals. Track completion, assign to crew, and view on a calendar.'],
    ['Cable Register', 'Full physical cable documentation including type, deck, endpoints, and status. Import from Excel/CSV. Cross-reference with SNMP port map.'],
    ['Multi-Protocol Lighting Control', 'Unified control panel for Lutron, DALI, DMX/Art-Net, and KNX lighting systems. Zone scenes, dimming, and scheduling.'],
    ['AI Assistant & Diagnostics', 'Natural language interface for querying system status, running diagnostics, and getting fault resolution recommendations.'],
    ['Automation Rules', 'Rule-based engine: trigger actions (port bounce, email alert, SNMP command) when metrics exceed thresholds.'],
    ['Report Generation', 'Export PDF reports for maintenance history, network status, cable schedules, and custom time-range analytics.'],
  ];
  features.forEach(([name, desc]) => {
    y = checkPage(doc, y, 12, state);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setRGB(doc, C.primary);
    doc.text(`▸ ${name}`, ML + 2, y);
    y += 5.5;
    y = bodyText(doc, y, desc, state, 6);
  });

  y += 4;
  y = subHeading(doc, y, '1.2  User Roles & Access Control', state);

  const roles = [
    ['Admin', C.primary, 'Full access to all pages, settings, integrations, device management, and user management. Can configure SNMP credentials, create automation rules, deploy firmware changes, and manage all users. Required for initial setup.'],
    ['User (Operator)', C.green, 'Read access to dashboards, topology, maintenance tasks, and reports. Can mark maintenance tasks as complete, view lighting status, and run basic diagnostics. Cannot modify system settings or integrations.'],
  ];
  roles.forEach(([role, color, desc]) => {
    y = checkPage(doc, y, 20, state);
    setFillRGB(doc, color.map(v => Math.round(v * 0.15)));
    setDrawRGB(doc, color);
    doc.setLineWidth(0.4);
    doc.roundedRect(ML, y, TW, 24, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setRGB(doc, color);
    doc.text(role, ML + 6, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setRGB(doc, C.white);
    const lines = splitText(doc, desc, TW - 12);
    lines.forEach((l, i) => doc.text(l, ML + 6, y + 14 + i * 5));
    y += 28;
  });

  y += 2;
  y = bodyText(doc, y, 'To change a user\'s role: go to Settings → Users & Roles → find the user → edit their role. Only admins can change roles.', state);
}

function buildSection2(doc, state) {
  addPage(doc);
  addFooter(doc, state);
  let y = 22;
  y = sectionHeading(doc, y, '2', 'Using the Platform', state);

  // 2.1 Dashboard
  y = subHeading(doc, y, '2.1  Dashboard', state);
  const dashSteps = [
    ['Understanding the Dashboard', 'The Dashboard is the home screen showing real-time KPIs across your network and AV infrastructure. Default widgets include: Network health score (% devices online), Active alarms count, Recent SNMP events, Maintenance tasks due this week, and Bandwidth utilisation charts. The dashboard updates automatically every 30 seconds.'],
    ['Customising Widgets', '1. Click the Edit Layout button (pencil icon, top-right of dashboard)\n2. Drag widgets to reposition them on the grid\n3. Use the resize handle (bottom-right corner of each widget) to resize\n4. Click + Add Widget to add new widgets from the library\n5. Click the × on any widget to remove it\n6. Click Save Layout when done — your layout persists across sessions\n7. Widget visibility can also be toggled in Settings → Dashboard Widgets'],
    ['Reading Alarms', 'The bell icon in the top bar shows unread alarms. Click it to see:\n• Red (Critical) — immediate action required, e.g. device offline\n• Amber (Warning) — degraded performance, e.g. high latency\n• Blue (Info) — informational events, e.g. device rebooted\n\nClick any alarm to navigate to the affected device\'s detail page. Alarms are automatically cleared when the underlying issue resolves.'],
  ];
  dashSteps.forEach((s, i) => { y = stepCard(doc, y, i + 1, s[0], s[1], state); });

  // 2.2 Topology
  addPage(doc);
  addFooter(doc, state);
  y = 22;
  y = subHeading(doc, y, '2.2  Topology & Network Map', state);
  const topoSteps = [
    ['Scanning the Network', '1. Navigate to Topology from the sidebar\n2. Click Refresh (top toolbar) to trigger a fresh SNMP scan\n3. The scan polls all configured SNMP devices and rebuilds the node graph\n4. Devices are categorised automatically: Network, Camera, AV, Server, Power, Lighting\n5. Status dots (green/amber/red) update in real time\n6. Last scan timestamp is shown in the header'],
    ['Navigating the Map', '• Scroll wheel — zoom in/out (or use +/− buttons in toolbar)\n• Click + drag on empty canvas — pan the view\n• Click + drag a node — reposition it (position is saved with your layout)\n• Click a node — opens the detail panel on the right showing IP, MAC, firmware, uptime, connections\n• Use the Legend (bottom-left) to filter by device category or status\n• Double-click a node to open the full device detail page'],
    ['Tracing a Signal Path', '1. Click Trace Path in the toolbar\n2. Click the source device (highlighted orange)\n3. Click the destination device\n4. The shortest path through the network is highlighted with animated orange arrows\n5. A hop count and ordered node list appears at the bottom panel\n6. Click Cancel Path Trace or × to clear the path\n\nUse this to verify cable routes, diagnose connectivity issues, and document signal flow.'],
    ['Deck Map View', '1. Click the Deck Map tab at the top of the Topology page\n2. Upload a floor plan image (PNG/JPG/SVG) or PDF using the upload panel\n3. Click a device in the left panel, then click on the floor plan to pin it at that location\n4. Use Draw Cable Path mode to draw cable routes between pinned devices\n5. Click a cable path to run a live diagnostic (traceroute + latency test)\n6. Device status is reflected by coloured rings around each pin'],
    ['Creating Device Groups', '1. Click the Groups button (bottom-left of map)\n2. Click + New Group, enter a name and pick a colour\n3. Select devices from the list to add to the group\n4. Groups appear in the legend and can be used to filter the map\n5. Collapse a group to simplify the topology view for large networks'],
    ['Importing Devices via CSV', '1. Click Import CSV in the toolbar\n2. Download the template CSV for the correct column format\n3. Fill in: name, ip, mac, category, status, model, location, firmware\n4. Upload the completed file\n5. Preview the rows — uncheck any you want to skip\n6. Click Import — devices are added to the topology immediately'],
    ['Saving & Loading Layouts', '1. Arrange nodes as desired by dragging them\n2. Click Save Layout — enter a name when prompted\n3. Optionally set it as the Default layout (loaded on next visit)\n4. Use the Layout Selector dropdown to switch between saved layouts\n5. Layouts store node X/Y positions and any custom connections you\'ve added'],
  ];
  topoSteps.forEach((s, i) => { y = stepCard(doc, y, i + 1, s[0], s[1], state); });

  // 2.3 Maintenance
  addPage(doc);
  addFooter(doc, state);
  y = 22;
  y = subHeading(doc, y, '2.3  Maintenance Scheduling', state);
  const maintSteps = [
    ['Creating a Maintenance Task', '1. Go to Maintenance in the sidebar\n2. Click + Add Task\n3. Fill in:\n   • Title (required) — e.g. "Camera lens cleaning"\n   • Description — detailed instructions for the technician\n   • Equipment — device name this task applies to\n   • Due Date — when the task is next due\n   • Interval (days) — how often it recurs (e.g. 30, 90, 365)\n   • Assigned To — person responsible\n   • Status — start as Pending\n4. Click Create Task — it appears on the calendar immediately'],
    ['Using the Calendar View', '• Navigate months with ← → arrows\n• Click any date to see tasks due that day in the right panel\n• Colour dots on dates indicate task status: Amber=Pending, Blue=In Progress, Green=Completed, Red=Not Completed\n• Click + Add next to the date panel to create a task pre-filled with that date\n• Overdue tasks (past due and not completed) appear in the red banner at the top'],
    ['Updating Task Status', 'From either the calendar day-panel or the List view, each task card has action buttons:\n• Start — moves task to In Progress (ETO has begun the work)\n• Complete — marks as Completed, records today as last_performed_at\n• Reopen — moves a completed task back to Not Completed if issues are found afterwards\n• Edit — opens the edit modal to change any field\n\nWhen a task is completed, create the next occurrence manually or configure it via Automation Rules to trigger auto-creation.'],
    ['Searching & Filtering Tasks', '1. Click the Search tab in the top view toggle\n2. Type in the search box to filter by title, equipment, description, or assigned person\n3. Optionally pick a specific date to filter by due date\n4. Results update live as you type\n5. Use the List view for bulk management of many tasks'],
  ];
  maintSteps.forEach((s, i) => { y = stepCard(doc, y, i + 1, s[0], s[1], state); });

  // 2.4 Cables
  addPage(doc);
  addFooter(doc, state);
  y = 22;
  y = subHeading(doc, y, '2.4  Cable Register', state);
  const cableSteps = [
    ['Adding a Cable Manually', '1. Go to Cables in the sidebar\n2. Click + Add Cable\n3. Fill in:\n   • Label (required) — e.g. C-007 or NET-SW1-01\n   • From device — source equipment name\n   • To device — destination equipment name\n   • Cable type — Cat6A, Fibre OM3, HDMI 2.0, SDI, DMX, etc.\n   • System category — Network, AV, CCTV, Power, Comms, Lighting\n   • Length — e.g. 12m\n   • Deck/location — e.g. Bridge Deck, Engine Room\n   • Status — Installed, Planned, Spare, Removed\n   • Notes — any additional information\n4. Click Save — the cable appears in the register table immediately'],
    ['Importing via CSV or Excel', '1. Click Import CSV / Excel\n2. Download the template — columns: label, type, system_category, from_equipment, to_equipment, length, deck, status, notes\n3. Fill in your cable schedule spreadsheet and save as CSV or .xlsx\n4. Upload the file — a preview table shows all rows\n5. Uncheck any rows you want to skip\n6. Optionally click Analyse Paths (AI) to get suggested intermediate hops through switches and patch panels\n7. Click Import X cables to commit — all imported cables appear instantly in the register'],
    ['SNMP Port Fault Detection', 'Expand the SNMP Port Map panel at the bottom of the Cables page. This cross-references cable endpoints with live SNMP port status from your switches. If a port is reported DOWN by the switch, the corresponding cable row is highlighted with a fault indicator. Use this to quickly identify physical cable faults or disconnected devices.'],
    ['Viewing Cable Paths on Topology', 'Each cable row with both endpoints has a path icon (fork symbol). Clicking it navigates to the Topology page with the cable\'s path highlighted on the network map. This allows you to visually trace where a cable runs through your infrastructure.'],
  ];
  cableSteps.forEach((s, i) => { y = stepCard(doc, y, i + 1, s[0], s[1], state); });

  // 2.5 Lighting
  addPage(doc);
  addFooter(doc, state);
  y = 22;
  y = subHeading(doc, y, '2.5  Lighting Control', state);
  y = bodyText(doc, y, 'The Lighting page provides a unified control interface for all connected lighting systems (Lutron, DALI, DMX, KNX). It has two main tabs:', state);
  const lightingContent = [
    ['Zone Control Tab', 'Shows all configured lighting zones with current status (on/off, dimmer level, colour temperature). Use the global scene buttons at the top (Day, Evening, Night, Off) to apply presets across all zones simultaneously. Click any zone to open the detail panel for individual control, including fine-grained dimmer adjustment and colour temperature sliders. Filter zones by deck or protocol using the filter bar.'],
    ['Lighting Map Tab', 'An interactive floor plan view showing lighting zones placed spatially on the vessel/building floor plan. Zones are represented as coloured markers — green for on, grey for off, amber for fault. Click a zone marker to open its control panel. Use the bulk controls (All On/All Off) for emergency or shutdown scenarios. Zones can be added and positioned by clicking the + button and clicking the floor plan.'],
    ['Scenes', 'Scenes are preset combinations of zone levels. Pre-configured scenes: Day (100% main, 40% accent), Evening (60% main, 80% accent, warm colour), Night (10% main, 0% accent), Off (all zones to 0%). Custom scenes can be configured in Settings → Integrations for each lighting protocol.'],
    ['Protocol Notes', '• Lutron (LEAP/Telnet) — zones map to Lutron Integration IDs; requires processor to be online\n• DALI — zones map to DALI group addresses (0-15); gateway must be reachable\n• DMX/Art-Net — zones map to DMX channels; Art-Net node must be on same subnet\n• KNX — zones map to KNX group addresses; IP router must be configured'],
  ];
  lightingContent.forEach((s, i) => { y = stepCard(doc, y, i + 1, s[0], s[1], state); });

  // 2.6 AI Assistant
  y = checkPage(doc, y, 30, state);
  y = subHeading(doc, y, '2.6  AI Assistant & Diagnostics', state);
  y = bodyText(doc, y, 'The AI Assistant (accessible from the sidebar) provides a conversational interface for querying your infrastructure. It has access to all device data, maintenance records, and cable information. Example queries:', state);
  const aiExamples = [
    '"Which devices have been offline in the last 24 hours?"',
    '"Show me all maintenance tasks overdue by more than 7 days"',
    '"What cables run between the Bridge and the Main Saloon?"',
    '"Run a diagnostic on SW-Bridge-01"',
    '"What is the current firmware version of all Cisco switches?"',
    '"Generate a maintenance report for last month"',
  ];
  aiExamples.forEach(ex => {
    y = checkPage(doc, y, 6, state);
    setFillRGB(doc, C.card);
    doc.roundedRect(ML, y - 4, TW, 6, 1, 1, 'F');
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    setRGB(doc, C.primary);
    doc.text(ex, ML + 4, y);
    y += 8;
  });
  y += 2;
  y = bodyText(doc, y, 'Cable Path Diagnostics: In the Deck Map view, clicking a cable path between two pinned devices triggers an automatic diagnostic. The platform runs a simulated traceroute and latency test between the two device IPs and displays hop-by-hop results in an overlay panel.', state);

  // 2.7 Automation
  y = checkPage(doc, y, 30, state);
  y = subHeading(doc, y, '2.7  Automation Rules', state);
  y = bodyText(doc, y, 'Automation Rules let you define trigger/action pairs that execute automatically when monitored metrics exceed thresholds. Navigate to Automation in the sidebar.', state);
  const autoSteps = [
    ['Creating an Automation Rule', '1. Click + New Rule\n2. Set the Trigger:\n   • Metric: port_latency, cpu_load, packet_loss, wan_speed_down, wan_latency, device_offline, ups_battery\n   • Device: specific device name or "any"\n   • Operator: gt (greater than), lt, gte, lte, eq\n   • Value: threshold number\n   • Unit: ms, %, Mbps\n3. Set the Action:\n   • snmp_port_bounce — cycle a switch port\n   • send_alert — email/bell notification\n   • log_only — record event without acting\n   • ping_restart — trigger a device restart via ping response\n   • power_cycle — if PoE switch is configured\n   • capture_traffic — begin packet capture\n4. Set cooldown (minutes between re-firings)\n5. Optionally enable Requires Approval for sensitive actions\n6. Click Create Rule'],
    ['Viewing the Action Log', 'Below the rules list, the Action Log shows every rule firing event with timestamp, observed value, action taken, and result. Filter by rule or date range. Failed actions show an error message. Use this to audit automation behaviour and tune thresholds.'],
  ];
  autoSteps.forEach((s, i) => { y = stepCard(doc, y, i + 1, s[0], s[1], state); });

  // 2.8 SNMP
  y = checkPage(doc, y, 30, state);
  y = subHeading(doc, y, '2.8  SNMP Monitoring', state);
  y = bodyText(doc, y, 'Navigate to SNMP in the sidebar for detailed switch and device polling. The SNMP page provides port-level visibility and live metrics.', state);
  y = bodyText(doc, y, 'Features: Switch port map showing each port\'s link state, speed, duplex, VLAN, and connected device. Bandwidth graphs for top-talker analysis. UPS battery and load metrics. Real-time interface error counters. Configurable poll interval (default 60s). Supports SNMPv2c and SNMPv3 with AuthPriv.', state);
  y += 4;

  // 2.9 Reports
  y = checkPage(doc, y, 20, state);
  y = subHeading(doc, y, '2.9  Reports & Export', state);
  y = bodyText(doc, y, 'Navigate to Reports in the sidebar to generate and download structured reports. Available report types: Network Status Report (all devices, status, last seen), Maintenance History Report (completed tasks by date range), Cable Schedule Export (full cable register as PDF or CSV), SNMP Metrics Summary, Alarm History Report. All reports can be downloaded as PDF files with your vessel/property name in the header.', state);
  y += 4;

  // 2.10 Documents
  y = checkPage(doc, y, 20, state);
  y = subHeading(doc, y, '2.10  Documents & Inventory', state);
  y = bodyText(doc, y, 'The Documents page stores uploaded technical files (manuals, schematics, certificates). The Inventory page tracks physical hardware inventory including purchase dates, warranty expiry, serial numbers, and storage location. Both sections support search, filtering, and bulk export.', state);
}

function buildSection3(doc, state) {
  addPage(doc);
  addFooter(doc, state);
  let y = 22;
  y = sectionHeading(doc, y, '3', 'Local Server Deployment', state);
  y = infoBox(doc, y, '⚠  Follow these steps in order. Each step depends on the previous one being completed correctly. Estimated total setup time: 45–90 minutes for an experienced technician.', C.amber, state);

  const deploySteps = [
    ['Prepare the Server Hardware', 'Minimum requirements:\n• OS: Ubuntu 22.04 LTS (recommended) / Debian 12 / Windows Server 2022\n• CPU: 4-core x86_64 (Intel i5 8th gen or equivalent)\n• RAM: 8 GB (16 GB recommended for networks > 100 devices)\n• Storage: 50 GB SSD\n• Network: 1 GbE NIC with static IP on the local management network\n• Optional: secondary NIC for out-of-band management\n\nRecommended hardware for maritime deployment:\n• Advantech ARK-3520 (fanless, vibration-resistant, -20°C to +60°C)\n• Intel NUC 12 Pro (compact, low power, 12W idle)\n• Any mini-PC with passive cooling for engine room installation'],
    ['Install Ubuntu 22.04 LTS', '1. Download Ubuntu Server 22.04 LTS from ubuntu.com\n2. Flash to USB using Balena Etcher\n3. Boot server from USB, follow the guided installer\n4. During install: set a static IP, enable OpenSSH server\n5. After install:\nsudo apt update && sudo apt upgrade -y\nsudo hostnamectl set-hostname guardian-ai\n6. Verify connectivity:\nping -c 4 8.8.8.8\nip addr show'],
    ['Install Node.js & Dependencies', '# Install Node.js 20 LTS via NodeSource:\ncurl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\nsudo apt install -y nodejs\n\n# Verify:\nnode --version   # v20.x.x\nnpm --version    # 10.x.x\n\n# Install production static server:\nsudo npm install -g serve\n\n# Install git and other utilities:\nsudo apt install -y git curl htop net-tools'],
    ['Deploy the Application', '# Create application directory:\nsudo mkdir -p /opt/guardian-ai\nsudo chown $USER:$USER /opt/guardian-ai\n\n# Option A — Copy built files from dev machine:\nscp -r ./dist/* user@<server-ip>:/opt/guardian-ai/\n\n# Option B — Clone from GitHub repo:\ngit clone https://github.com/<your-org>/guardian-ai.git /opt/guardian-ai\ncd /opt/guardian-ai\nnpm install\nnpm run build\n\n# Verify dist folder exists:\nls /opt/guardian-ai/dist'],
    ['Configure Environment Variables', '# Create the .env file:\nnano /opt/guardian-ai/.env\n\n# Add your configuration:\nNODE_ENV=production\nPORT=8080\n\n# SNMP\nSNMP_COMMUNITY=your_community_string\nSNMP_VERSION=2c\n\n# Cisco\nCISCO_RESTCONF_HOST=192.168.1.1\nCISCO_RESTCONF_USER=admin\nCISCO_RESTCONF_PASS=yourpassword\n\n# QSC Q-SYS\nQSYS_HOST=192.168.1.50\nQSYS_PORT=1710\n\n# Crestron\nCRESTRON_HOST=192.168.1.100\nCRESTRON_API_USER=admin\nCRESTRON_API_PASS=yourpassword\n\n# Lutron\nLUTRON_HOST=192.168.1.200\n\n# DALI / DMX / KNX\nDALI_GATEWAY_HOST=192.168.1.201\nDMX_ARTNET_HOST=192.168.1.202\nKNX_GATEWAY_HOST=192.168.1.203\n\n# Save: Ctrl+X, Y, Enter'],
    ['Test the Application', '# Start manually to verify:\ncd /opt/guardian-ai\nserve -s dist -l 8080\n\n# From another machine on the same network:\n# Open browser: http://<server-ip>:8080\n# Verify the Guardian AI login page loads\n# Log in with your admin credentials\n# Confirm the Dashboard loads correctly\n# Press Ctrl+C to stop when done'],
    ['Create systemd Service (Auto-start on Boot)', '# Create service file:\nsudo nano /etc/systemd/system/guardian-ai.service\n\n# Paste:\n[Unit]\nDescription=Guardian AI Platform\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nType=simple\nUser=guardian\nGroup=guardian\nWorkingDirectory=/opt/guardian-ai\nExecStart=/usr/bin/serve -s dist -l 8080\nRestart=always\nRestartSec=5\nEnvironment=NODE_ENV=production\n\n[Install]\nWantedBy=multi-user.target\n\n# Create dedicated user:\nsudo useradd -r -s /bin/false guardian\nsudo chown -R guardian:guardian /opt/guardian-ai\n\n# Enable and start:\nsudo systemctl daemon-reload\nsudo systemctl enable guardian-ai\nsudo systemctl start guardian-ai\nsudo systemctl status guardian-ai'],
    ['Set Up Nginx Reverse Proxy (HTTPS)', '# Install Nginx:\nsudo apt install -y nginx\n\n# Self-signed certificate (or use Let\'s Encrypt):\nsudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \\\n  -keyout /etc/ssl/private/guardian.key \\\n  -out /etc/ssl/certs/guardian.crt \\\n  -subj "/CN=guardian.local/O=Wave-AVI"\n\n# Create Nginx config:\nsudo nano /etc/nginx/sites-available/guardian-ai\n\n# Paste:\nserver {\n    listen 80;\n    server_name guardian.local;\n    return 301 https://$host$request_uri;\n}\nserver {\n    listen 443 ssl http2;\n    server_name guardian.local;\n    ssl_certificate /etc/ssl/certs/guardian.crt;\n    ssl_certificate_key /etc/ssl/private/guardian.key;\n    location / {\n        proxy_pass http://127.0.0.1:8080;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection upgrade;\n        proxy_set_header Host $host;\n    }\n}\n\n# Enable:\nsudo ln -s /etc/nginx/sites-available/guardian-ai /etc/nginx/sites-enabled/\nsudo nginx -t && sudo systemctl enable --now nginx'],
    ['Configure Local DNS', '# Option A: Router/managed switch DNS record\n#   Add A record: guardian.local → <server-ip>\n\n# Option B: Hosts file on each client (quick test)\n# Windows: C:\\Windows\\System32\\drivers\\etc\\hosts\n# Mac/Linux: /etc/hosts\n# Add: 192.168.x.x   guardian.local\n\n# Option C: Pi-hole or local DNS server\n#   Add A record: guardian.local → <server-ip>\n#   Ensure all clients use the Pi-hole as DNS server\n\n# Verify:\nping guardian.local   # should resolve to server IP'],
    ['Docker Deployment (Alternative to systemd)', '# Build the image:\ndocker build -t guardian-ai:latest .\n\n# Run with auto-restart:\ndocker run -d \\\n  --name guardian-ai \\\n  --restart unless-stopped \\\n  -p 8080:8080 \\\n  --env-file /opt/guardian-ai/.env \\\n  guardian-ai:latest\n\n# View logs:\ndocker logs -f guardian-ai\n\n# Update to new version:\ndocker pull guardian-ai:latest\ndocker stop guardian-ai && docker rm guardian-ai\n# Re-run the docker run command above\n\n# Using Docker Compose:\ndocker compose up -d\ndocker compose logs -f'],
    ['Verify & Ongoing Monitoring', '# After completing all steps:\n1. Open https://guardian.local — login page should appear\n2. Log in as admin — Dashboard should load without errors\n3. Go to Topology → Refresh — SNMP scan should populate devices\n4. Check Settings → Integrations — confirm credentials are saved\n5. Navigate to Maintenance — tasks should be visible\n\n# Ongoing monitoring commands:\nsudo journalctl -u guardian-ai -f       # App logs\nhtop                                    # System resources\ndf -h /opt/guardian-ai                  # Disk space\nsudo systemctl status guardian-ai       # Service status\nnginx -t                                # Nginx config test'],
  ];
  deploySteps.forEach((s, i) => { y = stepCard(doc, y, i + 1, s[0], s[1], state); });
  y = infoBox(doc, y, '✓  After completing all 11 steps, Guardian AI is fully operational on your local network with auto-start on boot, HTTPS encryption, and local DNS access via https://guardian.local', C.green, state);
}

function buildSection4(doc, state) {
  addPage(doc);
  addFooter(doc, state);
  let y = 22;
  y = sectionHeading(doc, y, '4', 'Integration APIs', state);
  y = infoBox(doc, y, 'ℹ  Complete the Local Deployment guide (Section 3) before configuring integrations. All API credentials should be stored in the .env file on the server — never in source code.', C.muted, state);

  const integrations = [
    {
      name: '4.1  Cisco Networks (SNMP · RESTCONF · Meraki)',
      color: C.blue,
      steps: [
        ['Enable SNMP on Cisco IOS/IOS-XE', '! Read-only community string:\nsnmp-server community YOUR_COMMUNITY RO\n\n! Send traps to Guardian AI server:\nsnmp-server host 192.168.1.10 YOUR_COMMUNITY\n\n! Enable traps:\nsnmp-server enable traps snmp linkup linkdown\nsnmp-server enable traps entity\n\n! Verify:\nshow snmp\nshow snmp community'],
        ['Enable RESTCONF on IOS-XE', '! Enable HTTPS server:\nip http secure-server\nip http authentication local\n\n! Enable RESTCONF:\nrestconf\n\n! Create API user:\nusername apiadmin privilege 15 secret YOUR_PASSWORD\n\n! Verify:\nshow restconf state\n# Test: https://<switch-ip>/restconf/data/\n# Auth: Basic apiadmin:YOUR_PASSWORD'],
        ['Configure Meraki API', '1. Log into dashboard.meraki.com\n2. Organization → Settings → Enable Dashboard API\n3. Profile → API access → Generate new API key\n4. Store in .env as CISCO_MERAKI_API_KEY\n5. Get Organization ID:\nGET https://api.meraki.com/api/v1/organizations\nHeaders: X-Cisco-Meraki-API-Key: YOUR_KEY'],
        ['Add to Guardian AI Settings', '1. Settings → Integrations → Cisco\n2. Enter SNMP community string and version\n3. Enter RESTCONF host IP, username, password\n4. Enter Meraki API key, Org ID, Network ID\n5. Click Test Connection — green tick confirms success\n6. Topology → Refresh to pull Cisco device data'],
      ]
    },
    {
      name: '4.2  QSC Q-SYS Audio DSP',
      color: C.purple,
      steps: [
        ['Enable External Control (ECP) in Q-SYS Designer', '1. Open Q-SYS Designer on your laptop\n2. Connect to the Core processor\n3. File → Design Properties\n4. Enable External Control Protocol (ECP)\n5. Note the Core IP address (Status bar)\n6. Default control port: 1710 (TCP)\n7. Save and push the design to the Core'],
        ['Test QRC Connection', '# Connect via Telnet or TCP client:\ntelnet 192.168.1.50 1710\n\n# Send NoOp:\n{"jsonrpc":"2.0","id":1,"method":"NoOp","params":{}}\n\n# Expected:\n{"jsonrpc":"2.0","id":1,"result":{}}'],
        ['Discover Component Names', '# List all components:\n{"jsonrpc":"2.0","id":2,"method":"Component.GetComponents","params":{}}\n\n# Get controls for a component:\n{"jsonrpc":"2.0","id":3,"method":"Component.GetControls",\n "params":{"Name":"Main_Gain"}}'],
        ['Add to Guardian AI', '1. Settings → Integrations → QSC Q-SYS\n2. Enter Core IP and port (default 1710)\n3. Enter username/password if design uses access levels\n4. Click Test — platform sends NoOp, confirms response\n5. Discovered component names are saved for Automation rules'],
      ]
    },
    {
      name: '4.3  Crestron Control System',
      color: C.orange,
      steps: [
        ['Enable REST API on Crestron (4-Series/VC-4)', '1. Crestron Toolbox → connect to processor\n2. Web Interface → Security → API Settings\n3. Enable REST API\n4. Note processor IP address\n5. Create a dedicated API user with limited permissions'],
        ['Find Your Join Numbers', 'In SIMPL Windows:\n1. Open your program file\n2. Check the Ethernet/IP Connect symbol\n3. Note Digital, Analog, and Serial join assignments\n\nIn Crestron Studio:\n1. Open the project\n2. Check UI components for their assigned join numbers\n3. Document these for Guardian AI mapping'],
        ['Test API Connectivity', '# Test device info endpoint:\ncurl -k -u admin:password https://192.168.1.100/cws/api/device/info\n\n# Expected response:\n{\n  "DeviceModel": "CP4",\n  "FirmwareVersion": "2.8000.00081"\n}\n\n# 401 = check credentials\n# Connection refused = verify REST API is enabled'],
        ['Add to Guardian AI', '1. Settings → Integrations → Crestron\n2. Enter processor IP, username, password\n3. Map join numbers to control labels:\n   • Digital 1 = "AV System Power"\n   • Analog 10 = "Master Volume"\n   • Serial 1 = "Display Source Select"\n4. Save & Test Connection'],
      ]
    },
    {
      name: '4.4  Lutron Lighting (LEAP / Telnet)',
      color: C.amber,
      steps: [
        ['Enable Integration Protocol on Lutron Processor', 'For RadioRA 3 / Homeworks QSX:\n1. Open Lutron Designer software\n2. Connect to the main repeater/processor\n3. Integration → Enable Integration Protocol\n4. For LEAP API: note IP, ensure TLS is enabled\n5. For Telnet (legacy): set port to 23, enable in Integration settings\n\nFor Caseta Pro Bridge:\n1. Lutron app → Settings → Advanced → Integration\n2. Enable Integration API\n3. Note bridge IP address'],
        ['Obtain LEAP Certificates', '# LEAP uses mutual TLS — pair your client:\npython3 -c "\nimport asyncio\nfrom pylutron_caseta.smartbridge import Smartbridge\nbridge = Smartbridge.create_tls(\'192.168.1.200\')\nasyncio.run(bridge.connect())\n"\n# Press physical button on bridge during pairing\n# Copy generated certs to /opt/guardian-ai/certs/\n# Update .env:\nLUTRON_CERT=./certs/lutron.crt\nLUTRON_KEY=./certs/lutron.key'],
        ['Discover Zones', '# Query zones via LEAP:\n{"CommuniqueType":"ReadRequest","Header":{"Url":"/zone"}}\n\n# Response lists all zones with:\n# - Zone ID, Zone name, Current level\n# Map zone IDs in:\n# Settings → Integrations → Lutron → Zone Mapping'],
        ['Configure in Guardian AI', '1. Settings → Integrations → Lutron\n2. Select protocol: LEAP or Telnet\n3. Enter processor IP\n4. For LEAP: upload cert, key, and CA cert files\n5. For Telnet: username=lutron, password=integration (default)\n6. Click Discover Zones — all zones appear\n7. Assign each zone to a Guardian AI room/area'],
      ]
    },
    {
      name: '4.5  DALI Lighting Control',
      color: C.green,
      steps: [
        ['Identify Your DALI Gateway', 'DALI buses require an IP gateway. Common manufacturers:\n• Helvar DALI Router 910/920 — TCP port 50000 (ASCII)\n• Tridonic DALI Gateway — REST API\n• Lunatone DALI Gateway — UDP/TCP\n• ENTTEC DALI USB/Ethernet — OLA compatible\n\nFind the gateway IP via DHCP table or manufacturer\'s discovery tool.'],
        ['Configure the DALI Gateway (Helvar)', '1. Open Helvar Designer software\n2. Scan network for the router\n3. Address all DALI gear (ballasts/drivers) — addresses 0–63\n4. Create groups (0–15) to organise by zone\n5. Create scenes (0–15) for preset light levels\n6. Note: groups and scene assignments are stored in gateway'],
        ['Test DALI Commands (Helvar TCP)', '# Connect to gateway on port 50000:\nnc 192.168.1.201 50000\n\n# Query group 1 level:\n>V:2,C:13,G:1@\n\n# Set group 1 to 75%:\n>V:2,C:16,G:1,L:75@\n\n# Recall scene 1 on group 1:\n>V:2,C:11,G:1,B:1@'],
        ['Add to Guardian AI', '1. Settings → Integrations → DALI\n2. Select gateway type (Helvar / Tridonic / OLA)\n3. Enter gateway IP and port\n4. Click Discover Groups — DALI groups 0–15 listed\n5. Name each group (e.g. "Saloon Ceiling")\n6. Assign to Guardian AI Lighting zones\n7. Scenes from gateway appear as preset options in Lighting page'],
      ]
    },
    {
      name: '4.6  DMX / Art-Net',
      color: C.pink,
      steps: [
        ['Choose Your DMX Interface', 'Options for DMX over IP:\n\n1. Art-Net Node (recommended) — converts Art-Net UDP → DMX512\n   Examples: Enttec ODE MkII, Artistic Licence Net-Lynx\n   Advantage: no extra software, just send UDP packets\n\n2. sACN (E1.31) Node — similar to Art-Net, ANSI standard\n   Most modern nodes support both Art-Net and sACN\n\n3. USB-to-DMX with OLA server\n   Enttec Open DMX USB + OLA (Open Lighting Architecture)\n\n4. Existing lighting desk with Art-Net output\n   ETC, MA, or similar desk with Art-Net enabled'],
        ['Configure Art-Net Node', '# On the node web interface:\n1. Set static IP on AV VLAN\n2. Assign Art-Net Universe (0 for first DMX universe)\n3. Enable Art-Net input mode\n\n# Update .env:\nDMX_ARTNET_HOST=<node-ip>   # or broadcast 2.0.0.255\nDMX_ARTNET_PORT=6454\nDMX_ARTNET_UNIVERSE=0'],
        ['Set Up OLA (USB gateway only)', '# Install and start OLA:\nsudo apt install -y ola\nsudo olad -l 3\n\n# Open OLA web interface:\n# http://localhost:9090\n# Universes → Add Universe → Universe 0\n# Add Output Plugin: Open DMX USB\n\n# Test via REST API:\ncurl -X POST http://localhost:9090/dmx \\\n  -d "u=0&d=255,0,0,0,128,0"'],
        ['Add to Guardian AI', '1. Settings → Integrations → DMX/Art-Net\n2. Select mode: Art-Net Direct / sACN / OLA\n3. Enter node IP, port, and universe number\n4. Click Patch Channels — map DMX channels to fixture parameters:\n   • CH 1 = "House Dimmer Main" (dimmer)\n   • CH 7-9 = "LED Bar 1 RGB" (RGB)\n5. Fixtures appear in Lighting page as controllable zones'],
      ]
    },
    {
      name: '4.7  KNX Building Automation',
      color: C.red,
      steps: [
        ['Identify Your KNX IP Interface/Router', 'KNX TP bus needs an IP interface or router:\n• KNX IP Interface — tunnelling, 1 client at a time\n• KNX IP Router — routing TP↔IP, multiple clients (recommended)\n• Weinzierl 730/760 — popular, reliable IP router\n• MDT SCN-IP100.02 — enterprise grade\n\nFind device on network using ETS or DHCP table.'],
        ['Assign Group Addresses in ETS', '1. Open ETS 5/6, connect to KNX project\n2. Note group addresses (GAs) for:\n   • Lighting on/off (DPT 1.001) — e.g. 1/0/1\n   • Dimming value (DPT 5.001) — e.g. 3/1/5\n   • Scene recall (DPT 17.001) — e.g. 5/0/1\n   • HVAC setpoint, blind position, etc.\n3. Export GA list as CSV from ETS:\n   Overview → Group Addresses → Export\n4. Import CSV in Guardian AI → Settings → KNX → Import GA List'],
        ['Test KNX Communication', '# Install knxd on the server:\nsudo apt install -y knxd\n\n# Switch light on:\nknxtool on ip:192.168.1.203 1/0/1\n\n# Switch light off:\nknxtool off ip:192.168.1.203 1/0/1\n\n# Via ETS Diagnostics:\n# ETS → Diagnostics → Group Monitor\n# Send write telegram to 1/0/1 with value TRUE'],
        ['Add to Guardian AI', '1. Settings → Integrations → KNX\n2. Enter IP router host and port (default 3671)\n3. Enter individual address for Guardian AI client (e.g. 1.1.255)\n4. Click Import Group Addresses — upload ETS CSV export\n5. Assign each GA to Guardian AI zones/controls:\n   • 1/0/1 → Saloon Lights On/Off\n   • 3/1/5 → Saloon Dimmer Level\n6. Assigned GAs are controllable from Lighting and Automation pages'],
      ]
    },
  ];

  integrations.forEach(intg => {
    addPage(doc);
    addFooter(doc, state);
    y = 22;
    setFillRGB(doc, intg.color.map(v => Math.round(v * 0.15)));
    setDrawRGB(doc, intg.color);
    doc.setLineWidth(0.5);
    doc.roundedRect(ML, y - 4, TW, 12, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    setRGB(doc, intg.color);
    doc.text(intg.name, ML + 6, y + 4);
    y += 16;
    intg.steps.forEach((s, i) => { y = stepCard(doc, y, i + 1, s[0], s[1], state); });
  });
}

function buildSection5(doc, state) {
  addPage(doc);
  addFooter(doc, state);
  let y = 22;
  y = sectionHeading(doc, y, '5', 'Security Best Practices', state);

  const secItems = [
    ['Network Segmentation', [
      'Place the Guardian AI server on a dedicated Management VLAN (e.g. VLAN 10)',
      'AV/control devices (Crestron, QSC, Lutron, DALI gateways) on a separate AV VLAN (e.g. VLAN 20)',
      'Guest and crew Wi-Fi must be isolated from both management and AV VLANs',
      'Use ACLs on managed switches to restrict inter-VLAN routing to only required ports',
      'Ensure SNMP polling traffic flows only from Guardian AI server IP',
    ]],
    ['Credentials & API Keys', [
      'Never hardcode passwords or API keys in source files or application code',
      'Store all secrets in the .env file on the local server — set file permissions: chmod 600 .env',
      'Rotate SNMP community strings quarterly and after any crew change',
      'Use SNMP v3 with AuthPriv (AES-128 + SHA) wherever supported by the device',
      'Revoke and regenerate API tokens if a device is decommissioned or crew changes',
      'Use a password manager to store all integration credentials securely',
    ]],
    ['Access Control', [
      'Only grant Admin role to the ETO and senior AV technician — maximum 2 admin accounts',
      'All other crew accounts should have User role only',
      'Review user list monthly — remove accounts for crew who have left the vessel',
      'Enable session timeout in the browser (platform respects browser security policies)',
      'Do not share login credentials between crew members — each person needs their own account',
    ]],
    ['Physical Security', [
      'Locate the Guardian AI server in a secure technical space (comms room, engine room)',
      'Use a locked rack or cabinet to prevent unauthorised physical access',
      'Label all network ports clearly — document any changes in the Cable Register',
      'Ensure the server is on a UPS (uninterruptible power supply) to survive power transitions',
    ]],
    ['Backup & Recovery', [
      'Schedule automated backups of the database and uploads folder — daily recommended',
      'Test restore procedure quarterly — know how to recover from a failed server',
      'Keep a copy of the .env file in a secure offline location (printed or encrypted USB)',
      'Document the server IP, hostname, and all integration IPs in a physical maintenance log',
      'After major configuration changes, export a full settings backup from the Settings page',
    ]],
  ];

  secItems.forEach(([title, bullets]) => {
    y = checkPage(doc, y, 16, state);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    setRGB(doc, C.amber);
    doc.text(`▸ ${title}`, ML, y);
    y += 7;
    bullets.forEach(b => {
      y = checkPage(doc, y, 6, state);
      setRGB(doc, C.primary);
      doc.setFontSize(9);
      doc.text('•', ML + 3, y);
      setRGB(doc, C.white);
      doc.setFont('helvetica', 'normal');
      const lines = splitText(doc, b, TW - 12);
      lines.forEach((l, i) => {
        y = checkPage(doc, y, 5.5, state);
        doc.text(l, ML + 8, y);
        y += 5.5;
      });
    });
    y += 5;
  });
}

function buildSection6(doc, state) {
  addPage(doc);
  addFooter(doc, state);
  let y = 22;
  y = sectionHeading(doc, y, '6', 'Troubleshooting', state);

  const issues = [
    ['Dashboard shows no devices / all devices offline', 'Cause: SNMP scan cannot reach devices.\n1. Check that the Guardian AI server has network access to all devices\n2. Verify SNMP community string in .env matches what is configured on switches\n3. Confirm SNMP is enabled on each device (see Section 4.1)\n4. Check firewall rules — UDP port 161 must be open from server to devices\n5. Test manually: snmpget -v2c -c COMMUNITY <device-ip> sysDescr.0\n6. Check logs: sudo journalctl -u guardian-ai -f'],
    ['Topology page loads but graph is empty', 'Cause: No devices in the database, or SNMP scan returned no results.\n1. Navigate to Topology → click Refresh to trigger a manual scan\n2. Check the browser console (F12) for API errors\n3. Import devices manually via Import CSV if SNMP discovery is not working\n4. Verify the snmpTopologyScan backend function is deployed and running\n5. Check Settings → Integrations → SNMP is enabled'],
    ['Lighting controls not responding', 'Cause: Integration driver cannot reach the lighting gateway.\n1. Ping the gateway IP from the server: ping 192.168.1.200\n2. Verify the gateway is on the correct VLAN and reachable from the server\n3. Check protocol selection in Settings (LEAP vs Telnet for Lutron, correct port for DALI)\n4. For Lutron LEAP: verify certificates are valid and not expired (3-year default)\n5. For DALI: check the TCP connection to port 50000 with: nc -zv 192.168.1.201 50000\n6. Check the integration is enabled in Settings → Integrations'],
    ['SNMP Port Map shows no data', 'Cause: SNMP walk failing on switch interfaces.\n1. Verify SNMPv2c community string or SNMPv3 credentials\n2. Test: snmpwalk -v2c -c COMMUNITY <switch-ip> ifTable\n3. Confirm the switch IP is in the configured scan ranges (Settings → Network Monitoring)\n4. Check that IF-MIB (interfaces MIB) is enabled on the switch\n5. For Cisco: confirm "snmp-server community YOUR_COMMUNITY RO" is set'],
    ['Application not starting after server reboot', 'Cause: systemd service not configured or failed.\n1. Check service status: sudo systemctl status guardian-ai\n2. View error logs: sudo journalctl -u guardian-ai --since "10 minutes ago"\n3. Check that Node.js is installed: node --version\n4. Check the dist folder exists: ls /opt/guardian-ai/dist\n5. Verify file permissions: ls -la /opt/guardian-ai\n6. Ensure guardian user owns the files: sudo chown -R guardian:guardian /opt/guardian-ai\n7. Reload and restart: sudo systemctl daemon-reload && sudo systemctl restart guardian-ai'],
    ['Cannot access https://guardian.local', 'Cause: DNS resolution or Nginx configuration issue.\n1. Test IP access first: http://<server-ip>:8080 — if this works, it\'s a DNS issue\n2. Check Nginx is running: sudo systemctl status nginx\n3. Verify Nginx config: sudo nginx -t\n4. Check DNS: ping guardian.local — if it fails, the DNS record is not resolving\n5. Add hosts file entry as a quick test: echo "192.168.x.x guardian.local" | sudo tee -a /etc/hosts\n6. Check firewall: sudo ufw status — ensure ports 80 and 443 are allowed'],
    ['AI Assistant not responding / errors', 'Cause: OpenAI API key not set or invalid.\n1. Go to Settings → AI & OpenAI → verify API key is entered\n2. Ensure the key starts with "sk-" and is not expired\n3. Check your OpenAI account has remaining credits at platform.openai.com\n4. Test the key using the "Test key" button in Settings\n5. The AI uses gpt-4o-mini by default — ensure your account has access to this model'],
  ];

  issues.forEach(([title, solution]) => {
    y = checkPage(doc, y, 18, state);
    setFillRGB(doc, C.red.map(v => Math.round(v * 0.12)));
    setDrawRGB(doc, C.red);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, y - 5, TW, 12, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    setRGB(doc, C.red);
    doc.text(`⚠  ${title}`, ML + 5, y + 2);
    y += 12;
    y = codeBlock(doc, y, solution, state);
    y += 2;
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const state = {};

    // ── Build all sections ──
    buildCover(doc);
    buildTOC(doc, state);
    buildSection1(doc, state);
    buildSection2(doc, state);
    buildSection3(doc, state);
    buildSection4(doc, state);
    buildSection5(doc, state);
    buildSection6(doc, state);

    // ── Final page count footer pass ──
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 2; p <= totalPages; p++) {
      doc.setPage(p);
      // Footer already added per-page; just update page count reference if needed
    }

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=Guardian-AI-Manual.pdf',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});