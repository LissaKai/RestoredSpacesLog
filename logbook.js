/* ============================================================
   Restored Spaces — Client Logbook
   localStorage-backed. Clients (folders) → Sessions (entries).
   ============================================================ */
(function () {
  'use strict';

  var STORE = 'rs-logbook-v1';
  var SELKEY = 'rs-logbook-selected';
  var BKEY = 'rs-logbook-lastbackup';

  // ---------- data ----------
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE)) || { clients: [] }; }
    catch (e) { return { clients: [] }; }
  }
  function save() { localStorage.setItem(STORE, JSON.stringify(data)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var data = load();
  var selectedId = localStorage.getItem(SELKEY) || null;
  if (selectedId && !data.clients.some(function (c) { return c.id === selectedId; })) selectedId = null;

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function money(n) {
    var v = Number(n) || 0;
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }
  function todayISO() {
    var d = new Date(); var off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var p = iso.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  function getClient(id) { return data.clients.find(function (c) { return c.id === id; }); }
  function ensureClient(c) {
    if (!c.contact) c.contact = { phone: '', email: '', address: '', source: '', needs: '', status: 'new' };
    if (!c.invoice) c.invoice = { projectPrice: '', deposit: '', paid: false, date: todayISO() };
    return c;
  }
  function clientTotals(c) {
    var hrs = 0, fee = 0;
    c.sessions.forEach(function (s) { hrs += Number(s.hours) || 0; fee += Number(s.fee) || 0; });
    return { count: c.sessions.length, hours: hrs, fee: fee };
  }

  // ---------- folder icon ----------
  var FOLDER = '<svg class="folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

  // ---------- render: sidebar ----------
  var clientFilter = '';
  function renderSidebar() {
    var list = document.getElementById('clientList');
    if (!data.clients.length) {
      list.innerHTML = '<div class="empty-clients">No clients yet.<br>Click <b>+</b> to add your first one.</div>';
      return;
    }
    var sorted = data.clients.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (clientFilter) {
      var q = clientFilter.toLowerCase();
      sorted = sorted.filter(function (c) { return c.name.toLowerCase().indexOf(q) > -1; });
    }
    if (!sorted.length) {
      list.innerHTML = '<div class="empty-clients">No clients match “' + esc(clientFilter) + '”.</div>';
      return;
    }
    list.innerHTML = sorted.map(function (c) {
      ensureClient(c);
      var t = clientTotals(c);
      var sess = t.count + (t.count === 1 ? ' session' : ' sessions');
      var st = c.contact.status && c.contact.status !== 'new' ? ' · ' + statusLabel(c.contact.status) : (c.contact.status === 'new' ? ' · New lead' : '');
      var unpaid = c.invoice && c.invoice.paid === false && (Number(c.invoice.deposit) || c.sessions.length) ? ' · unpaid' : '';
      return '<div class="client-item' + (c.id === selectedId ? ' active' : '') + '" data-id="' + c.id + '">' +
        FOLDER +
        '<div class="ci-body"><div class="ci-name">' + esc(c.name) + '</div>' +
        '<div class="ci-meta">' + sess + st + '</div></div></div>';
    }).join('');
    Array.prototype.forEach.call(list.querySelectorAll('.client-item'), function (el) {
      el.addEventListener('click', function () { selectClient(el.getAttribute('data-id')); });
    });
  }

  // ---------- render: main ----------
  var activeTab = 'details';

  function renderMain() {
    var main = document.getElementById('main');
    var c = selectedId ? getClient(selectedId) : null;

    if (!c) {
      main.innerHTML =
        '<div class="blank">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' +
        '<h3>Select a client</h3>' +
        '<p>Choose a client from the left, or add a new one to start logging sessions.</p>' +
        '</div>';
      return;
    }
    ensureClient(c);

    function tabBtn(id, label) {
      return '<button class="tab' + (activeTab === id ? ' active' : '') + '" data-tab="' + id + '">' + label + '</button>';
    }

    main.innerHTML =
      '<div class="main-inner">' +
        '<button class="back-btn" id="backBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>All clients</button>' +
        '<div class="c-head"><div>' +
          '<div class="c-eyebrow">Client</div>' +
          '<div class="c-title">' + esc(c.name) + '</div>' +
        '</div><div class="c-actions">' +
          '<button class="icon-btn" id="renameBtn">Rename</button>' +
          '<button class="icon-btn" id="printBtn">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>Print</button>' +
          '<button class="icon-btn danger" id="delClientBtn">Delete</button>' +
        '</div></div>' +
        '<div class="tabs">' + tabBtn('details', 'Details') + tabBtn('sessions', 'Sessions') + tabBtn('invoice', 'Invoice') + '</div>' +
        '<div id="tabContent"></div>' +
      '</div>';

    var backEl = document.getElementById('backBtn');
    if (backEl) backEl.addEventListener('click', function () { document.body.setAttribute('data-view', 'list'); });
    document.getElementById('renameBtn').addEventListener('click', function () { openModal('rename', c); });
    document.getElementById('delClientBtn').addEventListener('click', function () { deleteClient(c); });
    document.getElementById('printBtn').addEventListener('click', function () { window.print(); });
    Array.prototype.forEach.call(main.querySelectorAll('.tab'), function (b) {
      b.addEventListener('click', function () { activeTab = b.getAttribute('data-tab'); renderTab(c); updateTabBar(); });
    });

    renderTab(c);
  }

  function updateTabBar() {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === activeTab);
    });
  }

  function renderTab(c) {
    if (activeTab === 'details') return renderDetailsTab(c);
    if (activeTab === 'invoice') return renderInvoiceTab(c);
    return renderSessionsTab(c);
  }

  // ---------- tab: sessions ----------
  function renderSessionsTab(c) {
    var box = document.getElementById('tabContent');
    var t = clientTotals(c);
    var sessions = c.sessions.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.created || 0) - (a.created || 0);
    });

    var sessionsHTML = sessions.length
      ? sessions.map(function (s, i) {
          var num = sessions.length - i;
          var stats = [];
          if (s.hours) stats.push('<span class="s-stat"><b>' + esc(s.hours) + '</b> hr' + (Number(s.hours) === 1 ? '' : 's') + '</span>');
          if (s.fee) stats.push('<span class="s-fee">' + money(s.fee) + '</span>');
          return '<div class="session" data-id="' + s.id + '">' +
            '<div class="s-top"><div class="s-date">' + fmtDate(s.date) + '</div>' +
            '<div class="s-stats">' + stats.join('') + '</div></div>' +
            (s.notes ? '<div class="s-notes">' + esc(s.notes) + '</div>' : '<div class="s-notes" style="color:var(--text-muted);font-style:italic;">No notes.</div>') +
            '<div class="s-foot"><button class="s-link edit" data-id="' + s.id + '">Edit</button>' +
            '<button class="s-link del" data-id="' + s.id + '">Delete</button>' +
            '<span class="s-stat" style="margin-left:auto;color:var(--sage);">Session #' + num + '</span></div>' +
            '</div>';
        }).join('')
      : '<div class="no-sessions">No sessions logged yet.<br>Add your first one above.</div>';

    box.innerHTML =
      '<div class="totals">' +
        '<div class="tot"><label>Sessions</label><div class="v">' + t.count + '</div></div>' +
        '<div class="tot"><label>Total Hours</label><div class="v">' + (t.hours % 1 ? t.hours.toFixed(1) : t.hours) + '</div></div>' +
        '<div class="tot"><label>Total Fees</label><div class="v green">' + money(t.fee) + '</div></div>' +
      '</div>' +
      '<div class="form-card">' +
        '<h3>Log a session</h3>' +
        '<div class="frow">' +
          '<div class="field"><label>Date</label><input type="date" id="fDate" value="' + todayISO() + '"></div>' +
          '<div class="field"><label>Hours</label><input type="number" id="fHours" min="0" step="0.25" placeholder="0"></div>' +
          '<div class="field"><label>Fee</label><div class="fee-wrap"><span>$</span><input type="number" id="fFee" min="0" step="1" placeholder="0"></div></div>' +
        '</div>' +
        '<div class="field"><label>What we worked on</label><textarea id="fNotes" placeholder="Purged and sorted the hall closet, reorganized lower shelves so daily items are within reach…"></textarea></div>' +
        '<div class="form-actions"><button class="btn-primary" id="addSessionBtn">Save session</button></div>' +
      '</div>' +
      '<div class="sec-label">Session History</div>' +
      sessionsHTML;

    document.getElementById('addSessionBtn').addEventListener('click', function () { addSession(c); });
    Array.prototype.forEach.call(box.querySelectorAll('.s-link.edit'), function (b) {
      b.addEventListener('click', function () { editSession(c, b.getAttribute('data-id')); });
    });
    Array.prototype.forEach.call(box.querySelectorAll('.s-link.del'), function (b) {
      b.addEventListener('click', function () { deleteSession(c, b.getAttribute('data-id')); });
    });
  }

  // ---------- tab: details / intake ----------
  var SOURCES = ['', 'Website form', 'Text message', 'Phone call', 'Instagram DM', 'Referral', 'Facebook', 'Other'];
  var STATUSES = [['new', 'New lead'], ['booked', 'Booked'], ['active', 'Active'], ['done', 'Completed']];

  function renderDetailsTab(c) {
    var box = document.getElementById('tabContent');
    var k = c.contact;
    function opt(list, val) {
      return list.map(function (o) {
        var v = Array.isArray(o) ? o[0] : o, lab = Array.isArray(o) ? o[1] : (o || '— Select —');
        return '<option value="' + esc(v) + '"' + (v === val ? ' selected' : '') + '>' + esc(lab) + '</option>';
      }).join('');
    }
    box.innerHTML =
      '<div class="form-card">' +
        '<h3>Contact &amp; Intake <span class="save-hint" id="saveHint">Saved \u2713</span></h3>' +
        '<div class="detail-grid">' +
          '<div class="field"><label>Phone</label><input type="tel" id="dPhone" value="' + esc(k.phone) + '" placeholder="(555) 123-4567"></div>' +
          '<div class="field"><label>Email</label><input type="email" id="dEmail" value="' + esc(k.email) + '" placeholder="name@email.com"></div>' +
          '<div class="field full"><label>Address</label><input type="text" id="dAddress" value="' + esc(k.address) + '" placeholder="Street, City"></div>' +
          '<div class="field"><label>How they found us</label><select id="dSource">' + opt(SOURCES, k.source) + '</select></div>' +
          '<div class="field"><label>Status</label><select id="dStatus">' + opt(STATUSES, k.status) + '</select></div>' +
          '<div class="field full"><label>What they need / notes</label><textarea id="dNeeds" placeholder="Rooms to tackle, mobility needs, pets, gate code, preferences…">' + esc(k.needs) + '</textarea></div>' +
        '</div>' +
      '</div>';

    function bind(id, key) {
      var el = document.getElementById(id);
      el.addEventListener('input', function () { c.contact[key] = el.value; save(); showSaved(); });
      el.addEventListener('change', function () { c.contact[key] = el.value; save(); showSaved(); renderSidebar(); });
    }
    bind('dEmail', 'email'); bind('dAddress', 'address');
    bind('dSource', 'source'); bind('dStatus', 'status'); bind('dNeeds', 'needs');
    // phone: live-format as (xxx) xxx-xxxx
    var phoneEl = document.getElementById('dPhone');
    phoneEl.addEventListener('input', function () {
      var caretEnd = phoneEl.selectionStart === phoneEl.value.length;
      phoneEl.value = fmtPhone(phoneEl.value);
      c.contact.phone = phoneEl.value; save(); showSaved();
      if (caretEnd) { try { phoneEl.setSelectionRange(phoneEl.value.length, phoneEl.value.length); } catch (e) {} }
    });
    phoneEl.addEventListener('change', function () { c.contact.phone = phoneEl.value; save(); renderSidebar(); });
  }

  function fmtPhone(v) {
    var d = String(v || '').replace(/\D/g, '').slice(0, 10);
    if (d.length < 4) return d;
    if (d.length < 7) return '(' + d.slice(0, 3) + ') ' + d.slice(3);
    return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
  }

  var savedT;
  function showSaved() {
    var h = document.getElementById('saveHint');
    if (!h) return;
    h.classList.add('show');
    clearTimeout(savedT);
    savedT = setTimeout(function () { h.classList.remove('show'); }, 1400);
  }

  // ---------- tab: invoice ----------
  function statusLabel(s) {
    var m = { new: 'New lead', booked: 'Booked', active: 'Active', done: 'Completed' };
    return m[s] || 'New lead';
  }

  function renderInvoiceTab(c) {
    var box = document.getElementById('tabContent');
    var inv = c.invoice;
    box.innerHTML =
      '<div class="inv-settings">' +
        '<h3>Invoice Details</h3>' +
        '<div class="frow">' +
          '<div class="field"><label>Invoice date</label><input type="date" id="iDate" value="' + esc(inv.date || todayISO()) + '"></div>' +
          '<div class="field"><label>Flat project price</label><div class="fee-wrap"><span>$</span><input type="number" id="iPrice" min="0" step="1" value="' + esc(inv.projectPrice) + '" placeholder="0"></div><span style="display:block;font-size:0.72rem;color:var(--text-muted);margin-top:5px;text-transform:none;letter-spacing:0;">(optional) — blank uses logged fees</span></div>' +
          '<div class="field"><label>Deposit received</label><div class="fee-wrap"><span>$</span><input type="number" id="iDeposit" min="0" step="1" value="' + esc(inv.deposit) + '" placeholder="0"></div></div>' +
        '</div>' +
        '<label style="display:block;font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);font-weight:500;margin-bottom:6px;">Payment status</label>' +
        '<div class="paid-toggle" id="paidToggle">' +
          '<button data-paid="false" class="' + (inv.paid ? '' : 'on-unpaid') + '">Unpaid</button>' +
          '<button data-paid="true" class="' + (inv.paid ? 'on-paid' : '') + '">Paid</button>' +
        '</div>' +
      '</div>' +
      '<div class="inv-send">' +
        '<button class="btn-send" id="pdfInvBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6M9 15h6"/></svg>Send PDF</button>' +
        '<button class="btn-prn" id="printInvBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>Print / PDF</button>' +
      '</div>' +
      '<button class="csv-link" id="textInvBtn" style="display:block;margin:-10px 0 18px;">or send as a quick text message instead</button>' +
      '<div class="invoice" id="invoiceDoc"></div>';

    document.getElementById('iDate').addEventListener('input', function (e) { inv.date = e.target.value; save(); drawInvoice(c); });
    document.getElementById('iPrice').addEventListener('input', function (e) { inv.projectPrice = e.target.value; save(); drawInvoice(c); });
    document.getElementById('iDeposit').addEventListener('input', function (e) { inv.deposit = e.target.value; save(); drawInvoice(c); });
    document.getElementById('printInvBtn').addEventListener('click', function () { window.print(); });
    document.getElementById('pdfInvBtn').addEventListener('click', function () { sharePDF(c); });
    document.getElementById('textInvBtn').addEventListener('click', function () { shareInvoice(c); });
    Array.prototype.forEach.call(document.querySelectorAll('#paidToggle button'), function (b) {
      b.addEventListener('click', function () {
        inv.paid = b.getAttribute('data-paid') === 'true';
        save();
        document.querySelector('#paidToggle [data-paid="false"]').className = inv.paid ? '' : 'on-unpaid';
        document.querySelector('#paidToggle [data-paid="true"]').className = inv.paid ? 'on-paid' : '';
        drawInvoice(c);
      });
    });

    drawInvoice(c);
  }

  function invoiceText(c) {
    var inv = c.invoice;
    var sessionTotal = c.sessions.reduce(function (a, s) { return a + (Number(s.fee) || 0); }, 0);
    var flat = inv.projectPrice !== '' && inv.projectPrice != null ? Number(inv.projectPrice) || 0 : null;
    var billed = flat != null ? flat : sessionTotal;
    var deposit = Number(inv.deposit) || 0;
    var balance = billed - deposit;
    var dated = c.sessions.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var L = [];
    L.push('RESTORED SPACES — Invoice');
    L.push(fmtDate(inv.date || todayISO()));
    L.push('');
    L.push('Bill to: ' + c.name);
    L.push('');
    if (flat != null) {
      L.push('Decluttering & organizing (flat rate) ... ' + money(billed));
    } else if (dated.length) {
      dated.forEach(function (s) {
        L.push(fmtDate(s.date) + (s.notes ? ' — ' + s.notes : '') + ' ... ' + money(s.fee));
      });
    }
    L.push('');
    L.push('Subtotal: ' + money(billed));
    if (deposit) L.push('Deposit received: −' + money(deposit));
    L.push((inv.paid ? 'PAID IN FULL' : 'Balance due') + ': ' + money(inv.paid ? 0 : balance));
    L.push('');
    L.push('Thank you! — Restored Spaces');
    L.push('Questions? Call or text (559) 777-0748');
    L.push('restoredspacesco.com · @restoredspacesco');
    return L.join('\n');
  }

  function shareInvoice(c) {
    var text = invoiceText(c);
    var title = 'Restored Spaces — Invoice for ' + c.name;
    if (navigator.share) {
      navigator.share({ title: title, text: text }).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        flash('Invoice copied — paste it into a text or email.');
      }, function () { fallbackMail(c, text); });
    } else {
      fallbackMail(c, text);
    }
  }

  function fallbackMail(c, text) {
    var to = c.contact && c.contact.email ? encodeURIComponent(c.contact.email) : '';
    var subj = encodeURIComponent('Invoice from Restored Spaces');
    window.location.href = 'mailto:' + to + '?subject=' + subj + '&body=' + encodeURIComponent(text);
  }

  // ---------- PDF invoice (crisp vector, share-sheet ready) ----------
  function invoiceNums(c) {
    var inv = c.invoice;
    var sessionTotal = c.sessions.reduce(function (a, s) { return a + (Number(s.fee) || 0); }, 0);
    var flat = inv.projectPrice !== '' && inv.projectPrice != null ? Number(inv.projectPrice) || 0 : null;
    var billed = flat != null ? flat : sessionTotal;
    var deposit = Number(inv.deposit) || 0;
    return { flat: flat, billed: billed, deposit: deposit, balance: billed - deposit,
             dated: c.sessions.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }) };
  }

  function sharePDF(c) {
    var JS = window.jspdf && window.jspdf.jsPDF;
    if (!JS) { flash('Opening print view \u2014 choose Save as PDF.'); window.print(); return; }
    var inv = c.invoice, k = c.contact, n = invoiceNums(c), paid = !!inv.paid;
    var doc = new JS({ unit: 'pt', format: 'letter' });
    var L = 54, R = 558;

    // header: logo + name
    doc.setFillColor(90, 115, 84); doc.roundedRect(L, 54, 46, 46, 10, 10, 'F');
    doc.setTextColor(247, 243, 237); doc.setFont('times', 'normal'); doc.setFontSize(22);
    doc.text('RS', L + 23, 84, { align: 'center' });
    doc.setTextColor(46, 42, 37); doc.setFont('times', 'normal'); doc.setFontSize(20);
    doc.text('Restored Spaces', L + 58, 76);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(107, 98, 89);
    doc.text('restoredspacesco.com   \u00b7   @restoredspacesco', L + 58, 92);

    // header right: Invoice + date + stamp
    doc.setFont('times', 'normal'); doc.setFontSize(28); doc.setTextColor(46, 42, 37);
    doc.text('Invoice', R, 78, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(107, 98, 89);
    doc.text(fmtDate(inv.date || todayISO()), R, 96, { align: 'right' });
    var stamp = paid ? 'PAID' : 'UNPAID';
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    var sw = doc.getTextWidth(stamp) + 22, sx = R - sw, sy = 104;
    if (paid) { doc.setFillColor(223, 231, 218); doc.setTextColor(90, 115, 84); }
    else { doc.setFillColor(238, 228, 216); doc.setTextColor(139, 111, 92); }
    doc.roundedRect(sx, sy, sw, 18, 9, 9, 'F');
    doc.text(stamp, sx + sw / 2, sy + 12.4, { align: 'center' });

    doc.setDrawColor(214, 224, 210); doc.setLineWidth(1); doc.line(L, 136, R, 136);

    // bill to
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(125, 155, 118);
    doc.text('BILL TO', L, 162);
    doc.setFont('times', 'normal'); doc.setFontSize(13); doc.setTextColor(46, 42, 37);
    doc.text(c.name || 'Client', L, 180);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(107, 98, 89);
    var by = 196;
    [k.address, k.phone, k.email].filter(Boolean).forEach(function (l) { doc.text(String(l), L, by); by += 14; });

    // line items
    var y = Math.max(by, 212) + 18;
    function row(main, sub, amount) {
      doc.setFont('times', 'normal'); doc.setFontSize(11.5); doc.setTextColor(46, 42, 37);
      doc.text(main, L, y);
      doc.text(money(amount), R, y, { align: 'right' });
      var subH = 0;
      if (sub) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(107, 98, 89);
        var w = doc.splitTextToSize(sub, 360);
        doc.text(w, L, y + 13); subH = w.length * 11;
      }
      y += 16 + subH + 10;
      doc.setDrawColor(228, 233, 225); doc.setLineWidth(0.7); doc.line(L, y - 9, R, y - 9);
    }
    if (n.flat != null) {
      var dl = n.dated.map(function (s) { return fmtDate(s.date); }).join('   \u00b7   ');
      row('Decluttering & organizing \u2014 flat project rate',
        n.dated.length ? (n.dated.length + ' session' + (n.dated.length === 1 ? '' : 's') + ': ' + dl) : '', n.billed);
    } else if (n.dated.length) {
      n.dated.forEach(function (s) {
        var sub = (s.notes || '') + (s.hours ? (s.notes ? '   \u00b7   ' : '') + s.hours + ' hr' + (Number(s.hours) === 1 ? '' : 's') : '');
        row(fmtDate(s.date), sub, Number(s.fee) || 0);
      });
    } else {
      row('No sessions logged yet', '', 0);
    }

    // totals
    y += 8;
    function tot(label, val, big) {
      doc.setFont(big ? 'times' : 'helvetica', 'normal'); doc.setFontSize(big ? 15 : 10.5);
      doc.setTextColor(big ? 46 : 107, big ? 42 : 98, big ? 37 : 89);
      doc.text(label, 360, y);
      doc.setTextColor(big ? 90 : 107, big ? 115 : 98, big ? 84 : 89);
      doc.text(val, R, y, { align: 'right' });
      y += big ? 24 : 18;
    }
    tot('Subtotal', money(n.billed), false);
    if (n.deposit) tot('Deposit received', '\u2212 ' + money(n.deposit), false);
    doc.setDrawColor(190, 200, 186); doc.setLineWidth(1.2); doc.line(360, y - 6, R, y - 6); y += 10;
    tot(paid ? 'Paid in full' : 'Balance due', money(paid ? 0 : n.balance), true);

    // footer
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(107, 98, 89);
    doc.text('Thank you!  Restored Spaces \u2014 restoring peace to your home, one space at a time.', L, 762);
    doc.setTextColor(46, 42, 37); doc.text('Questions? Call or text (559) 777-0748', L, 776);

    // share or save
    var fname = 'Invoice - ' + (c.name || 'Client').replace(/[^\w \-]/g, '') + '.pdf';
    var blob = doc.output('blob');
    var file = new File([blob], fname, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Restored Spaces Invoice', text: 'Here is your invoice from Restored Spaces.' }).catch(function () {});
    } else {
      doc.save(fname);
      flash('PDF saved \u2014 attach it to a text or email.');
    }
  }

  function drawInvoice(c) {
    var doc = document.getElementById('invoiceDoc');
    if (!doc) return;
    var inv = c.invoice, k = c.contact;
    var sessionTotal = c.sessions.reduce(function (a, s) { return a + (Number(s.fee) || 0); }, 0);
    var flat = inv.projectPrice !== '' && inv.projectPrice != null ? Number(inv.projectPrice) || 0 : null;
    var billed = flat != null ? flat : sessionTotal;
    var deposit = Number(inv.deposit) || 0;
    var balance = billed - deposit;

    var dated = c.sessions.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var linesHTML;
    if (flat != null) {
      var dl = dated.map(function (s) { return fmtDate(s.date); }).join(' \u00b7 ');
      linesHTML =
        '<div class="inv-line"><div class="inv-desc">Decluttering &amp; organizing \u2014 flat project rate' +
        (dl ? '<div class="sub">' + (dated.length) + ' session' + (dated.length === 1 ? '' : 's') + ': ' + dl + '</div>' : '') +
        '</div><div class="inv-amt">' + money(billed) + '</div></div>';
    } else if (dated.length) {
      linesHTML = dated.map(function (s) {
        return '<div class="inv-line"><div class="inv-desc">' + fmtDate(s.date) +
          (s.notes ? '<div class="sub">' + esc(s.notes) + '</div>' : '') +
          (s.hours ? '<div class="sub">' + esc(s.hours) + ' hr' + (Number(s.hours) === 1 ? '' : 's') + '</div>' : '') +
          '</div><div class="inv-amt">' + money(s.fee) + '</div></div>';
      }).join('');
    } else {
      linesHTML = '<div class="inv-line"><div class="inv-desc" style="color:var(--text-muted);">No sessions logged yet \u2014 add sessions or a flat project price.</div><div class="inv-amt">' + money(0) + '</div></div>';
    }

    var billToAddr = [k.address, k.phone].filter(Boolean).join('  \u00b7  ');

    doc.innerHTML =
      '<div class="inv-top">' +
        '<div class="inv-from"><div class="inv-rs">RS</div><div><div class="nm">Restored Spaces</div>' +
        '<div class="tg">restoredspacesco.com \u00b7 @restoredspacesco</div></div></div>' +
        '<div class="inv-meta"><div class="lbl">Invoice</div>' +
        '<div class="sub">' + fmtDate(inv.date || todayISO()) + '</div>' +
        '<div class="inv-status-stamp ' + (inv.paid ? 'stamp-paid' : 'stamp-unpaid') + '">' + (inv.paid ? 'Paid' : 'Unpaid') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="inv-billto"><div class="cap">Bill to</div><div class="who">' + esc(c.name) + '</div>' +
        (billToAddr ? '<div class="addr">' + esc(billToAddr) + '</div>' : '') +
      '</div>' +
      '<div class="inv-lines">' + linesHTML + '</div>' +
      '<div class="inv-totals">' +
        '<div class="inv-trow"><span>Subtotal</span><span class="amt">' + money(billed) + '</span></div>' +
        (deposit ? '<div class="inv-trow"><span>Deposit received</span><span class="amt">\u2212 ' + money(deposit) + '</span></div>' : '') +
        '<div class="inv-trow due"><span class="lab">' + (inv.paid ? 'Paid in full' : 'Balance due') + '</span><span class="amt">' + money(inv.paid ? 0 : balance) + '</span></div>' +
      '</div>' +
      '<div class="inv-foot">Thank you! Please send payment at your convenience. Restored Spaces \u2014 restoring peace to your home, one space at a time.<br><span style="color:var(--text);">Questions? Call or text (559) 777-0748</span></div>';
  }

  function renderAll() { renderSidebar(); renderMain(); renderBackupBar(); }

  // ---------- backup / restore / export ----------
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 120);
  }

  function exportBackup() {
    var payload = { app: 'restored-spaces-logbook', version: 1, exported: new Date().toISOString(), data: data };
    download('restored-spaces-backup-' + todayISO() + '.json', JSON.stringify(payload, null, 2), 'application/json');
    localStorage.setItem(BKEY, Date.now());
    flash('Backup saved \u2014 keep it in iCloud Drive.');
    renderBackupBar();
  }

  function triggerImport() { document.getElementById('importFile').click(); }

  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        var incoming = parsed && parsed.data ? parsed.data : parsed;
        if (!incoming || !Array.isArray(incoming.clients)) throw new Error('bad');
        var n = incoming.clients.length;
        if (!confirm('Restore ' + n + ' client(s) from this backup? This replaces what\u2019s currently saved on this phone.')) return;
        data = incoming;
        selectedId = null; localStorage.removeItem(SELKEY);
        document.body.setAttribute('data-view', 'list');
        save();
        renderAll();
        flash('Restored ' + n + ' client(s).');
      } catch (e) {
        alert('That file doesn\u2019t look like a logbook backup. Please choose the .json backup file you saved.');
      }
    };
    reader.readAsText(file);
  }

  function csvCell(s) { s = String(s == null ? '' : s); return '"' + s.replace(/"/g, '""') + '"'; }
  function exportCSV() {
    if (!data.clients.length) { flash('No data to export yet.'); return; }
    var rows = [['Client', 'Phone', 'Email', 'Address', 'Source', 'Status', 'Date', 'Hours', 'Fee', 'Notes', 'Payment']];
    data.clients.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (c) {
      ensureClient(c);
      var k = c.contact, inv = c.invoice;
      var pay = inv.paid ? 'Paid' : 'Unpaid';
      var sorted = c.sessions.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      if (sorted.length) {
        sorted.forEach(function (s) {
          rows.push([c.name, k.phone, k.email, k.address, k.source, statusLabel(k.status), s.date, s.hours || '', s.fee || '', s.notes || '', pay]);
        });
      } else {
        rows.push([c.name, k.phone, k.email, k.address, k.source, statusLabel(k.status), '', '', '', '(no sessions yet)', pay]);
      }
    });
    var csv = rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
    download('restored-spaces-sessions-' + todayISO() + '.csv', csv, 'text/csv');
    flash('Spreadsheet exported.');
  }

  function renderBackupBar() {
    var foot = document.getElementById('sideFoot');
    if (!foot) return;
    var last = Number(localStorage.getItem(BKEY)) || 0;
    var cls = 'never', label = 'Never backed up';
    if (last) {
      var days = Math.floor((Date.now() - last) / 86400000);
      label = 'Backed up ' + (days <= 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago');
      cls = days >= 7 ? 'warn' : 'ok';
    }
    foot.innerHTML =
      '<div class="backup-status ' + cls + '"><span class="dot"></span>' + label + '</div>' +
      '<div class="backup-btns"><button class="primary" id="backupBtn">Back up</button>' +
      '<button id="restoreBtn">Restore</button></div>' +
      '<button class="csv-link" id="csvBtn">Export spreadsheet (CSV)</button>';
    document.getElementById('backupBtn').addEventListener('click', exportBackup);
    document.getElementById('restoreBtn').addEventListener('click', triggerImport);
    document.getElementById('csvBtn').addEventListener('click', exportCSV);
  }

  // ---------- actions ----------
  function selectClient(id) {
    selectedId = id;
    activeTab = 'details';
    localStorage.setItem(SELKEY, id);
    document.body.setAttribute('data-view', 'detail');
    renderAll();
  }

  function addSession(c) {
    var date = document.getElementById('fDate').value || todayISO();
    var hours = document.getElementById('fHours').value;
    var fee = document.getElementById('fFee').value;
    var notes = document.getElementById('fNotes').value.trim();
    if (!hours && !fee && !notes) {
      flash('Add hours, a fee, or notes before saving.');
      return;
    }
    c.sessions.push({ id: uid(), date: date, hours: hours, fee: fee, notes: notes, created: Date.now() });
    save();
    renderAll();
  }

  function editSession(c, sid) {
    var s = c.sessions.find(function (x) { return x.id === sid; });
    if (!s) return;
    var card = document.querySelector('.session[data-id="' + sid + '"]');
    card.innerHTML =
      '<div class="frow">' +
        '<div class="field"><label>Date</label><input type="date" id="eDate" value="' + esc(s.date) + '"></div>' +
        '<div class="field"><label>Hours</label><input type="number" id="eHours" min="0" step="0.25" value="' + esc(s.hours) + '"></div>' +
        '<div class="field"><label>Fee</label><div class="fee-wrap"><span>$</span><input type="number" id="eFee" min="0" step="1" value="' + esc(s.fee) + '"></div></div>' +
      '</div>' +
      '<div class="field"><label>What we worked on</label><textarea id="eNotes">' + esc(s.notes) + '</textarea></div>' +
      '<div class="form-actions" style="margin-top:14px;"><button class="btn-ghost" id="eCancel">Cancel</button><button class="btn-primary" id="eSave">Save changes</button></div>';
    document.getElementById('eCancel').addEventListener('click', renderMain);
    document.getElementById('eSave').addEventListener('click', function () {
      s.date = document.getElementById('eDate').value || s.date;
      s.hours = document.getElementById('eHours').value;
      s.fee = document.getElementById('eFee').value;
      s.notes = document.getElementById('eNotes').value.trim();
      save();
      renderAll();
    });
  }

  function deleteSession(c, sid) {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    c.sessions = c.sessions.filter(function (x) { return x.id !== sid; });
    save();
    renderAll();
  }

  function deleteClient(c) {
    if (!confirm('Delete "' + c.name + '" and all ' + c.sessions.length + ' session(s)? This cannot be undone.')) return;
    data.clients = data.clients.filter(function (x) { return x.id !== c.id; });
    if (selectedId === c.id) { selectedId = null; localStorage.removeItem(SELKEY); }
    document.body.setAttribute('data-view', 'list');
    save();
    renderAll();
  }

  // ---------- modal (add / rename client) ----------
  var modalMode = 'add';
  var modalClient = null;
  function openModal(mode, client) {
    modalMode = mode; modalClient = client || null;
    document.getElementById('modalTitle').textContent = mode === 'add' ? 'New client' : 'Rename client';
    document.getElementById('modalDesc').textContent = mode === 'add'
      ? 'Add a client to start their logbook.' : 'Update this client\u2019s name.';
    var input = document.getElementById('modalInput');
    input.value = mode === 'rename' && client ? client.name : '';
    document.getElementById('overlay').classList.add('show');
    setTimeout(function () { input.focus(); }, 30);
  }
  function closeModal() { document.getElementById('overlay').classList.remove('show'); }
  function saveModal() {
    var name = document.getElementById('modalInput').value.trim();
    if (!name) { document.getElementById('modalInput').focus(); return; }
    if (modalMode === 'add') {
      var c = { id: uid(), name: name, created: Date.now(), sessions: [] };
      data.clients.push(c);
      selectedId = c.id; localStorage.setItem(SELKEY, c.id);
      document.body.setAttribute('data-view', 'detail');
    } else if (modalClient) {
      modalClient.name = name;
    }
    save();
    closeModal();
    renderAll();
  }

  // ---------- tiny toast ----------
  var toastT;
  function flash(msg) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.style.cssText = 'position:fixed;bottom:26px;left:50%;transform:translateX(-50%);background:var(--text);color:var(--cream);padding:11px 22px;border-radius:100px;font-size:0.85rem;z-index:80;box-shadow:0 8px 30px rgba(0,0,0,.2);transition:opacity .2s;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(toastT);
    toastT = setTimeout(function () { el.style.opacity = '0'; }, 2400);
  }

  // ---------- bind global ----------
  document.getElementById('addClientBtn').addEventListener('click', function () { openModal('add'); });
  (function () {
    var s = document.getElementById('clientSearch');
    if (s) s.addEventListener('input', function () { clientFilter = s.value.trim(); renderSidebar(); });
  })();
  document.getElementById('importFile').addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) { importBackup(e.target.files[0]); e.target.value = ''; }
  });
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalSave').addEventListener('click', saveModal);
  document.getElementById('modalInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') saveModal(); });
  document.getElementById('overlay').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  renderAll();
})();
