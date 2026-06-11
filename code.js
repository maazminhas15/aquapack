/**
 * Aqua Pack - Water Delivery ERP System
 * Production-Ready | Mobile-Optimized | Auto-Sync
 * CLEANED: Fixed all syntax errors, invisible spaces, and sync logic.
 */

let state = { clients: [], routes: [], expenses: [], invoices: [], config: { webAppUrl: '', lastSync: null } };

document.addEventListener("DOMContentLoaded", () => {
    loadLocalState();
    setupNavigation();
    setupAutocomplete();
    dashboard.init();
    routeSheet.init();
    clientsTab.init();
    invoicesTab.init();
    expensesTab.init();
    syncApp.init();
    setInterval(() => { if (state.config.webAppUrl) syncApp.autoSync(); }, 45000);
    backupApp.checkSundayReminder();
    if (!state.staff) state.staff = [];
    if (!state.salaryPayments) state.salaryPayments = [];
    staffTab.renderStats();
});

function loadLocalState() {
    try {
        const c = localStorage.getItem("aqua_clients");
        const r = localStorage.getItem("aqua_routes");
        const e = localStorage.getItem("aqua_expenses");
        const i = localStorage.getItem("aqua_invoices");
        const cfg = localStorage.getItem("aqua_config");
        state.clients  = c ? JSON.parse(c) : [];
        state.routes   = r ? JSON.parse(r) : [];
        state.expenses = e ? JSON.parse(e) : [];
        state.invoices = i ? JSON.parse(i) : [];
        state.config   = cfg ? JSON.parse(cfg) : { webAppUrl: '', lastSync: null };
    } catch (err) { console.error("Load error:", err); showToast("Failed to load data", true); }
}

function saveLocalState() {
    try {
        localStorage.setItem("aqua_clients", JSON.stringify(state.clients));
        localStorage.setItem("aqua_routes", JSON.stringify(state.routes));
        localStorage.setItem("aqua_expenses", JSON.stringify(state.expenses));
        localStorage.setItem("aqua_invoices", JSON.stringify(state.invoices));
        localStorage.setItem("aqua_config", JSON.stringify(state.config));
    } catch (err) { console.error("Save error:", err); showToast("Failed to save data", true); }
}

function showToast(msg, isError = false) {
    const toast = document.getElementById("toast");
    const text = document.getElementById("toastMsg");
    const icon = document.getElementById("toastIcon");
    if (!toast) return;
    text.innerText = msg;
    toast.className = `toast show ${isError ? 'toast-error' : ''}`;
    icon.className = `fa-solid ${isError ? 'fa-circle-xmark' : 'fa-circle-check'} text-xl`;
    setTimeout(() => toast.classList.remove("show"), 3500);
}

function showModal(title, contentHTML, onSaveCallback) {
    const existing = document.getElementById("dynamicModal");
    if (existing) existing.remove();
    const modal = document.createElement("div");
    modal.id = "dynamicModal";
    modal.className = "modal-overlay show";
    modal.innerHTML = `
        <div class="modal-container">
            <div class="modal-header">
                <span class="modal-title">${title}</span>
                <button class="modal-close-btn" data-dyn-close><i class="fa-solid fa-times"></i></button>
            </div>
            <div class="modal-body">${contentHTML}</div>
            ${onSaveCallback ? `
            <div class="modal-footer">
                <button class="btn-secondary" data-dyn-cancel>Cancel</button>
                <button class="btn-primary" data-dyn-save>Save</button>
            </div>` : ''}
        </div>`;
    document.body.appendChild(modal);
    modal.querySelector("[data-dyn-close]").onclick = () => modal.remove();
    if (modal.querySelector("[data-dyn-cancel]")) modal.querySelector("[data-dyn-cancel]").onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    if (onSaveCallback) modal.querySelector("[data-dyn-save]").onclick = () => {
        const result = onSaveCallback();
        if (result !== false) modal.remove();
    };
}

function todayStr() { return new Date().toISOString().split('T')[0]; }
function fmtPKR(val) { return `PKR ${Number(val || 0).toLocaleString('en-PK')}`; }
function fmtDate(dateStr) {
    if (!dateStr) return '-';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const [yr, mn, dy] = dateStr.split('-');
    if (!yr || !mn || !dy) return dateStr;
    return `${parseInt(dy)} ${months[parseInt(mn)-1]} ${yr}`;
}

// Recalculate a client's true outstanding balance from routes minus invoice payments
function recalcClientBalance(clientId) {
    // Sum all unpaid delivery balances from routes
    let routeBalance = 0;
    state.routes.forEach(r => {
        (r.deliveries || []).forEach(d => {
            if (d.clientId === clientId) routeBalance += Number(d.balance || 0);
        });
    });
    // Subtract all invoice payments already received for this client
    let paidViaInvoices = 0;
    state.invoices.forEach(inv => {
        if (inv.clientId === clientId) {
            paidViaInvoices += Number(inv.amountPaid || 0);
        }
    });
    return Math.max(0, routeBalance - paidViaInvoices);
}

function getZone(address) {
    const zones = {
        'PWD':['pwd','p.w.d'],'Gulzar-e-Quaid':['gulzar','gulzara','quaid'],
        '6th Road':['6th road','sixth road'],'Ghori Town':['ghori'],
        'Jinnah Garden':['jinnah garden','jinnah'],'Bahria Town':['bahria'],
        'Media Town':['media town'],'Pakistan Town':['pakistan town'],
        'Alipur':['alipur'],'Rawat':['rawat'],'Tramri':['tramri'],'Khanapull':['khanapull']
    };
    const addrLower = (address || '').toLowerCase();
    for (const [zone, keywords] of Object.entries(zones)) {
        if (keywords.some(k => addrLower.includes(k))) return zone;
    }
    return 'Other';
}

function setupNavigation() {
    const items = document.querySelectorAll(".nav-item[data-tab]");
    const contents = document.querySelectorAll(".tab-content");
    items.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const tabId = item.getAttribute("data-tab");
            items.forEach(i => i.classList.remove("active"));
            item.classList.add("active");
            contents.forEach(c => { c.classList.remove("active"); if (c.id === tabId) c.classList.add("active"); });
            if (tabId === "dashboard") dashboard.render();
            if (tabId === "routes") { routeSheet.renderArchive(); routeSheet.renderRows(); }
            if (tabId === "staff") { staffTab.init(); }
            if (tabId === "clients") clientsTab.renderList();
            if (tabId === "invoices") { invoicesTab.renderClientGrid(); invoicesTab.renderList(); }
            if (tabId === "expenses") expensesTab.renderList();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

function setupAutocomplete() {
    function bind(inputId, listId, filterFn, onSelect, allowNew = false) {
        const inp = document.getElementById(inputId);
        const lst = document.getElementById(listId);
        if (!inp || !lst) return;
        let selectedIndex = -1, suggestions = [];
        
        inp.addEventListener("input", () => {
            const q = inp.value.trim().toLowerCase();
            lst.innerHTML = "";
            selectedIndex = -1;
            if (!q) { lst.classList.remove("show"); return; }
            suggestions = filterFn(q);
            
            if (suggestions.length === 0 && allowNew) {
                const div = document.createElement("div");
                div.className = "autocomplete-item";
                div.style.color = "#10b981";
                div.innerHTML = `<i class="fa-solid fa-plus"></i> Add new: <strong>${inp.value}</strong>`;
                div.onclick = () => { lst.classList.remove("show"); routeSheet.promptNewClient(inp.value); };
                lst.appendChild(div);
                lst.classList.add("show");
                return;
            }
            if (suggestions.length === 0) { lst.classList.remove("show"); return; }
            
            suggestions.forEach((client, idx) => {
                const row = document.createElement("div");
                row.className = "autocomplete-item";
                row.dataset.index = idx;
                const zone = getZone(client.address || '');
                row.innerHTML = `
                    <div class="flex items-center justify-between w-full">
                        <div><strong>${client.name}</strong><div class="text-xs text-gray-400">${client.address || ''}</div></div>
                        <div class="flex flex-col items-end gap-1">
                            <span class="badge ${client.type === 'Daily' ? 'badge-daily' : 'badge-monthly'}">${client.type}</span>
                            <span class="zone-tag">${zone}</span>
                        </div>
                    </div>`;
                row.onclick = () => { onSelect(client); inp.value = ""; lst.classList.remove("show"); };
                lst.appendChild(row);
            });
            lst.classList.add("show");
        });

        inp.addEventListener("keydown", (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1); updateSelection(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); selectedIndex = Math.max(selectedIndex - 1, 0); updateSelection(); }
            else if (e.key === 'Enter' && selectedIndex >= 0) { e.preventDefault(); onSelect(suggestions[selectedIndex]); inp.value = ""; lst.classList.remove("show"); }
            else if (e.key === 'Escape') { lst.classList.remove("show"); }
        });

        function updateSelection() {
            const items = lst.querySelectorAll('.autocomplete-item');
            items.forEach((item, idx) => { 
                if (idx === selectedIndex) { item.classList.add('active'); item.scrollIntoView({ block: 'nearest' }); } 
                else { item.classList.remove('active'); } 
            });
        }
        document.addEventListener("click", (e) => { if (e.target !== inp && !lst.contains(e.target)) lst.classList.remove("show"); });
    }

    const clientFilter = (q) => state.clients.filter(c => c.name.toLowerCase().includes(q) || (c.address || '').toLowerCase().includes(q)).slice(0, 10);
    bind("clientSearchAdd", "clientSearchSuggestions", clientFilter, (client) => routeSheet.addDeliveryRow(client), true);
    bind("invoiceClientSearch", "invoiceClientSuggestions", clientFilter, (client) => {
        document.getElementById("invoiceClientSearch").value = client.name;
        document.getElementById("invoiceClientSearch").setAttribute("data-client-id", client.id);
        invoicesTab.selectClient(client.id);
    });
}

// ==========================================
// DASHBOARD MODULE
// ==========================================
const dashboard = {
    filterType: 'all',
    salesChart: null,
    breakdownChart: null,
    amountsHidden: false,
    init() {
        document.getElementById("dateFilterSelect").value = todayStr();
        document.getElementById("monthFilterSelect").value = todayStr().substring(0, 7);
        this.render();
    },
    toggleAmounts() {
        this.amountsHidden = !this.amountsHidden;
        const icon  = document.getElementById('balanceToggleIcon');
        const label = document.getElementById('balanceToggleLabel');
        if (icon)  icon.className  = this.amountsHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
        if (label) label.textContent = this.amountsHidden ? 'Show' : 'Hide';
        this.render();
    },
    setFilter(type) {
        this.filterType = type;
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        const btn = document.querySelector(`.filter-btn[data-filter="${type}"]`);
        if (btn) btn.classList.add("active");
        const mEl = document.getElementById("monthFilterSelect");
        const dEl = document.getElementById("dateFilterSelect");
        if (mEl) mEl.style.display = type === 'month' ? 'inline-block' : 'none';
        if (dEl) dEl.style.display = type === 'daily' ? 'inline-block' : 'none';
        this.render();
    },
    getFilteredData() {
        const selectedDate = document.getElementById("dateFilterSelect")?.value || "";
        const selectedMonth = document.getElementById("monthFilterSelect")?.value || "";
        let routes = [...state.routes], expenses = [...state.expenses];
        if (this.filterType === 'daily' && selectedDate) {
            routes = state.routes.filter(r => r.date === selectedDate);
            expenses = state.expenses.filter(e => e.date === selectedDate);
        } else if (this.filterType === 'month' && selectedMonth) {
            routes = state.routes.filter(r => r.date.startsWith(selectedMonth));
            expenses = state.expenses.filter(e => e.date.startsWith(selectedMonth));
        }
        return { routes, expenses };
    },
    render() {
        const { routes, expenses } = this.getFilteredData();
        let totalSales = 0, totalBottles = 0, totalRouteExpenses = 0, collectedCash = 0;
        
        routes.forEach(r => {
            totalSales += Number(r.totalVal || 0);
            totalBottles += Number(r.totalQty || 0);
            collectedCash += Number(r.collectedCash || 0);
            totalRouteExpenses += Number(r.fuel || 0) + Number(r.food || 0) + Number(r.other || 0);
        });
        let totalExpenses = totalRouteExpenses;
        expenses.forEach(e => totalExpenses += Number(e.amount || 0));

        let invoicePaymentsReceived = 0;
        const selectedDate = document.getElementById("dateFilterSelect")?.value || "";
        const selectedMonth = document.getElementById("monthFilterSelect")?.value || "";
        state.invoices.forEach(inv => {
            (inv.payments || []).forEach(p => {
                if (this.filterType === 'all') invoicePaymentsReceived += Number(p.amount || 0);
                else if (this.filterType === 'daily' && p.date === selectedDate) invoicePaymentsReceived += Number(p.amount || 0);
                else if (this.filterType === 'month' && p.date?.startsWith(selectedMonth)) invoicePaymentsReceived += Number(p.amount || 0);
            });
        });

        // Balance card: filtered by period when monthly/daily selected
        // All Time = total outstanding across all clients
        // Monthly/Daily = balance ADDED in that period minus payments received in that period
        let totalBalance = 0;
        if (this.filterType === 'all') {
            // All time: real live outstanding balance per client
            totalBalance = state.clients.reduce((a, c) => a + recalcClientBalance(c.id), 0);
        } else {
            // Filtered: sum of unpaid delivery balances added in this period
            // minus any invoice payments received in this period
            routes.forEach(r => {
                (r.deliveries || []).forEach(d => {
                    totalBalance += Number(d.balance || 0);
                });
            });
            totalBalance = Math.max(0, totalBalance - invoicePaymentsReceived);
        }
        // Net profit = cash collected from routes + invoice payments received - all expenses
        const netProfit = collectedCash + invoicePaymentsReceived - totalExpenses;

        this.setCardMasked("cardSales", fmtPKR(totalSales));
        this.setCard("cardBottles", totalBottles.toLocaleString());
        this.setCardMasked("cardExpenses", fmtPKR(totalExpenses));
        this.setCardMasked("cardBalance", fmtPKR(totalBalance));

        const profitEl = document.getElementById("cardProfit");
        if (profitEl) { 
            profitEl.innerText = this.amountsHidden ? '****' : fmtPKR(netProfit); 
            profitEl.style.color = netProfit >= 0 ? '#10b981' : '#ef4444'; 
        }
        
        const clientsEl = document.getElementById("cardClients");
        if (clientsEl) clientsEl.innerText = state.clients.length;

        this.renderCharts(routes);
        this.renderOutstandingTable();
    },
    setCard(id, val) { const el = document.getElementById(id); if (el) el.innerText = this.amountsHidden && val !== el.innerText ? '****' : val; },
    setCardMasked(id, val) { const el = document.getElementById(id); if (el) el.innerText = this.amountsHidden ? '****' : val; },
    renderOutstandingTable() {
        const tbody = document.getElementById("topOutstandingBody");
        if (!tbody) return;
        tbody.innerHTML = "";
        const sorted = [...state.clients].filter(c => Number(c.balance) > 0).sort((a, b) => Number(b.balance) - Number(a.balance)).slice(0, 8);
        if (sorted.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:2rem;">No outstanding balances</td></tr>`; return; }
        sorted.forEach(c => {
            const tr = document.createElement("tr");
            tr.className = "table-row border-b border-gray-800";
            tr.innerHTML = `
                <td class="py-3"><strong>${c.name}</strong></td>
                <td class="py-3 hide-mobile text-gray-400">${c.address || '-'}</td>
                <td class="py-3"><span class="badge ${c.type === 'Daily' ? 'badge-daily' : 'badge-monthly'}">${c.type}</span></td>
                <td class="py-3 text-amber-400 font-bold">${fmtPKR(c.balance)}</td>
                <td class="py-3"><button class="btn-secondary" onclick="clientsTab.viewProfile('${c.id}')"><i class="fa-solid fa-eye"></i> View</button></td>`;
            tbody.appendChild(tr);
        });
    },
    renderCharts(routes) {
        const ctxLine = document.getElementById("salesTrendChart")?.getContext("2d");
        const ctxPie = document.getElementById("bottlesBreakdownChart")?.getContext("2d");
        if (!ctxLine || !ctxPie) return;
        if (this.salesChart) this.salesChart.destroy();
        if (this.breakdownChart) this.breakdownChart.destroy();

        const sorted = [...routes].sort((a, b) => new Date(a.date) - new Date(b.date));
        const labels = sorted.map(r => r.date.substring(5));
        const salesData = sorted.map(r => r.totalVal || 0);
        const profitData = sorted.map(r => (r.collectedCash || 0) - ((r.fuel || 0) + (r.food || 0) + (r.other || 0)));

        this.salesChart = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: labels.length ? labels : ['No Data'],
                datasets: [
                    { label: 'Gross Sales', data: salesData.length ? salesData : [0], borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,0.1)', fill: true, tension: 0.4 },
                    { label: 'Net Profit', data: profitData.length ? profitData : [0], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#94a3b8' } } },
                scales: { x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } }, y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } } }
            }
        });

        let cash = 0, credit = 0, monthly = 0;
        routes.forEach(r => (r.deliveries || []).forEach(d => {
            if (d.remarks === 'Cash') cash += Number(d.qty || 0);
            else if (d.remarks === 'Bal') credit += Number(d.qty || 0);
            else if (d.remarks === 'Monthly') monthly += Number(d.qty || 0);
        }));

        this.breakdownChart = new Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: ['Cash', 'Credit/Bal', 'Monthly'],
                datasets: [{ data: [cash, credit, monthly], backgroundColor: ['rgba(16,185,129,0.75)', 'rgba(245,158,11,0.75)', 'rgba(14,165,233,0.75)'], borderWidth: 2, borderColor: '#1e293b' }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 15 } } } }
        });
    }
};

// ==========================================
// ROUTE SHEET MODULE
// ==========================================
const routeSheet = {
    activeDeliveries: [],
    editingRouteId: null,
    init() {
        document.getElementById("routeDate").value = todayStr();
        this.clearForm(true);
        this.restoreDraft();   // restore any unsaved draft
        this.renderArchive();
        ["routeFuel", "routeFood", "routeOther", "routeStartKm", "routeEndKm"].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.addEventListener("input", () => { this.recalculateTotals(); this.saveDraft(); }); el.addEventListener("change", () => { this.recalculateTotals(); this.saveDraft(); }); }
        });
        // Auto-save draft every 10 seconds
        setInterval(() => this.saveDraft(), 10000);
    },

    // ---- Draft auto-save ----
    saveDraft() {
        const date    = document.getElementById("routeDate")?.value || '';
        const vehicle = document.getElementById("routeVehicle")?.value || '';
        const driver  = document.getElementById("routeDriver")?.value || '';
        // Only save if something has been entered
        if (!vehicle && !driver && this.activeDeliveries.length === 0) return;
        const draft = {
            date, vehicle, driver,
            fuel:    document.getElementById("routeFuel")?.value    || 0,
            food:    document.getElementById("routeFood")?.value    || 0,
            other:   document.getElementById("routeOther")?.value   || 0,
            startKm: document.getElementById("routeStartKm")?.value || 0,
            endKm:   document.getElementById("routeEndKm")?.value   || 0,
            deliveries: JSON.parse(JSON.stringify(this.activeDeliveries)),
            editingRouteId: this.editingRouteId,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem('aqua_route_draft', JSON.stringify(draft));
        this.showDraftIndicator(true);
    },

    restoreDraft() {
        try {
            const raw = localStorage.getItem('aqua_route_draft');
            if (!raw) return;
            const draft = JSON.parse(raw);
            if (!draft || (!draft.vehicle && !draft.driver && (!draft.deliveries || draft.deliveries.length === 0))) return;

            // Show restore banner
            const banner = document.createElement('div');
            banner.id = 'draftRestoreBanner';
            banner.style.cssText = 'background:#1e3a5f;border:1px solid #3b82f6;color:#e0f2fe;padding:12px 16px;border-radius:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;';
            const savedAt = draft.savedAt ? new Date(draft.savedAt).toLocaleTimeString() : '';
            banner.innerHTML = `
                <div><span style="font-weight:700;">📋 Unsaved Draft Found</span> <span style="font-size:0.8rem;color:#93c5fd;">(saved at ${savedAt})</span><br>
                <span style="font-size:0.8rem;">Driver: ${draft.driver || '-'} | Vehicle: ${draft.vehicle || '-'} | ${draft.deliveries?.length || 0} clients</span></div>
                <div style="display:flex;gap:8px;flex-shrink:0;">
                    <button onclick="routeSheet.loadDraft()" style="background:#3b82f6;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:700;font-size:0.8rem;">↩ Restore</button>
                    <button onclick="routeSheet.discardDraft()" style="background:transparent;border:1px solid #3b82f6;color:#93c5fd;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:0.8rem;">Discard</button>
                </div>`;
            const routeTab = document.getElementById('routes');
            if (routeTab) routeTab.insertBefore(banner, routeTab.firstChild);
        } catch(e) { localStorage.removeItem('aqua_route_draft'); }
    },

    loadDraft() {
        try {
            const draft = JSON.parse(localStorage.getItem('aqua_route_draft'));
            if (!draft) return;
            document.getElementById('routeDate').value    = draft.date    || todayStr();
            document.getElementById('routeVehicle').value = draft.vehicle || '';
            document.getElementById('routeDriver').value  = draft.driver  || '';
            document.getElementById('routeFuel').value    = draft.fuel    || 0;
            document.getElementById('routeFood').value    = draft.food    || 0;
            document.getElementById('routeOther').value   = draft.other   || 0;
            document.getElementById('routeStartKm').value = draft.startKm || 0;
            document.getElementById('routeEndKm').value   = draft.endKm   || 0;
            this.activeDeliveries = draft.deliveries || [];
            this.editingRouteId   = draft.editingRouteId || null;
            this.renderRows();
            this.recalculateTotals();
            if (this.editingRouteId) this.showEditBanner(draft.date);
            document.getElementById('draftRestoreBanner')?.remove();
            this.showDraftIndicator(true);
            showToast('Draft restored! Continue where you left off.');
        } catch(e) { this.discardDraft(); }
    },

    discardDraft() {
        localStorage.removeItem('aqua_route_draft');
        this.showDraftIndicator(false);
        document.getElementById('draftRestoreBanner')?.remove();
        showToast('Draft discarded.');
    },

    clearDraft() {
        localStorage.removeItem('aqua_route_draft');
        this.showDraftIndicator(false);
    },

    showDraftIndicator(show) {
        let dot = document.getElementById('routeDraftDot');
        if (!dot) {
            // Add yellow dot next to Route Sheet nav item
            const navItem = document.querySelector('.nav-item[data-tab="routes"]');
            if (navItem) {
                dot = document.createElement('span');
                dot.id = 'routeDraftDot';
                dot.style.cssText = 'display:inline-block;width:8px;height:8px;background:#f59e0b;border-radius:50%;margin-left:5px;vertical-align:middle;';
                navItem.appendChild(dot);
            }
        }
        if (dot) dot.style.display = show ? 'inline-block' : 'none';
    },
    clearForm(resetDate = false) {
        this.editingRouteId = null;
        this.hideEditBanner();
        this.activeDeliveries = [];
        ["routeVehicle", "routeDriver"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
        ["routeFuel", "routeFood", "routeOther", "routeStartKm", "routeEndKm"].forEach(id => { const el = document.getElementById(id); if (el) el.value = "0"; });
        if (resetDate) document.getElementById("routeDate").value = todayStr();
        document.getElementById("clientSearchAdd").value = "";
        this.renderRows();
    },
    promptNewClient(name) {
        document.getElementById("clientSearchSuggestions").classList.remove("show");
        showModal(`Quick Add Client: "${name}"`, `
            <div style="display:grid;gap:14px">
                <div><label class="block text-sm text-gray-400 mb-1">Name</label><input id="nc_name" class="input-field" value="${name}"></div>
                <div><label class="block text-sm text-gray-400 mb-1">Type</label><select id="nc_type" class="input-field"><option>Daily</option><option>Monthly</option></select></div>
                <div><label class="block text-sm text-gray-400 mb-1">Address / Area</label><input id="nc_addr" class="input-field" placeholder="Area or street"></div>
                <div><label class="block text-sm text-gray-400 mb-1">Phone</label><input id="nc_phone" class="input-field" placeholder="0300..."></div>
                <div><label class="block text-sm text-gray-400 mb-1">Rate per Bottle (PKR)</label><input id="nc_rate" type="number" inputmode="numeric" class="input-field" value="200"></div>
            </div>`, () => {
            const nameVal = document.getElementById("nc_name").value.trim();
            if (!nameVal) { showToast("Name required!", true); return false; }
            const newClient = {
                id: 'c_' + Date.now(), name: nameVal,
                type: document.getElementById("nc_type").value,
                address: document.getElementById("nc_addr").value.trim(),
                phone: document.getElementById("nc_phone").value.trim(),
                rate: parseFloat(document.getElementById("nc_rate").value) || 200,
                balance: 0
            };
            state.clients.push(newClient);
            saveLocalState();
            showToast(`Client "${nameVal}" added!`);
            this.addDeliveryRow(newClient);
            syncApp.autoSync();
        });
    },
    addDeliveryRow(client) {
        const exists = this.activeDeliveries.find(d => d.clientId === client.id);
        if (exists) { showToast("Client already added to this route!", true); return; }
        // Show floating quick-entry popup — no scrolling needed
        this.showQuickEntry(client);
    },

    showQuickEntry(client) {
        const balance = recalcClientBalance(client.id);  // FIX: define balance before template uses it
        const defaultRemarks = client.type === 'Monthly' ? 'Monthly' : 'Cash';
        const price = Number(client.rate) || 200;

        // Remove any existing popup
        const old = document.getElementById('quickEntryPopup');
        if (old) old.remove();

        const popup = document.createElement('div');
        popup.id = 'quickEntryPopup';
        popup.style.cssText = `
            position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
            background:#1e293b; border:1px solid #334155; border-radius:14px;
            padding:20px; z-index:99999; width:320px; max-width:95vw;
            box-shadow:0 8px 40px rgba(0,0,0,0.7);
        `;
        popup.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                    <div style="font-weight:700;font-size:1rem;color:#f1f5f9;">${client.name}</div>
                    <div style="font-size:0.75rem;color:#64748b;">${client.address || ''}</div>
                </div>
                <button onclick="document.getElementById('quickEntryPopup').remove()" 
                    style="background:#334155;border:none;color:#94a3b8;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:1rem;">✕</button>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                <div>
                    <label style="font-size:0.72rem;color:#94a3b8;display:block;margin-bottom:4px;">QTY (Bottles)</label>
                    <input id="qeQty" type="number" min="0" value="1"
                        oninput="routeSheet.qeRecalcReceived()"
                        style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:8px 10px;color:#f1f5f9;font-size:1rem;font-weight:700;">
                </div>
                <div>
                    <label style="font-size:0.72rem;color:#94a3b8;display:block;margin-bottom:4px;">Price (PKR)</label>
                    <input id="qePrice" type="number" min="0" value="${price}"
                        oninput="routeSheet.qeRecalcReceived()"
                        style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:8px 10px;color:#f1f5f9;font-size:1rem;">
                </div>
            </div>

            <div style="margin-bottom:10px;">
                <label style="font-size:0.72rem;color:#94a3b8;display:block;margin-bottom:4px;">Payment Type</label>
                <div style="display:flex;gap:8px;">
                    <button id="qeTypeCash" onclick="routeSheet.qeSetType('Cash')"
                        style="flex:1;padding:8px;border-radius:8px;border:2px solid ${defaultRemarks==='Cash'?'#10b981':'#334155'};
                        background:${defaultRemarks==='Cash'?'rgba(16,185,129,0.15)':'#0f172a'};color:#f1f5f9;cursor:pointer;font-weight:600;font-size:0.85rem;">Cash</button>
                    <button id="qeTypeBal" onclick="routeSheet.qeSetType('Bal')"
                        style="flex:1;padding:8px;border-radius:8px;border:2px solid ${defaultRemarks==='Bal'?'#f59e0b':'#334155'};
                        background:${defaultRemarks==='Bal'?'rgba(245,158,11,0.15)':'#0f172a'};color:#f1f5f9;cursor:pointer;font-weight:600;font-size:0.85rem;">Balance</button>
                    <button id="qeTypeMonthly" onclick="routeSheet.qeSetType('Monthly')"
                        style="flex:1;padding:8px;border-radius:8px;border:2px solid ${defaultRemarks==='Monthly'?'#3b82f6':'#334155'};
                        background:${defaultRemarks==='Monthly'?'rgba(59,130,246,0.15)':'#0f172a'};color:#f1f5f9;cursor:pointer;font-weight:600;font-size:0.85rem;">Monthly</button>
                </div>
            </div>

            <div style="margin-bottom:10px;">
                <label style="font-size:0.72rem;color:#94a3b8;display:block;margin-bottom:4px;">Cash Received (PKR) <span style="color:#64748b;">— for today's delivery only</span></label>
                <input id="qeReceived" type="number" min="0" value="${defaultRemarks==='Cash'?price:0}"
                    style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:8px 10px;color:#f1f5f9;font-size:1rem;">
            </div>

            ${balance > 0 ? `
            <div style="margin-bottom:10px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:10px 12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <label style="font-size:0.72rem;color:#f59e0b;font-weight:700;">Previous Balance: ${fmtPKR(balance)}</label>
                    <button onclick="document.getElementById('qePrevBalCollected').value=${balance};routeSheet.qeUpdateTotal()" 
                        style="background:rgba(245,158,11,0.2);border:1px solid rgba(245,158,11,0.4);color:#f59e0b;padding:2px 8px;border-radius:6px;cursor:pointer;font-size:0.72rem;font-weight:700;">Full</button>
                </div>
                <input id="qePrevBalCollected" type="number" min="0" max="${balance}" value="0"
                    oninput="routeSheet.qeUpdateTotal()"
                    placeholder="How much old balance collected today?"
                    style="width:100%;background:#0f172a;border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:8px 10px;color:#f59e0b;font-size:0.95rem;font-weight:700;">
            </div>
            <div id="qeTotalCollectedDisplay" style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:8px 12px;margin-bottom:10px;display:flex;justify-content:space-between;font-size:0.82rem;">
                <span style="color:#94a3b8;">Total you will collect today:</span>
                <span id="qeTotalCollectedVal" style="color:#10b981;font-weight:700;">PKR 0</span>
            </div>` : ''}

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button onclick="document.getElementById('quickEntryPopup').remove()"
                    style="padding:10px;border-radius:8px;border:1px solid #334155;background:transparent;color:#94a3b8;cursor:pointer;font-weight:600;">Cancel</button>
                <button onclick="routeSheet.confirmQuickEntry('${client.id}','${client.name.replace(/'/g,"\'")}','${(client.address||'').replace(/'/g,"\'")}' )"
                    style="padding:10px;border-radius:8px;border:none;background:#3b82f6;color:white;cursor:pointer;font-weight:700;">✓ Add Client</button>
            </div>
        `;

        // Backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'quickEntryBackdrop';
        backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99998;';
        backdrop.onclick = () => { popup.remove(); backdrop.remove(); };
        document.body.appendChild(backdrop);
        document.body.appendChild(popup);

        // Store default type
        this._qeType = defaultRemarks;

        // Auto-focus qty
        setTimeout(() => {
            const qtyEl = document.getElementById('qeQty');
            if (qtyEl) { qtyEl.focus(); qtyEl.select(); }
        }, 50);

        // Enter key confirms
        popup.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                routeSheet.confirmQuickEntry(client.id, client.name, client.address || '');
            }
            if (e.key === 'Escape') { popup.remove(); backdrop.remove(); }
        });
    },

    qeRecalcReceived() {
        if (this._qeType !== 'Cash') return;
        const qty   = parseInt(document.getElementById('qeQty')?.value)    || 0;
        const price = parseFloat(document.getElementById('qePrice')?.value) || 0;
        const recEl = document.getElementById('qeReceived');
        if (recEl) recEl.value = qty * price;
        this.qeUpdateTotal();
    },

    qeUpdateTotal() {
        const qty      = parseInt(document.getElementById('qeQty')?.value)          || 0;
        const price    = parseFloat(document.getElementById('qePrice')?.value)       || 0;
        const received = parseFloat(document.getElementById('qeReceived')?.value)    || 0;
        const prevCol  = parseFloat(document.getElementById('qePrevBalCollected')?.value) || 0;
        const total    = qty * price;
        const grandTotal = (this._qeType === 'Cash' ? total : received) + prevCol;
        const el = document.getElementById('qeTotalCollectedVal');
        if (el) el.textContent = fmtPKR(grandTotal);
    },

    qeSetType(type) {
        this._qeType = type;
        const colors = { Cash: '#10b981', Bal: '#f59e0b', Monthly: '#3b82f6' };
        const bgs    = { Cash: 'rgba(16,185,129,0.15)', Bal: 'rgba(245,158,11,0.15)', Monthly: 'rgba(59,130,246,0.15)' };
        ['Cash','Bal','Monthly'].forEach(t => {
            const btn = document.getElementById('qeType' + t);
            if (!btn) return;
            const active = t === type;
            btn.style.borderColor = active ? colors[t] : '#334155';
            btn.style.background  = active ? bgs[t]    : '#0f172a';
        });
        // Auto-set received
        const qty   = parseInt(document.getElementById('qeQty')?.value)   || 1;
        const price = parseFloat(document.getElementById('qePrice')?.value) || 0;
        const total = qty * price;
        const recEl = document.getElementById('qeReceived');
        if (recEl) recEl.value = type === 'Cash' ? total : 0;
    },

    confirmQuickEntry(clientId, clientName, clientAddress) {
        const qty   = Math.max(0, parseInt(document.getElementById('qeQty')?.value)    || 0);
        const price = Math.max(0, parseFloat(document.getElementById('qePrice')?.value) || 0);
        const remarks = this._qeType || 'Cash';
        const total   = qty * price;
        // For Cash: received always = total. For Bal/Monthly: use what user entered
        const received = remarks === 'Cash'
            ? total
            : Math.max(0, parseFloat(document.getElementById('qeReceived')?.value) || 0);
        const balance = Math.max(0, total - received);
        // Previous balance collected today (extra cash from old outstanding)
        const prevBalCollected = Math.max(0, parseFloat(document.getElementById('qePrevBalCollected')?.value) || 0);

        if (qty <= 0) { showToast('Please enter qty!', true); return; }

        this.activeDeliveries.push({
            clientId, clientName, address: clientAddress,
            qty, price, total, remarks, received, balance,
            prevBalCollected  // how much old balance was collected in this route
        });

        // Close popup and backdrop
        document.getElementById('quickEntryPopup')?.remove();
        document.getElementById('quickEntryBackdrop')?.remove();

        this.renderRows();
        this.recalculateTotals();
        this.saveDraft();
        showToast(`${clientName} added — ${qty} bottles`);
    },
    deleteRow(index) { this.activeDeliveries.splice(index, 1); this.renderRows(); },
    updateCell(index, field, value) {
        const item = this.activeDeliveries[index];
        if (!item) return;
        if (field === 'qty') { item.qty = Math.max(0, parseInt(value) || 0); item.total = item.qty * item.price; if (item.remarks === 'Cash') item.received = item.total; }
        else if (field === 'price') { item.price = Math.max(0, parseFloat(value) || 0); item.total = item.qty * item.price; if (item.remarks === 'Cash') item.received = item.total; }
        else if (field === 'received') { item.received = Math.max(0, parseFloat(value) || 0); }
        else if (field === 'remarks') {
            item.remarks = value;
            if (value === 'Cash') { item.received = item.total; const client = state.clients.find(c => c.id === item.clientId); if (client && client.type !== 'Daily') { client.type = 'Daily'; saveLocalState(); } }
            if (value === 'Bal') item.received = 0;
            if (value === 'Monthly') { item.received = 0; const client = state.clients.find(c => c.id === item.clientId); if (client && client.type !== 'Monthly') { client.type = 'Monthly'; saveLocalState(); } }
        }
        item.balance = Math.max(0, item.total - item.received);
        this.renderRows();
    },
    renderRows() {
        const tbody = document.getElementById("routeEntryRows");
        if (!tbody) return;
        tbody.innerHTML = "";
        if (this.activeDeliveries.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#64748b;padding:2rem;">Search and add clients above to fill route sheet</td></tr>`;
            this.recalculateTotals(); return;
        }
        this.activeDeliveries.forEach((d, idx) => {
            const tr = document.createElement("tr");
            tr.className = "table-row border-b border-gray-800";
            tr.innerHTML = `
                <td class="py-2"><strong>${d.clientName}</strong></td>
                <td class="py-2 text-gray-400 text-xs hide-mobile">${d.address}</td>
                <td class="py-2"><input type="number" inputmode="numeric" class="edit-input" value="${d.qty}" onchange="routeSheet.updateCell(${idx},'qty',this.value)" onfocus="this.select()"></td>
                <td class="py-2"><input type="number" inputmode="numeric" class="edit-input" value="${d.price}" onchange="routeSheet.updateCell(${idx},'price',this.value)" onfocus="this.select()"></td>
                <td class="py-2 font-bold">${fmtPKR(d.total)}</td>
                <td class="py-2"><select class="edit-input" onchange="routeSheet.updateCell(${idx},'remarks',this.value)">
                    <option value="Cash" ${d.remarks==='Cash'?'selected':''}>Cash</option>
                    <option value="Bal" ${d.remarks==='Bal'?'selected':''}>Bal (Credit)</option>
                    <option value="Monthly" ${d.remarks==='Monthly'?'selected':''}>Monthly</option>
                </select></td>
                <td class="py-2"><input type="number" inputmode="numeric" class="edit-input" value="${d.received}" ${d.remarks==='Cash'?'disabled style="opacity:0.5"':''} onchange="routeSheet.updateCell(${idx},'received',this.value)" onfocus="this.select()"></td>
                <td class="py-2 font-bold" style="color:${d.balance > 0 ? '#f59e0b' : '#10b981'}">${fmtPKR(d.balance)}</td>
                <td class="py-2 text-center"><button class="btn-danger" onclick="routeSheet.deleteRow(${idx})"><i class="fa-solid fa-trash"></i></button></td>`;
            tbody.appendChild(tr);
        });
        this.recalculateTotals();
    },
    recalculateTotals() {
        let q = 0, v = 0, c = 0, b = 0;
        this.activeDeliveries.forEach(d => { 
            q += d.qty; 
            v += d.total; 
            c += d.received + (d.prevBalCollected || 0);  // include old balance collected in cash total
            b += d.balance; 
        });
        const fuel = parseFloat(document.getElementById("routeFuel").value) || 0;
        const food = parseFloat(document.getElementById("routeFood").value) || 0;
        const other = parseFloat(document.getElementById("routeOther").value) || 0;
        const totalExpenses = fuel + food + other;
        const netCash = c - totalExpenses;
        
        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
        setTxt("routeTotalQty", q); setTxt("routeTotalRecv", fmtPKR(c)); setTxt("routeTotalBalance", fmtPKR(b));
        setTxt("routeGrandTotal", fmtPKR(v)); setTxt("routeTotalExpenses", fmtPKR(totalExpenses));
        
        const netEl = document.getElementById("routeNetCash");
        const netLabel = document.getElementById("routeNetCashLabel");
        const recBox = document.getElementById("driverReconciliationBox");
        if (netEl) {
            netEl.innerText = fmtPKR(netCash);
            if (netCash > 0) { netEl.style.color = '#10b981'; if (netLabel) netLabel.innerText = 'Driver owes you'; }
            else if (netCash < 0) { netEl.style.color = '#ef4444'; if (netLabel) netLabel.innerText = 'You owe driver'; }
            else { netEl.style.color = '#94a3b8'; if (netLabel) netLabel.innerText = 'Settled'; }
        } 
        if (recBox) {
            if (totalExpenses > 0 || c > 0) {
                recBox.style.display = 'block';
                const startKm = parseFloat(document.getElementById("routeStartKm").value) || 0;
                const endKm = parseFloat(document.getElementById("routeEndKm").value) || 0;
                setTxt("recCashIn", fmtPKR(c)); setTxt("recExpenses", fmtPKR(totalExpenses));
                setTxt("recKm", Math.max(0, endKm - startKm) + ' km'); setTxt("recNet", fmtPKR(netCash));
            } else { recBox.style.display = 'none'; }
        }
    },
    save() {
        const date = document.getElementById("routeDate").value;
        const vehicle = document.getElementById("routeVehicle").value.trim();
        const driver = document.getElementById("routeDriver").value.trim();
        if (!date || !vehicle || !driver) return showToast("Date, Vehicle & Driver are required!", true);
        if (this.activeDeliveries.length === 0) return showToast("Add at least one client!", true);
        
        // Check for duplicate date — skip check if editing the same route
        const duplicateRoute = state.routes.find(r => r.date === date && r.id !== this.editingRouteId);
        if (duplicateRoute) {
            if (!confirm(`A route for ${date} already exists (${duplicateRoute.driver} / ${duplicateRoute.vehicle} / ${duplicateRoute.deliveries?.length || 0} clients).\n\nDo you still want to save a second route for the same date?`)) return;
        }
        
        let q = 0, v = 0, c = 0, b = 0;
        this.activeDeliveries.forEach(d => { 
            q += d.qty; 
            v += d.total; 
            c += d.received + (d.prevBalCollected || 0);  // include old balance collected in cash total
            b += d.balance; 
        });
        
        // If editing an existing route, reverse its old balances first
        if (this.editingRouteId) {
            const oldRoute = state.routes.find(r => r.id === this.editingRouteId);
            if (oldRoute) {
                oldRoute.deliveries.forEach(d => {
                    const client = state.clients.find(c => c.id === d.clientId);
                    if (client) client.balance = Math.max(0, Number(client.balance) - Number(d.balance));
                });
                state.routes = state.routes.filter(r => r.id !== this.editingRouteId);
            }
        }

        const newRoute = {
            id: this.editingRouteId || ('r_' + Date.now()), date, vehicle, driver,
            fuel: parseFloat(document.getElementById("routeFuel").value)||0,
            food: parseFloat(document.getElementById("routeFood").value)||0,
            other: parseFloat(document.getElementById("routeOther").value)||0,
            startKm: parseFloat(document.getElementById("routeStartKm").value)||0,
            endKm: parseFloat(document.getElementById("routeEndKm").value)||0,
            totalQty: q, totalVal: v, collectedCash: c, outstandingAdded: b,
            deliveries: JSON.parse(JSON.stringify(this.activeDeliveries))
        };

        // Apply new balances to clients
        this.activeDeliveries.forEach(d => {
            const client = state.clients.find(c => c.id === d.clientId);
            if (client) {
                client.balance = Number(client.balance) + Number(d.balance);
                // Deduct any old balance collected today
                if (d.prevBalCollected > 0) {
                    client.balance = Math.max(0, Number(client.balance) - Number(d.prevBalCollected));
                    // Record this as a payment in invoices for proper tracking
                    if (!state.invoices) state.invoices = [];
                    state.invoices.push({
                        id: 'inv_' + Date.now() + '_' + d.clientId,
                        invoiceNo: 'BAL-' + todayStr().replace(/-/g,''),
                        clientId: d.clientId, clientName: d.clientName,
                        clientAddress: d.address || '', clientPhone: client.phone || '',
                        issueDate: date, startDate: date, endDate: date,
                        createdAt: new Date().toISOString(),
                        grandTotal: d.prevBalCollected, periodSales: 0,
                        previousBalance: d.prevBalCollected,
                        qty: 0, status: 'PAID', amountPaid: d.prevBalCollected,
                        payments: [{ amount: d.prevBalCollected, date, note: 'Balance collected on route' }],
                        items: []
                    });
                }
            }
        });

        const wasEditing = !!this.editingRouteId;  // read BEFORE clearing
        this.editingRouteId = null;
        state.routes.push(newRoute);
        saveLocalState();
        console.log(`[AquaPack] Routes in storage after save: ${state.routes.length}`, state.routes.map(r => r.date));
        showToast(wasEditing ? `Route updated! Balances recalculated.` : `Route saved! ${state.routes.length} total routes stored.`);
        this.hideEditBanner();
        this.clearDraft();
        this.clearForm(false);
        this.renderArchive();
        dashboard.render();
        syncApp.autoSync();
    },
    deleteArchive(id) {
        const route = state.routes.find(r => r.id === id);
        if (!route) return;
        if (!confirm(`Delete route for ${route.date}?\n\nThis will reverse all client balances for this route. This cannot be undone.`)) return;
        
        // Remove route first
        state.routes = state.routes.filter(r => r.id !== id);
        
        // Recalculate ALL affected clients from scratch using live recalc
        const affectedClientIds = [...new Set(route.deliveries.map(d => d.clientId))];
        affectedClientIds.forEach(clientId => {
            const client = state.clients.find(c => c.id === clientId);
            if (client) client.balance = recalcClientBalance(clientId);
        });
        
        saveLocalState();
        this.renderArchive();
        dashboard.render();
        clientsTab.renderList();
        syncApp.autoSync();
        showToast(`Route for ${route.date} deleted. ${affectedClientIds.length} client balances updated.`);
    },
    loadArchiveToEdit(id) {
        const route = state.routes.find(r => r.id === id);
        if (!route) return;

        // Warn if form has unsaved data
        const hasData = this.activeDeliveries.length > 0 ||
            document.getElementById('routeDriver')?.value.trim() ||
            document.getElementById('routeVehicle')?.value.trim();
        if (hasData && !confirm('You have unsaved data in the form.\n\nYour current work has been auto-saved as a draft and can be restored.\n\nContinue loading this route?')) return;

        this.editingRouteId = id;  // remember which route we are editing

        // Load route data into form WITHOUT deleting or touching saved data
        document.getElementById("routeDate").value = route.date;
        document.getElementById("routeVehicle").value = route.vehicle;
        document.getElementById("routeDriver").value = route.driver;
        document.getElementById("routeFuel").value = route.fuel || 0;
        document.getElementById("routeFood").value = route.food || 0;
        document.getElementById("routeOther").value = route.other || 0;
        document.getElementById("routeStartKm").value = route.startKm || 0;
        document.getElementById("routeEndKm").value = route.endKm || 0;

        this.activeDeliveries = JSON.parse(JSON.stringify(route.deliveries));
        this.renderRows();
        this.recalculateTotals();
        // Show yellow edit mode banner so user always knows they are editing a saved route
        this.showEditBanner(route.date);
        showToast("Route loaded for editing. Make changes and Save Route Sheet.");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    showEditBanner(date) {
        let banner = document.getElementById("routeEditBanner");
        if (!banner) {
            banner = document.createElement("div");
            banner.id = "routeEditBanner";
            banner.style.cssText = "background:#854d0e;color:#fef08a;padding:10px 16px;border-radius:8px;margin-bottom:12px;font-weight:600;display:flex;justify-content:space-between;align-items:center;";
            const routeForm = document.querySelector("#routes .card");
            if (routeForm) routeForm.insertBefore(banner, routeForm.firstChild);
        }
        banner.innerHTML = `<span>✏️ Editing Route: ${date} — Make your changes then click Save Route Sheet</span><button onclick="routeSheet.cancelEdit()" style="background:rgba(0,0,0,0.3);border:none;color:#fef08a;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;">✕ Cancel Edit</button>`;
        banner.style.display = "flex";
    },
    hideEditBanner() {
        const banner = document.getElementById("routeEditBanner");
        if (banner) banner.style.display = "none";
    },
    cancelEdit() {
        this.editingRouteId = null;
        this.clearForm(true);
        this.hideEditBanner();
        showToast("Edit cancelled. Route data is safe.");
    },
    printRoute(id) {
        const route = state.routes.find(r => r.id === id);
        if (!route) return;

        const config = state.config || {};
        const companyName = config.companyName || 'AQUA PACK';
        const companyPhone = config.phone || '';

        // Build delivery rows
        let deliveryRows = '';
        let grandTotal = 0, grandCash = 0, grandBalance = 0, grandQty = 0;
        (route.deliveries || []).forEach((d, i) => {
            grandQty     += Number(d.qty     || 0);
            grandTotal   += Number(d.total   || 0);
            grandCash    += Number(d.received|| 0);
            grandBalance += Number(d.balance || 0);
            const client = state.clients.find(c => c.id === d.clientId);
            const zone   = client ? getZone(client.address || '') : '';
            deliveryRows += `
            <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:6px 8px;">${i + 1}</td>
                <td style="padding:6px 8px;font-weight:600;">${d.clientName || ''}</td>
                <td style="padding:6px 8px;color:#6b7280;font-size:0.8rem;">${zone}</td>
                <td style="padding:6px 8px;text-align:center;">${d.qty}</td>
                <td style="padding:6px 8px;text-align:right;">PKR ${Number(d.price||0).toLocaleString()}</td>
                <td style="padding:6px 8px;text-align:right;font-weight:600;">PKR ${Number(d.total||0).toLocaleString()}</td>
                <td style="padding:6px 8px;text-align:right;color:#16a34a;">PKR ${Number(d.received||0).toLocaleString()}</td>
                <td style="padding:6px 8px;text-align:center;">
                    <span style="padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:600;
                        background:${d.remarks==='Cash'?'#dcfce7':d.remarks==='Monthly'?'#dbeafe':'#fef3c7'};
                        color:${d.remarks==='Cash'?'#16a34a':d.remarks==='Monthly'?'#1d4ed8':'#b45309'};">
                        ${d.remarks || '-'}
                    </span>
                </td>
                <td style="padding:6px 8px;text-align:right;color:${Number(d.balance||0)>0?'#d97706':'#6b7280'};">
                    PKR ${Number(d.balance||0).toLocaleString()}
                </td>
            </tr>`;
        });

        const totalRouteExp = Number(route.fuel||0) + Number(route.food||0) + Number(route.other||0);
        const netCashDue    = grandCash - totalRouteExp;

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Route Sheet - ${route.date}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 20px; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; padding-bottom:12px; border-bottom:2px solid #111; }
        .company-name { font-size:1.6rem; font-weight:900; letter-spacing:1px; }
        .company-sub { font-size:0.8rem; color:#555; margin-top:2px; }
        .badge-box { background:#111; color:#fff; padding:6px 14px; border-radius:8px; text-align:center; }
        .badge-box .label { font-size:0.7rem; opacity:0.7; }
        .badge-box .val { font-size:1rem; font-weight:700; }
        .info-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:16px; }
        .info-box { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:8px 12px; }
        .info-box .lbl { font-size:0.7rem; color:#6b7280; text-transform:uppercase; font-weight:600; }
        .info-box .val { font-size:1rem; font-weight:700; margin-top:2px; }
        table { width:100%; border-collapse:collapse; margin-bottom:14px; }
        thead tr { background:#111; color:#fff; }
        thead th { padding:8px; text-align:left; font-size:0.75rem; font-weight:600; }
        tbody tr:nth-child(even) { background:#f9fafb; }
        .totals-row { background:#f1f5f9 !important; font-weight:700; border-top:2px solid #111; }
        .section-title { font-size:0.8rem; font-weight:700; text-transform:uppercase; color:#6b7280; margin-bottom:6px; letter-spacing:0.5px; }
        .summary-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; }
        .summary-box { border:1px solid #e5e7eb; border-radius:8px; padding:10px 14px; }
        .summary-row { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f1f5f9; font-size:0.85rem; }
        .summary-row:last-child { border-bottom:none; font-weight:700; font-size:0.95rem; }
        .highlight { background:#f0fdf4; border-color:#86efac; }
        .highlight .summary-row:last-child { color:#16a34a; }
        .signatures { display:grid; grid-template-columns:1fr 1fr; gap:30px; margin-top:20px; }
        .sig-box { border-top:1px solid #111; padding-top:6px; text-align:center; font-size:0.8rem; color:#6b7280; }
        .footer { text-align:center; font-size:0.7rem; color:#9ca3af; margin-top:16px; padding-top:10px; border-top:1px solid #e5e7eb; }
        @media print {
            body { padding: 10px; }
            button { display:none !important; }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="header">
        <div>
            <div class="company-name">💧 ${companyName}</div>
            <div class="company-sub">Water Delivery ERP &nbsp;|&nbsp; ${companyPhone}</div>
        </div>
        <div class="badge-box">
            <div class="label">ROUTE DATE</div>
            <div class="val">${fmtDate(route.date)}</div>
        </div>
    </div>

    <!-- Route Info -->
    <div class="info-grid">
        <div class="info-box"><div class="lbl">Driver</div><div class="val">${route.driver || '-'}</div></div>
        <div class="info-box"><div class="lbl">Vehicle</div><div class="val">${route.vehicle || '-'}</div></div>
        <div class="info-box"><div class="lbl">KM Driven</div><div class="val">${Number(route.startKm||0)} → ${Number(route.endKm||0)} &nbsp;(${Number(route.endKm||0) - Number(route.startKm||0)} km)</div></div>
    </div>

    <!-- Deliveries Table -->
    <div class="section-title">Delivery Log</div>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Client</th>
                <th>Zone</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Rate</th>
                <th style="text-align:right;">Total</th>
                <th style="text-align:right;">Received</th>
                <th style="text-align:center;">Type</th>
                <th style="text-align:right;">Balance</th>
            </tr>
        </thead>
        <tbody>
            ${deliveryRows}
            <tr class="totals-row">
                <td colspan="3" style="padding:8px;">TOTAL</td>
                <td style="padding:8px;text-align:center;">${grandQty}</td>
                <td></td>
                <td style="padding:8px;text-align:right;">PKR ${grandTotal.toLocaleString()}</td>
                <td style="padding:8px;text-align:right;color:#16a34a;">PKR ${grandCash.toLocaleString()}</td>
                <td></td>
                <td style="padding:8px;text-align:right;color:#d97706;">PKR ${grandBalance.toLocaleString()}</td>
            </tr>
        </tbody>
    </table>

    <!-- Summary -->
    <div class="summary-grid">
        <div class="summary-box">
            <div class="section-title">Route Expenses</div>
            <div class="summary-row"><span>Fuel</span><span>PKR ${Number(route.fuel||0).toLocaleString()}</span></div>
            <div class="summary-row"><span>Food</span><span>PKR ${Number(route.food||0).toLocaleString()}</span></div>
            <div class="summary-row"><span>Other</span><span>PKR ${Number(route.other||0).toLocaleString()}</span></div>
            <div class="summary-row"><span>Total Expenses</span><span>PKR ${totalRouteExp.toLocaleString()}</span></div>
        </div>
        <div class="summary-box highlight">
            <div class="section-title">Cash Reconciliation</div>
            <div class="summary-row"><span>Total Collected</span><span>PKR ${grandCash.toLocaleString()}</span></div>
            <div class="summary-row"><span>Route Expenses</span><span>- PKR ${totalRouteExp.toLocaleString()}</span></div>
            <div class="summary-row"><span>Net Cash Due to Owner</span><span>PKR ${netCashDue.toLocaleString()}</span></div>
        </div>
    </div>

    <!-- Signatures -->
    <div class="signatures">
        <div class="sig-box">Driver Signature: ${route.driver || ''}</div>
        <div class="sig-box">Owner / Manager Signature</div>
    </div>

    <div class="footer">Printed on ${new Date().toLocaleString()} &nbsp;|&nbsp; ${companyName} Water Delivery ERP</div>

    <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=900,height=700');
        win.document.write(html);
        win.document.close();
    },
    renderArchive() {
        const tbody = document.getElementById("routeArchiveBody");
        if (!tbody) return;
        tbody.innerHTML = "";
        
        const q = document.getElementById("routeArchiveSearch")?.value.toLowerCase().trim() || "";
        const dF = document.getElementById("routeArchiveDateFrom")?.value || "";
        const dT = document.getElementById("routeArchiveDateTo")?.value || "";
        
        let filtered = [...state.routes].sort((a, b) => new Date(b.date) - new Date(a.date));
        if (dF) filtered = filtered.filter(r => r.date >= dF);
        if (dT) filtered = filtered.filter(r => r.date <= dT);
        if (q) filtered = filtered.filter(r => r.date.includes(q) || r.driver.toLowerCase().includes(q) || r.vehicle.toLowerCase().includes(q));
        
        if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#64748b;padding:2rem;">No route records found</td></tr>`; return; }

        // Summary totals row at bottom
        let sumBottles = 0, sumValue = 0, sumCash = 0, sumExp = 0, sumBal = 0;

        filtered.forEach(r => {
            const expenses  = Number(r.fuel||0) + Number(r.food||0) + Number(r.other||0);
            const netCash   = Number(r.collectedCash||0) - expenses;
            const clients   = (r.deliveries||[]).length;
            sumBottles += Number(r.totalQty||0);
            sumValue   += Number(r.totalVal||0);
            sumCash    += Number(r.collectedCash||0);
            sumExp     += expenses;
            sumBal     += Number(r.outstandingAdded||0);

            const tr = document.createElement("tr");
            tr.className = "table-row border-b border-gray-800";
            tr.innerHTML = `
                <td class="py-3"><strong>${fmtDate(r.date)}</strong></td>
                <td class="py-3 hide-mobile text-sm">
                    <div class="font-semibold">${r.driver||'-'}</div>
                    <div class="text-gray-500">${r.vehicle||'-'}</div>
                </td>
                <td class="py-3 text-center">
                    <span style="background:rgba(59,130,246,0.15);color:#60a5fa;padding:2px 8px;border-radius:9999px;font-size:0.75rem;font-weight:700;">${clients}</span>
                </td>
                <td class="py-3 font-semibold">${Number(r.totalQty||0).toLocaleString()}</td>
                <td class="py-3 font-semibold text-blue-400">${fmtPKR(r.totalVal)}</td>
                <td class="py-3 font-bold text-green-400">${fmtPKR(r.collectedCash)}</td>
                <td class="py-3 text-red-400">${fmtPKR(expenses)}</td>
                <td class="py-3 font-bold" style="color:${netCash>=0?'#10b981':'#ef4444'}">${fmtPKR(netCash)}</td>
                <td class="py-3 text-amber-400">${fmtPKR(r.outstandingAdded)}</td>
                <td class="py-3">
                    <div class="flex gap-2 flex-wrap">
                        <button class="btn-secondary" onclick="routeSheet.loadArchiveToEdit('${r.id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-secondary" onclick="routeSheet.printRoute('${r.id}')"><i class="fa-solid fa-print"></i></button>
                        <button class="btn-danger" onclick="routeSheet.deleteArchive('${r.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>`;
            tbody.appendChild(tr);
        });

        // Totals summary row
        const sumNetCash = sumCash - sumExp;
        const totalTr = document.createElement("tr");
        totalTr.style.cssText = "background:#1e293b;font-weight:700;border-top:2px solid #334155;";
        totalTr.innerHTML = `
            <td class="py-3 text-sm text-gray-400" colspan="2">TOTAL (${filtered.length} routes)</td>
            <td></td>
            <td class="py-3">${sumBottles.toLocaleString()}</td>
            <td class="py-3 text-blue-400">${fmtPKR(sumValue)}</td>
            <td class="py-3 text-green-400">${fmtPKR(sumCash)}</td>
            <td class="py-3 text-red-400">${fmtPKR(sumExp)}</td>
            <td class="py-3" style="color:${sumNetCash>=0?'#10b981':'#ef4444'}">${fmtPKR(sumNetCash)}</td>
            <td class="py-3 text-amber-400">${fmtPKR(sumBal)}</td>
            <td></td>`;
        tbody.appendChild(totalTr);
    }
};

// ==========================================
// CLIENTS MODULE
// ==========================================
const clientsTab = {
    filterType: 'all',
    init() { this.renderList(); },
    setFilter(type) {
        this.filterType = type;
        document.querySelectorAll("[data-cfilter]").forEach(b => b.classList.remove("active"));
        const btn = document.querySelector(`[data-cfilter="${type}"]`);
        if (btn) btn.classList.add("active");
        const mPicker = document.getElementById('clientMonthFilter');
        if (mPicker) {
            mPicker.style.display = type === 'monthly' ? 'inline-block' : 'none';
            if (type === 'monthly' && !mPicker.value) {
                // Default to previous month
                const d = new Date();
                d.setMonth(d.getMonth() - 1);
                mPicker.value = d.toISOString().slice(0,7);
            }
        }
        this.renderList();
    },
    bulkImport() {
        // Add your 79 clients here. I kept it short for the code to fit.
        const masterList = [
            { name: "Abdullah", type: "Daily", address: "Ghori Town Phase 3 street 14", phone: "", rate:150, balance:0 },
            { name: "Adeel", type: "Daily", address: "Gulzara Quaid Wakeel Colony", phone: "", rate:200, balance:0 },
            { name: "Adnan", type: "Monthly", address: "Pakistan Town", phone: "", rate:200, balance:0 }
        ];
        const existingNames = new Set(state.clients.map(c => c.name.toLowerCase().trim()));
        let imported = 0;
        masterList.forEach(c => {
            if (!existingNames.has(c.name.toLowerCase().trim())) {
                state.clients.push({ id: 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2,5), ...c });
                imported++;
            }
        });
        saveLocalState();
        this.renderList();
        dashboard.render();
        syncApp.autoSync();
        showToast(`Done! ${imported} new clients imported.`);
    },
    save() {
        const id = document.getElementById("editClientId").value;
        const name = document.getElementById("clientName").value.trim();
        if (!name) return showToast("Name is required!", true);
        const type = document.getElementById("clientType").value;
        const address = document.getElementById("clientAddress").value.trim();
        const phone = document.getElementById("clientPhone").value.trim();
        const rate = parseFloat(document.getElementById("clientRate").value) || 200;
        const balance = parseFloat(document.getElementById("clientBalance").value) || 0;
        
        const security = parseFloat(document.getElementById("clientSecurity")?.value) || 0;
        if (id) {
            const c = state.clients.find(c => c.id === id);
            if (c) { Object.assign(c, { name, type, address, phone, rate, balance, security }); showToast("Client updated!"); }
        } else {
            state.clients.push({ id: 'c_' + Date.now(), name, type, address, phone, rate, balance, security, joinDate: todayStr() });
            showToast("Client added!");
        }
        saveLocalState(); this.clearForm(); this.renderList(); dashboard.render(); syncApp.autoSync();
    },
    edit(id) {
        const c = state.clients.find(c => c.id === id);
        if (!c) return;
        document.getElementById("editClientId").value = c.id;
        document.getElementById("clientName").value = c.name;
        document.getElementById("clientType").value = c.type;
        document.getElementById("clientAddress").value = c.address || '';
        document.getElementById("clientPhone").value = c.phone || '';
        document.getElementById("clientRate").value = c.rate;
        document.getElementById("clientBalance").value = c.balance;
        const secEl = document.getElementById("clientSecurity");
        if (secEl) secEl.value = c.security || 0;
        document.getElementById("btnSaveClient").innerText = "Update Client";
        document.getElementById("clients").scrollIntoView({ behavior: 'smooth' });
    },
    clearForm() {
        document.getElementById("editClientId").value = "";
        document.getElementById("clientName").value = "";
        document.getElementById("clientAddress").value = "";
        document.getElementById("clientPhone").value = "";
        document.getElementById("clientRate").value = "200";
        document.getElementById("clientBalance").value = "0";
        const secEl2 = document.getElementById("clientSecurity");
        if (secEl2) secEl2.value = "0";
        document.getElementById("btnSaveClient").innerText = "Save Client";
    },
    delete(id) {
        if (!confirm("Delete this client?")) return;
        state.clients = state.clients.filter(c => c.id !== id);
        saveLocalState(); this.renderList(); dashboard.render(); syncApp.autoSync();
        showToast("Client deleted.");
    },
    renderList() {
        const tbody = document.getElementById("clientTableBody");
        if (!tbody) return;
        tbody.innerHTML = "";
        const q = document.getElementById("clientSearchQuery")?.value.toLowerCase().trim() || "";
        let filtered = state.clients.filter(c => c.name.toLowerCase().includes(q) || (c.address || '').toLowerCase().includes(q));

        // Apply filters
        const selectedMonth = document.getElementById('clientMonthFilter')?.value || '';

        if (this.filterType === 'monthly' && selectedMonth) {
            filtered = filtered.map(c => {
                let monthBalAdded = 0, monthBottles = 0, monthDelivered = 0, monthReceived = 0;
                state.routes.forEach(r => {
                    if (!r.date.startsWith(selectedMonth)) return;
                    (r.deliveries||[]).forEach(d => {
                        if (d.clientId === c.id) {
                            monthBalAdded  += Number(d.balance||0);
                            monthBottles   += Number(d.qty||0);
                            monthDelivered += Number(d.total||0);
                            monthReceived  += Number(d.received||0);
                        }
                    });
                });
                let monthPaid = 0;
                state.invoices.forEach(inv => {
                    if (inv.clientId !== c.id) return;
                    const invMonth = (inv.endDate || inv.issueDate || '').slice(0,7);
                    if (invMonth === selectedMonth) monthPaid += Number(inv.amountPaid||0);
                });
                const monthBalance = Math.max(0, monthBalAdded - monthPaid);
                return { ...c, _liveBalance: monthBalance, _monthBottles: monthBottles, _monthDelivered: monthDelivered, _monthReceived: monthReceived + monthPaid, _isMonthly: true };
            });
            filtered = filtered.filter(c => c._monthBottles > 0 || c._liveBalance > 0);
        } else {
            filtered = filtered.map(c => ({ ...c, _liveBalance: recalcClientBalance(c.id) }));
            if (this.filterType === 'unpaid') filtered = filtered.filter(c => c._liveBalance > 0);
            if (this.filterType === 'paid')   filtered = filtered.filter(c => c._liveBalance <= 0);
        }

        filtered.sort((a, b) => b._liveBalance - a._liveBalance);

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748b;padding:2rem;">No clients found for this month</td></tr>`;
            return;
        }

        // Show month summary row for monthly filter
        if (this.filterType === 'monthly' && selectedMonth) {
            const totBottles  = filtered.reduce((a,c) => a + (c._monthBottles||0), 0);
            const totDelivered = filtered.reduce((a,c) => a + (c._monthDelivered||0), 0);
            const totReceived = filtered.reduce((a,c) => a + (c._monthReceived||0), 0);
            const totBalance  = filtered.reduce((a,c) => a + (c._liveBalance||0), 0);
            const unpaidCount = filtered.filter(c => c._liveBalance > 0).length;
            const paidCount   = filtered.filter(c => c._liveBalance <= 0).length;
            const mNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const [yr,mn] = selectedMonth.split('-');
            const headerTr = document.createElement('tr');
            headerTr.style.cssText = 'background:#1e3a5f;';
            headerTr.innerHTML = `
                <td colspan="4" style="padding:10px 12px;">
                    <span style="font-weight:700;color:#60a5fa;">📅 ${mNames[parseInt(mn)]} ${yr}</span>
                    <span style="color:#64748b;font-size:0.78rem;margin-left:10px;">${filtered.length} clients · <span style="color:#f59e0b;">${unpaidCount} unpaid</span> · <span style="color:#10b981;">${paidCount} paid</span></span>
                </td>
                <td style="padding:10px 12px;text-align:right;"><div style="font-size:0.65rem;color:#64748b;">Bottles</div><div style="font-weight:700;">${totBottles}</div></td>
                <td style="padding:10px 12px;text-align:right;"><div style="font-size:0.65rem;color:#64748b;">Balance</div><div style="font-weight:700;color:${totBalance>0?'#f59e0b':'#10b981'};">${fmtPKR(totBalance)}</div></td>
                <td style="padding:10px 12px;text-align:right;">
                    <button onclick="clientsTab.toggleMonthUnpaid()" id="monthUnpaidBtn" 
                        style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.75rem;font-weight:700;">
                        Unpaid Only
                    </button>
                </td>`;
            tbody.appendChild(headerTr);
        }

        filtered.forEach(c => {
            const bal = c._liveBalance;
            const isPaid = bal <= 0;
            const statusBadge = isPaid
                ? `<span style="background:rgba(16,185,129,0.15);color:#10b981;padding:2px 8px;border-radius:9999px;font-size:0.7rem;font-weight:700;">&#10003; PAID</span>`
                : `<span style="background:rgba(245,158,11,0.15);color:#f59e0b;padding:2px 8px;border-radius:9999px;font-size:0.7rem;font-weight:700;">&#9679; UNPAID</span>`;

            const monthExtra = c._isMonthly ? `
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-top:6px;">
                    <div style="background:#0f172a;border-radius:6px;padding:4px 6px;text-align:center;">
                        <div style="font-size:0.6rem;color:#64748b;">Bottles</div>
                        <div style="font-weight:700;font-size:0.82rem;">${c._monthBottles||0}</div>
                    </div>
                    <div style="background:#0f172a;border-radius:6px;padding:4px 6px;text-align:center;">
                        <div style="font-size:0.6rem;color:#64748b;">Received</div>
                        <div style="font-weight:700;font-size:0.82rem;color:#10b981;">${fmtPKR(c._monthReceived||0)}</div>
                    </div>
                    <div style="background:#0f172a;border-radius:6px;padding:4px 6px;text-align:center;">
                        <div style="font-size:0.6rem;color:#64748b;">Balance</div>
                        <div style="font-weight:700;font-size:0.82rem;color:${bal>0?'#f59e0b':'#10b981'};">${fmtPKR(bal)}</div>
                    </div>
                </div>` : '';

            const tr = document.createElement("tr");
            tr.className = "table-row border-b border-gray-800";
            tr.setAttribute('data-paid', bal <= 0 ? 'true' : 'false');
            tr.innerHTML = `
                <td class="py-3"><strong>${c.name}</strong><div class="mt-1">${statusBadge}</div>${monthExtra}</td>
                <td class="py-3"><span class="badge ${c.type==='Daily'?'badge-daily':'badge-monthly'}">${c.type}</span></td>
                <td class="py-3 text-gray-400 hide-mobile">${c.address || '-'}</td>
                <td class="py-3 hide-mobile">${c.phone || '-'}</td>
                <td class="py-3">${fmtPKR(c.rate)}</td>
                <td class="py-3 font-bold" style="color:${bal > 0 ? '#f59e0b' : '#10b981'}">${fmtPKR(bal)}</td>
                <td class="py-3">
                    <div class="flex gap-2">
                        <button class="btn-secondary" onclick="clientsTab.viewProfile('${c.id}')"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn-secondary" onclick="clientsTab.edit('${c.id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-danger" onclick="clientsTab.delete('${c.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>`;
            tbody.appendChild(tr);
        });
    },
    _showUnpaidOnly: false,
    toggleMonthUnpaid() {
        this._showUnpaidOnly = !this._showUnpaidOnly;
        const btn = document.getElementById('monthUnpaidBtn');
        if (btn) {
            btn.style.background = this._showUnpaidOnly ? 'rgba(245,158,11,0.4)' : 'rgba(245,158,11,0.15)';
            btn.textContent = this._showUnpaidOnly ? '✓ Unpaid Only' : 'Unpaid Only';
        }
        // Hide paid rows
        const tbody = document.getElementById('clientTableBody');
        if (!tbody) return;
        tbody.querySelectorAll('tr[data-paid]').forEach(tr => {
            tr.style.display = (this._showUnpaidOnly && tr.dataset.paid === 'true') ? 'none' : '';
        });
    },
    filterLedger(clientId) {
        const sel = document.getElementById('ledgerMonthFilter');
        if (!sel) return;
        const selected = sel.value;
        const container = document.getElementById('ledgerMonthlyContent');
        const summaryEl = document.getElementById('ledgerSummarySelected');
        if (!container) return;

        if (selected === 'all') {
            container.querySelectorAll('.month-block').forEach(b => b.style.display = 'block');
            if (summaryEl) summaryEl.style.display = 'none';
            // Reset top bar to all-time values
            const allDelivered = Object.values(window._ledgerMonthBalances?.[clientId] || {}).reduce((a,m) => a + (m.totalDelivered||0), 0);
            const allPaid      = Object.values(window._ledgerMonthBalances?.[clientId] || {}).reduce((a,m) => a + (m.payTotal||0), 0);
            const allBalance   = recalcClientBalance(clientId);
            const setEl = (id, val) => { const e = document.getElementById(id); if(e) e.textContent = val; };
            const allBottles = Object.values(window._ledgerMonthBalances?.[clientId] || {}).reduce((a,m) => a + (m.totalBottles||0), 0);
            setEl('lbl_opening',   'Bottles');   setEl('val_opening',   allBottles);
            setEl('lbl_delivered', 'Delivered'); setEl('val_delivered', fmtPKR(allDelivered));
            setEl('lbl_paid',      'Received');  setEl('val_paid',      fmtPKR(allPaid));
            setEl('lbl_balance',   'Balance');   setEl('val_balance',   fmtPKR(allBalance));
            return;
        }

        // Show only the selected month block
        container.querySelectorAll('.month-block').forEach(b => {
            b.style.display = b.dataset.month === selected ? 'block' : 'none';
        });

        // Update top bar for selected month
        const mb = window._ledgerMonthBalances?.[clientId]?.[selected];
        if (mb) {
            const mNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const [yr, mn] = selected.split('-');
            const label = mNames[parseInt(mn)] + ' ' + yr;
            const setEl = (id, val) => { const e = document.getElementById(id); if(e) e.textContent = val; };
            setEl('lbl_opening',   'Bottles');            setEl('val_opening',   mb.totalBottles||0);
            setEl('lbl_delivered', `Delivered (${label})`); setEl('val_delivered', fmtPKR(mb.totalDelivered||0));
            setEl('lbl_paid',      `Received (${label})`);  setEl('val_paid',      fmtPKR(mb.totalReceived||0));
            setEl('lbl_balance',   `Balance (${label})`);
            const balEl = document.getElementById('val_balance');
            if(balEl){ balEl.textContent = fmtPKR(mb.close); balEl.style.color = mb.close>0?'#f59e0b':'#10b981'; }
        }
        // Show month summary card
        if (mb && summaryEl) {
            const mNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const [yr, mn] = selected.split('-');
            const label = mNames[parseInt(mn)] + ' ' + yr;
            summaryEl.innerHTML = `
                <div style="background:#1e293b;border:1px solid #3b82f6;border-radius:10px;padding:12px;margin-bottom:10px;">
                    <div style="font-size:0.72rem;font-weight:700;color:#60a5fa;margin-bottom:10px;">
                        📅 ${label} Summary
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;">
                        <div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center;">
                            <div style="font-size:0.62rem;color:#64748b;margin-bottom:4px;">BOTTLES</div>
                            <div style="font-weight:700;color:#f1f5f9;font-size:1.1rem;">${mb.totalBottles||0}</div>
                        </div>
                        <div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center;">
                            <div style="font-size:0.62rem;color:#64748b;margin-bottom:4px;">DELIVERED</div>
                            <div style="font-weight:700;color:#60a5fa;font-size:1rem;">${fmtPKR(mb.totalDelivered||0)}</div>
                        </div>
                        <div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center;">
                            <div style="font-size:0.62rem;color:#64748b;margin-bottom:4px;">RECEIVED</div>
                            <div style="font-weight:700;color:#10b981;font-size:1rem;">${fmtPKR(mb.totalReceived||0)}</div>
                        </div>
                        <div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center;">
                            <div style="font-size:0.62rem;color:#64748b;margin-bottom:4px;">BALANCE</div>
                            <div style="font-weight:700;font-size:1rem;color:${mb.close>0?'#f59e0b':'#10b981'};">${fmtPKR(mb.close)}</div>
                        </div>
                    </div>
                </div>`;
            summaryEl.style.display = 'block';
        }
    },

    recordDirectPayment(clientId) {
        const client = state.clients.find(c => c.id === clientId);
        if (!client) return;
        const bal = recalcClientBalance(clientId);

        // Find months that have unpaid balance for dropdown
        const unpaidMonths = {};
        state.routes.forEach(r => {
            (r.deliveries||[]).forEach(d => {
                if (d.clientId === clientId && Number(d.balance||0) > 0) {
                    const m = r.date.slice(0,7);
                    unpaidMonths[m] = (unpaidMonths[m]||0) + Number(d.balance||0);
                }
            });
        });
        const sortedUnpaid = Object.keys(unpaidMonths).sort((a,b) => a.localeCompare(b));
        const mNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const monthOpts = sortedUnpaid.map(m => {
            const [yr,mn] = m.split('-');
            return `<option value="${m}">${mNames[parseInt(mn)]} ${yr} — ${fmtPKR(unpaidMonths[m])} unpaid</option>`;
        }).join('');
        // Default period = oldest unpaid month
        const defaultPeriod = sortedUnpaid[0] || todayStr().slice(0,7);
        const defaultEnd = defaultPeriod ? new Date(defaultPeriod.split('-')[0], parseInt(defaultPeriod.split('-')[1]), 0).toISOString().slice(0,10) : todayStr();

        showModal(`Record Payment — ${client.name}`, `
            <div class="space-y-3">
                <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:10px 14px;">
                    <span style="color:#f59e0b;font-weight:700;">Outstanding Balance: ${fmtPKR(bal)}</span>
                </div>
                <div><label class="block text-sm text-gray-400 mb-1">Amount Received (PKR)</label>
                    <input type="number" id="directPayAmt" class="input-field" value="${bal}" min="0"></div>
                <div><label class="block text-sm text-gray-400 mb-1">Payment Date (actual date received)</label>
                    <input type="date" id="directPayDate" class="input-field" value="${todayStr()}"></div>
                ${sortedUnpaid.length > 0 ? `
                <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:10px 14px;">
                    <label class="block text-sm mb-2" style="color:#60a5fa;font-weight:700;">
                        <i class="fa-solid fa-calendar-days mr-1"></i>Which month's bill is this payment for?
                    </label>
                    <select id="directPayPeriod" class="input-field">
                        ${monthOpts}
                    </select>
                    <div style="font-size:0.72rem;color:#64748b;margin-top:4px;">This makes sure the payment shows in the correct month's ledger</div>
                </div>` : ''}
                <div><label class="block text-sm text-gray-400 mb-1">Note (optional)</label>
                    <input type="text" id="directPayNote" class="input-field" placeholder="e.g. Cash received at door"></div>
            </div>`,
            () => {
                const amount = parseFloat(document.getElementById('directPayAmt')?.value) || 0;
                const date   = document.getElementById('directPayDate')?.value || todayStr();
                const note   = document.getElementById('directPayNote')?.value.trim() || 'Direct payment';
                if (amount <= 0) { showToast('Enter a valid amount!', true); return false; }

                // Get the period this payment belongs to
                const periodMonth = document.getElementById('directPayPeriod')?.value || defaultPeriod;
                const [pyr, pmn] = periodMonth.split('-');
                // End date = last day of selected month
                const periodEnd = new Date(parseInt(pyr), parseInt(pmn), 0).toISOString().slice(0,10);
                const periodStart = periodMonth + '-01';

                if (!state.invoices) state.invoices = [];
                state.invoices.push({
                    id: 'inv_' + Date.now(), invoiceNo: 'PAY-' + Date.now(),
                    clientId, clientName: client.name, clientAddress: client.address || '',
                    clientPhone: client.phone || '',
                    issueDate: date,        // actual date received
                    startDate: periodStart, // month this belongs to
                    endDate: periodEnd,     // last day of that month (used for ledger grouping)
                    createdAt: new Date().toISOString(),
                    grandTotal: amount, periodSales: 0, previousBalance: bal,
                    qty: 0, status: 'PAID', amountPaid: amount,
                    payments: [{ amount, date, note }], items: []
                });
                client.balance = recalcClientBalance(clientId);
                saveLocalState();
                showToast(`Payment of ${fmtPKR(amount)} recorded for ${client.name}!`);
                dashboard.render(); clientsTab.renderList(); syncApp.autoSync();
                if (confirm(`Payment of ${fmtPKR(amount)} recorded!\n\nPrint a receipt?`)) {
                    printPaymentReceipt(client.name, amount, date, note, 'PAY-' + todayStr().replace(/-/g,''));
                }
                this.viewProfile(clientId);
            }
        );
    },

    viewProfile(id) {
        const client = state.clients.find(c => c.id === id);
        if (!client) return;

        // ---- Build monthly ledger ----
        // Step 1: collect all events (deliveries + payments) with date and month key
        const events = [];
        let totQ = 0, totV = 0;

        state.routes.slice().sort((a,b) => a.date.localeCompare(b.date)).forEach(r => {
            (r.deliveries || []).forEach(d => {
                if (d.clientId === id) {
                    totQ += Number(d.qty||0);
                    totV += Number(d.total||0);
                    events.push({ type: 'delivery', date: r.date, month: r.date.slice(0,7), driver: r.driver, qty: d.qty, price: d.price, total: d.total, received: d.received||0, balance: d.balance||0, remarks: d.remarks });
                }
            });
        });

        state.invoices.forEach(inv => {
            if (inv.clientId === id) {
                (inv.payments || []).forEach(p => {
                    // Group payment under invoice period month (endDate), not the actual payment date
                    // This ensures May invoice payments show in May even if paid in June
                    const invMonth = (inv.endDate || inv.issueDate || p.date || '').slice(0, 7);
                    events.push({ type: 'payment', date: p.date, month: invMonth, amount: p.amount, note: p.note || '', invoiceNo: inv.invoiceNo });
                });
            }
        });

        // Step 2: group by month
        const months = {};
        events.forEach(e => {
            if (!e.month) return;
            if (!months[e.month]) months[e.month] = { deliveries: [], payments: [] };
            if (e.type === 'delivery') months[e.month].deliveries.push(e);
            else months[e.month].payments.push(e);
        });

        const sortedMonths = Object.keys(months).sort((a,b) => b.localeCompare(a));

        // Step 3: render monthly blocks
        const monthNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        let runningBalance = 0;
        // Calculate from oldest to newest for running balance
        const allMonthsAsc = [...sortedMonths].reverse();
        const monthBalances = {};
        allMonthsAsc.forEach(m => {
            const mo = months[m];
            const delivTotal    = mo.deliveries.reduce((a,d) => a + Number(d.balance||0), 0);
            const payTotal      = mo.payments.reduce((a,p) => a + Number(p.amount||0), 0);
            const totalDelivered = mo.deliveries.reduce((a,d) => a + Number(d.total||0), 0);
            const totalBottles  = mo.deliveries.reduce((a,d) => a + Number(d.qty||0), 0);
            const totalReceived = mo.deliveries.reduce((a,d) => a + Number(d.received||0), 0) + payTotal;
            const closeRaw      = runningBalance + delivTotal - payTotal;
            monthBalances[m] = {
                open: runningBalance,
                delivTotal,
                payTotal,
                totalDelivered,
                totalBottles,
                totalReceived,
                close: Math.max(0, closeRaw)
            };
            runningBalance = monthBalances[m].close;
        });

        let monthlyHtml = '';
        if (sortedMonths.length === 0) {
            monthlyHtml = '<div style="text-align:center;color:#64748b;padding:24px;">No history yet.</div>';
        } else {
            sortedMonths.forEach(m => {
                const mo   = months[m];
                const mb   = monthBalances[m];
                const [yr, mn] = m.split('-');
                const label = `${monthNames[parseInt(mn)]} ${yr}`;
                const delivRows = mo.deliveries.map(d => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:0.82rem;">
                        <div>
                            <span style="color:#94a3b8;">${fmtDate(d.date)}</span>
                            <span style="margin-left:8px;background:${d.remarks==='Cash'?'rgba(16,185,129,0.15)':d.remarks==='Monthly'?'rgba(59,130,246,0.15)':'rgba(245,158,11,0.15)'};color:${d.remarks==='Cash'?'#10b981':d.remarks==='Monthly'?'#60a5fa':'#f59e0b'};padding:1px 6px;border-radius:9999px;font-size:0.7rem;font-weight:700;">${d.remarks}</span>
                        </div>
                        <div style="text-align:right;">
                            <span style="color:#f1f5f9;font-weight:600;">${d.qty} btl × ${fmtPKR(d.price)}</span>
                            <span style="color:#64748b;margin:0 4px;">→</span>
                            <span style="color:#f1f5f9;font-weight:700;">${fmtPKR(d.total)}</span>
                            ${Number(d.balance||0) > 0 ? `<div style="color:#f59e0b;font-size:0.75rem;">+${fmtPKR(d.balance)} bal</div>` : ''}
                        </div>
                    </div>`).join('');

                const payRows = mo.payments.map(p => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:0.82rem;">
                        <div>
                            <span style="color:#10b981;font-weight:600;">✓ Payment</span>
                            <span style="color:#64748b;margin-left:8px;">${fmtDate(p.date)}${p.invoiceNo?' · '+p.invoiceNo:''}</span>
                            ${p.note ? `<div style="color:#64748b;font-size:0.75rem;">${p.note}</div>` : ''}
                        </div>
                        <div style="color:#10b981;font-weight:700;font-size:0.9rem;">- ${fmtPKR(p.amount)}</div>
                    </div>`).join('');

                monthlyHtml += `
                <div class="month-block" data-month="${m}" style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;margin-bottom:12px;overflow:hidden;">
                    <!-- Month header -->
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#1e293b;cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
                        <div>
                            <span style="font-weight:700;font-size:0.95rem;">${label}</span>
                            <span style="color:#64748b;font-size:0.75rem;margin-left:8px;">${mo.deliveries.length} deliveries · ${mo.payments.length} payments</span>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:0.75rem;color:#64748b;">Opening: ${fmtPKR(mb.open)}</div>
                            <div style="font-weight:700;color:${mb.close>0?'#f59e0b':'#10b981'};">Closing: ${fmtPKR(mb.close)}</div>
                        </div>
                    </div>
                    <!-- Month body -->
                    <div style="padding:10px 14px;">
                        ${delivRows}
                        ${payRows}
                        <!-- Month summary -->
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-top:10px;">
                            <div style="background:#1e293b;border-radius:8px;padding:8px;text-align:center;">
                                <div style="font-size:0.62rem;color:#64748b;">Opening</div>
                                <div style="font-weight:700;color:#94a3b8;font-size:0.85rem;">${fmtPKR(mb.open)}</div>
                            </div>
                            <div style="background:#1e293b;border-radius:8px;padding:8px;text-align:center;">
                                <div style="font-size:0.62rem;color:#64748b;">Delivered</div>
                                <div style="font-weight:700;color:#60a5fa;font-size:0.85rem;">${fmtPKR(mb.totalDelivered)}</div>
                            </div>
                            <div style="background:#1e293b;border-radius:8px;padding:8px;text-align:center;">
                                <div style="font-size:0.62rem;color:#64748b;">Paid</div>
                                <div style="font-weight:700;color:#10b981;font-size:0.85rem;">${fmtPKR(mb.payTotal)}</div>
                            </div>
                            <div style="background:#1e293b;border-radius:8px;padding:8px;text-align:center;">
                                <div style="font-size:0.62rem;color:#64748b;">Closing</div>
                                <div style="font-weight:700;font-size:0.85rem;color:${mb.close>0?'#f59e0b':'#10b981'};">${fmtPKR(mb.close)}</div>
                            </div>
                        </div>
                    </div>
                </div>`;
            });
        }

        // Store month balances globally for filter access
        if (!window._ledgerMonthBalances) window._ledgerMonthBalances = {};
        window._ledgerMonthBalances[id] = monthBalances;
        // Top summary: all time totals
        const totalDelivered = Object.values(months).reduce((a, m) => a + m.deliveries.reduce((b, d) => b + Number(d.total||0), 0), 0);
        const totalPaid      = Object.values(months).reduce((a, m) => a + m.payments.reduce((b, p) => b + Number(p.amount||0), 0), 0);
        const liveBalance    = recalcClientBalance(id);
        const zone           = getZone(client.address || '');
        const el             = document.getElementById('clientProfileContent');
        el.innerHTML = `
            <div class="space-y-4">
                <!-- Client info + Record Payment button -->
                <div style="background:rgba(15,23,42,.6);border:1px solid #1e293b;border-radius:12px;padding:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                        <div>
                            <h4 style="font-size:1.1rem;font-weight:700;">${client.name}</h4>
                            <span style="font-size:0.75rem;color:#64748b;">${zone} · ${client.type}</span>
                        </div>
                        <button onclick="clientsTab.recordDirectPayment('${id}')" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);padding:7px 14px;border-radius:8px;cursor:pointer;font-weight:700;font-size:0.82rem;white-space:nowrap;">
                            <i class="fa-solid fa-plus"></i> Record Payment
                        </button>
                    </div>
                    <!-- Summary bar: updates when month selected -->
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;text-align:center;margin-bottom:10px;">
                        <div style="background:#0f172a;border-radius:8px;padding:8px;">
                            <div style="font-size:0.6rem;color:#64748b;text-transform:uppercase;" id="lbl_opening">Bottles</div>
                            <div style="font-weight:700;font-size:0.9rem;color:#f1f5f9;" id="val_opening">${totQ}</div>
                        </div>
                        <div style="background:#0f172a;border-radius:8px;padding:8px;">
                            <div style="font-size:0.6rem;color:#64748b;text-transform:uppercase;" id="lbl_delivered">Delivered</div>
                            <div style="font-weight:700;font-size:0.9rem;color:#60a5fa;" id="val_delivered">${fmtPKR(totalDelivered)}</div>
                        </div>
                        <div style="background:#0f172a;border-radius:8px;padding:8px;">
                            <div style="font-size:0.6rem;color:#64748b;text-transform:uppercase;" id="lbl_paid">Received</div>
                            <div style="font-weight:700;font-size:0.9rem;color:#10b981;" id="val_paid">${fmtPKR(totalPaid)}</div>
                        </div>
                        <div style="background:#0f172a;border-radius:8px;padding:8px;">
                            <div style="font-size:0.6rem;color:#64748b;text-transform:uppercase;" id="lbl_balance">Balance</div>
                            <div style="font-weight:700;font-size:0.9rem;color:${liveBalance>0?'#f59e0b':'#10b981'};" id="val_balance">${fmtPKR(liveBalance)}</div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:center;">
                        <div style="background:#0f172a;border-radius:8px;padding:8px;">
                            <div style="font-size:0.6rem;color:#64748b;text-transform:uppercase;">Total Bottles</div>
                            <div style="font-weight:700;">${totQ}</div>
                        </div>
                        <div style="background:#0f172a;border-radius:8px;padding:8px;">
                            <div style="font-size:0.6rem;color:#64748b;text-transform:uppercase;">Total Value</div>
                            <div style="font-weight:700;color:#60a5fa;">${fmtPKR(totV)}</div>
                        </div>
                    </div>
                    <div style="margin-top:10px;font-size:0.8rem;color:#64748b;">
                        ${client.address ? '<i class="fa-solid fa-location-dot mr-1"></i>'+client.address : ''}
                        ${client.phone ? ' &nbsp;·&nbsp; <i class="fa-solid fa-phone mr-1"></i>'+client.phone : ''}
                    </div>
                </div>

                <!-- Monthly Ledger -->
                <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
                        <h4 style="font-weight:700;font-size:0.85rem;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;">
                            <i class="fa-solid fa-calendar-days mr-2"></i>Monthly Ledger
                        </h4>
                        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                            <select id="ledgerMonthFilter" onchange="clientsTab.filterLedger('${id}')"
                                style="background:#1e293b;border:1px solid #334155;color:#f1f5f9;padding:5px 10px;border-radius:8px;font-size:0.8rem;outline:none;">
                                <option value="all">All Months</option>
                                ${sortedMonths.map(m => {
                                    const [yr,mn] = m.split('-');
                                    const names = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                                    return `<option value="${m}">${names[parseInt(mn)]} ${yr}</option>`;
                                }).join('')}
                            </select>
                        </div>
                    </div>
                    <div id="ledgerSummarySelected" style="display:none;"></div>
                    <div id="ledgerMonthlyContent">${monthlyHtml}</div>
                </div>
            </div>`;
        document.getElementById('clientProfileModal').classList.add('show');
    }
};

// ==========================================
// INVOICES MODULE
// ==========================================
const invoicesTab = {
    activeInvoice: null,
    selectedClientId: null,
    init() {
        const today = new Date();
        document.getElementById("invoiceDateStart").value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        document.getElementById("invoiceDateEnd").value = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        document.getElementById("invoiceIssueDate").value = today.toISOString().split('T')[0];
        this.renderClientGrid();
        this.renderList();
    },
    renderClientGrid() {
        const grid = document.getElementById("invoiceClientGrid");
        if (!grid) return;
        grid.innerHTML = "";
        state.clients.forEach(client => {
            const card = document.createElement("div");
            card.className = `client-card ${this.selectedClientId === client.id ? 'selected' : ''}`;
            card.onclick = () => this.selectClient(client.id);
            card.innerHTML = `
                <div class="flex items-start justify-between mb-2">
                    <strong class="text-sm truncate flex-1">${client.name}</strong>
                    <span class="badge ${client.type === 'Daily' ? 'badge-daily' : 'badge-monthly'} text-xs ml-2">${client.type}</span>
                </div>
                <div class="flex items-center justify-between text-xs">
                    <span class="text-gray-500">${getZone(client.address || '')}</span>
                    <span class="${Number(client.balance) > 0 ? 'text-amber-400 font-bold' : 'text-gray-400'}">${fmtPKR(client.balance)}</span>
                </div>`;
            grid.appendChild(card);
        });
    },
    selectClient(clientId) {
        this.selectedClientId = clientId;
        this.renderClientGrid();
        const client = state.clients.find(c => c.id === clientId);
        if (client) {
            const inp = document.getElementById("invoiceClientSearch");
            if (inp) { inp.value = client.name; inp.setAttribute("data-client-id", client.id); }
        }
    },
    quickMonthSet(mode) {
        const today = new Date();
        let start, end;
        if (mode === 'prev') {
            // Previous month: 1st to last day
            const yr  = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
            const mn  = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
            start = new Date(yr, mn, 1).toISOString().split('T')[0];
            end   = new Date(yr, mn + 1, 0).toISOString().split('T')[0]; // last day of prev month
        } else {
            // Current month: 1st to last day of this month (not today)
            start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            end   = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        }
        document.getElementById("invoiceDateStart").value = start;
        document.getElementById("invoiceDateEnd").value = end;
    },
    generateInvoice() {
        const inp = document.getElementById("invoiceClientSearch");
        let cid = inp ? inp.getAttribute("data-client-id") : null;
        let client = null;
        if (cid) client = state.clients.find(c => c.id === cid);
        if (!client && this.selectedClientId) client = state.clients.find(c => c.id === this.selectedClientId);
        if (!client) { showToast("Please select a client!", true); return; }
        
        const start = document.getElementById("invoiceDateStart").value;
        const end = document.getElementById("invoiceDateEnd").value;
        const issueDate = document.getElementById("invoiceIssueDate").value;
        
        let items = [], totQ = 0, totS = 0, openBal = 0;
        state.routes.forEach(r => {
            if (!r.deliveries) return;
            r.deliveries.forEach(d => {
                if (d.clientId === client.id) {
                    if (r.date >= start && r.date <= end) {
                        items.push({ date: r.date, driver: r.driver || "", vehicle: r.vehicle || "", qty: d.qty || 0, price: d.price || 0, total: d.total || 0 });
                        totQ += (d.qty || 0); totS += (d.total || 0);
                    }
                    if (r.date < start && d.balance) openBal += Number(d.balance);
                }
            });
        });

        // Subtract all payments made BEFORE the start date from openBal (previous balance)
        state.invoices.forEach(inv2 => {
            if (inv2.clientId === client.id) {
                (inv2.payments || []).forEach(p => {
                    if (p.date < start) openBal = Math.max(0, openBal - Number(p.amount || 0));
                });
            }
        });
        openBal = Math.max(0, openBal);

        // Calculate mid-period payments (collected DURING the invoice period via BAL- or PAY- records)
        // These are partial cash collections made during the month e.g. client paid PKR 1,000 on a route
        let midPeriodPaid = 0;
        let midPeriodPayments = []; // to show on invoice as "Already Collected"
        state.invoices.forEach(inv2 => {
            if (inv2.clientId === client.id) {
                const isMidPeriod = inv2.invoiceNo.startsWith('BAL-') || inv2.invoiceNo.startsWith('PAY-');
                if (isMidPeriod) {
                    (inv2.payments || []).forEach(p => {
                        if (p.date >= start && p.date <= end) {
                            midPeriodPaid += Number(p.amount || 0);
                            midPeriodPayments.push({ date: p.date, amount: p.amount, note: p.note || 'Collected on route' });
                        }
                    });
                }
            }
        });

        if (items.length === 0 && midPeriodPaid === 0) { showToast(`No deliveries found for ${client.name} in this period`, true); return; }

        // Grand total = previous balance + period sales - mid period already collected
        const grandTotalCalc = Math.max(0, openBal + totS - midPeriodPaid);

        const inv = {
            id: 'inv_' + Date.now(),
            invoiceNo: 'INV-' + String(state.invoices.length + 1001).padStart(4, '0'),
            clientId: client.id, clientName: client.name,
            clientAddress: client.address || "", clientPhone: client.phone || "",
            startDate: start, endDate: end, issueDate: issueDate,
            items: items, qty: totQ, periodSales: totS,
            previousBalance: openBal, 
            midPeriodPaid,          // amount already collected during this period
            midPeriodPayments,      // detail of those collections
            grandTotal: grandTotalCalc,
            amountPaid: 0, payments: [], status: 'UNPAID', createdAt: new Date().toISOString()
        };

        state.invoices.push(inv);
        saveLocalState();
        showToast(`Invoice ${inv.invoiceNo} generated!`);
        this.renderList();
        this.openPreview(inv.id);
        syncApp.autoSync();
    },
    delete(id) {
        if (!confirm("Delete this invoice?")) return;
        state.invoices = state.invoices.filter(i => i.id !== id);
        saveLocalState(); this.renderList(); syncApp.autoSync();
        showToast("Invoice deleted.");
    },
    renderList() {
        const tbody = document.getElementById("invoiceTableBody");
        if (!tbody) return;
        tbody.innerHTML = "";

        // Filter out PAY- and BAL- direct payment records from invoice list
        const realInvoices = state.invoices.filter(inv =>
            !inv.invoiceNo.startsWith('PAY-') && !inv.invoiceNo.startsWith('BAL-')
        );

        if (realInvoices.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748b;padding:2rem;">No invoices generated yet</td></tr>`;
            return;
        }

        // Group by month (using endDate)
        const groups = {};
        [...realInvoices].sort((a,b) => b.endDate?.localeCompare(a.endDate||'')||0).forEach(inv => {
            const month = (inv.endDate || inv.issueDate || '').slice(0,7);
            if (!groups[month]) groups[month] = [];
            groups[month].push(inv);
        });

        const mNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const sortedMonths = Object.keys(groups).sort((a,b) => b.localeCompare(a));

        sortedMonths.forEach(month => {
            const invs = groups[month];
            const [yr, mn] = month.split('-');
            const label = `${mNames[parseInt(mn)]} ${yr}`;

            // Month totals
            const totalAmt  = invs.reduce((a,i) => a + Number(i.grandTotal||0), 0);
            const totalPaid = invs.reduce((a,i) => a + Number(i.amountPaid||0), 0);
            const totalDue  = totalAmt - totalPaid;
            const paidCount = invs.filter(i => i.status === 'PAID').length;
            const unpaidCount = invs.filter(i => i.status !== 'PAID').length;

            // Month header row
            const headerTr = document.createElement('tr');
            headerTr.style.cssText = 'background:#1e293b;cursor:pointer;';
            headerTr.onclick = () => {
                const rows = tbody.querySelectorAll(`[data-month="${month}"]`);
                const hidden = rows[0]?.style.display === 'none';
                rows.forEach(r => r.style.display = hidden ? '' : 'none');
                const icon = headerTr.querySelector('.toggle-icon');
                if(icon) icon.textContent = hidden ? '▼' : '▶';
            };
            headerTr.innerHTML = `
                <td colspan="3" style="padding:10px 12px;font-weight:700;color:#60a5fa;font-size:0.9rem;">
                    <span class="toggle-icon" style="margin-right:8px;font-size:0.7rem;">▼</span>
                    📅 ${label}
                    <span style="color:#64748b;font-weight:400;font-size:0.78rem;margin-left:8px;">${invs.length} invoices · ${paidCount} paid · ${unpaidCount} unpaid</span>
                </td>
                <td style="padding:10px 12px;text-align:right;">
                    <span style="color:#64748b;font-size:0.75rem;">Total: </span>
                    <span style="font-weight:700;color:#f1f5f9;">${fmtPKR(totalAmt)}</span>
                </td>
                <td style="padding:10px 12px;text-align:right;">
                    <span style="font-weight:700;color:#10b981;">${fmtPKR(totalPaid)}</span>
                </td>
                <td style="padding:10px 12px;text-align:right;">
                    <span style="font-weight:700;color:${totalDue>0?'#f59e0b':'#10b981'};">${fmtPKR(totalDue)}</span>
                </td>
                <td></td>`;
            tbody.appendChild(headerTr);

            // Invoice rows for this month
            invs.forEach(inv => {
                const remaining = inv.grandTotal - (inv.amountPaid||0);
                const tr = document.createElement('tr');
                tr.className = 'table-row border-b border-gray-800';
                tr.setAttribute('data-month', month);
                tr.innerHTML = `
                    <td class="py-3" style="padding-left:28px;"><strong>${inv.invoiceNo}</strong></td>
                    <td class="py-3">${inv.clientName}</td>
                    <td class="py-3 hide-mobile" style="font-size:0.8rem;color:#64748b;">${fmtDate(inv.startDate)} → ${fmtDate(inv.endDate)}</td>
                    <td class="py-3">${inv.qty}</td>
                    <td class="py-3 font-bold">${fmtPKR(inv.grandTotal)}</td>
                    <td class="py-3"><span class="badge ${inv.status==='PAID'?'badge-paid':inv.status==='PARTIAL'?'badge-partial':'badge-unpaid'}">${inv.status}</span>
                    ${inv.status==='PARTIAL'?`<div style="font-size:0.7rem;color:#f59e0b;margin-top:2px;">Due: ${fmtPKR(remaining)}</div>`:''}
                    </td>
                    <td class="py-3">
                        <div class="flex gap-2">
                            <button class="btn-secondary" onclick="invoicesTab.openPreview('${inv.id}')"><i class="fa-solid fa-eye"></i></button>
                            <button class="btn-danger" onclick="invoicesTab.delete('${inv.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>`;
                tbody.appendChild(tr);
            });
        });
    },
    recordPartialPayment() {
        if (!this.activeInvoice) return;
        const inv = this.activeInvoice;
        const remaining = inv.grandTotal - (inv.amountPaid || 0);
        if (remaining <= 0) { showToast("Invoice is already fully paid!", true); return; }
        
        showModal("Record Partial Payment", `
            <div style="display:grid;gap:14px">
                <div class="p-3 rounded-lg" style="background:rgba(15,23,42,.5)">
                    <div class="flex justify-between text-sm mb-1"><span class="text-gray-400">Invoice Total:</span><span class="font-bold">${fmtPKR(inv.grandTotal)}</span></div>
                    <div class="flex justify-between text-sm mb-1"><span class="text-gray-400">Already Paid:</span><span class="font-bold text-green-400">${fmtPKR(inv.amountPaid || 0)}</span></div>
                    <div class="flex justify-between text-sm"><span class="text-gray-400">Remaining:</span><span class="font-bold text-amber-400">${fmtPKR(remaining)}</span></div>
                </div>
                <div><label class="block text-sm text-gray-400 mb-1">Amount Received (PKR)</label><input id="partialPayAmount" type="number" inputmode="numeric" class="input-field" placeholder="e.g. 500" max="${remaining}"></div>
                <div><label class="block text-sm text-gray-400 mb-1">Payment Date</label><input id="partialPayDate" type="date" class="input-field" value="${inv.endDate || inv.issueDate || todayStr()}"></div>
                <div><label class="block text-sm text-gray-400 mb-1">Note (optional)</label><input id="partialPayNote" type="text" class="input-field" placeholder="e.g. Cash in hand"></div>
            </div>`, () => {
            const amount = parseFloat(document.getElementById("partialPayAmount").value) || 0;
            const date = document.getElementById("partialPayDate").value;
            const note = document.getElementById("partialPayNote").value.trim();
            
            if (amount <= 0) { showToast("Enter a valid amount!", true); return false; }
            if (amount > remaining) { showToast(`Amount cannot exceed remaining balance!`, true); return false; }

            if (!inv.payments) inv.payments = [];
            inv.payments.push({ amount, date, note });
            inv.amountPaid = (inv.amountPaid || 0) + amount;
            inv.status = (inv.grandTotal - inv.amountPaid <= 0) ? 'PAID' : 'PARTIAL';

            const client = state.clients.find(c => c.id === inv.clientId);
            if (client) client.balance = recalcClientBalance(inv.clientId);

            saveLocalState();
            showToast(`Payment of ${fmtPKR(amount)} recorded!`);
            dashboard.render();
            this.renderList(); this.renderClientGrid(); clientsTab.renderList(); syncApp.autoSync();
            this.openPreview(inv.id);
        });
    },
    openPreview(id) {
        const inv = state.invoices.find(i => i.id === id);
        if (!inv) return;
        this.activeInvoice = inv;
        if (!inv.payments) inv.payments = [];
        if (typeof inv.amountPaid === 'undefined') inv.amountPaid = 0;

        const amountPaid = inv.amountPaid || 0;
        const remaining = inv.grandTotal - amountPaid;
        let subtotal = 0;
        inv.items.forEach(item => { subtotal += (item.qty * item.price); });

        let itemsHtml = "";
        inv.items.forEach((item, idx) => {
            itemsHtml += `<tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td>${fmtDate(item.date)}</td>
                <td>Water Bottle (19L)<br><span style="font-size:11px;color:#64748b">Veh: ${item.vehicle}, Driver: ${item.driver}</span></td>
                <td style="text-align:center;">${item.qty}</td>
                <td style="text-align:right;">PKR ${item.price}</td>
                <td style="text-align:right;font-weight:bold;">PKR ${(item.qty * item.price).toLocaleString()}</td>
            </tr>`;
        });

        // Payment history for THIS invoice
        let paymentHistoryHtml = '';
        if (inv.payments && inv.payments.length > 0) {
            paymentHistoryHtml = inv.payments.map(p =>
                `<tr style="background:#f0fdf4">
                    <td colspan="4" style="text-align:right;color:#16a34a;padding:8px 10px;">${fmtDate(p.date)}${p.note ? ' – ' + p.note : ''}</td>
                    <td colspan="2" style="text-align:right;color:#16a34a;font-weight:bold;padding:8px 10px;">- PKR ${Number(p.amount).toLocaleString()}</td>
                </tr>`
            ).join('');
        }

        // ALL previous payments across ALL invoices for this client (payment history summary)
        let allClientPayments = [];
        state.invoices.forEach(otherInv => {
            if (otherInv.clientId === inv.clientId) {
                (otherInv.payments || []).forEach(p => {
                    allClientPayments.push({ date: p.date, amount: p.amount, note: p.note || '', invoiceNo: otherInv.invoiceNo });
                });
            }
        });
        // Exclude direct PAY- payments from the all-time total (those are direct cash, not invoices)
        allClientPayments = allClientPayments.filter(p => !p.invoiceNo.startsWith('PAY-'));
        allClientPayments.sort((a,b) => (b.date||'').localeCompare(a.date||''));
        const totalEverPaid = allClientPayments.reduce((a,p) => a + Number(p.amount||0), 0);
        const allPayHtml = allClientPayments.length > 0 ? `
            <div style="margin-top:20px;padding:14px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;">
                <div style="font-weight:700;color:#16a34a;margin-bottom:10px;font-size:0.9rem;">
                    <i class="fa-solid fa-clock-rotate-left" style="margin-right:6px;"></i>
                    Complete Payment History — ${inv.clientName}
                </div>
                ${allClientPayments.map(p => `
                    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #dcfce7;font-size:0.82rem;">
                        <span style="color:#374151;">${p.date} · ${p.invoiceNo}${p.note?' · '+p.note:''}</span>
                        <span style="color:#16a34a;font-weight:700;">PKR ${Number(p.amount).toLocaleString()}</span>
                    </div>`).join('')}
                <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:700;font-size:0.95rem;margin-top:4px;">
                    <span>Total Paid (All Time)</span>
                    <span style="color:#16a34a;">PKR ${totalEverPaid.toLocaleString()}</span>
                </div>
            </div>` : '';

        let statusColor = '#f59e0b', statusText = 'UNPAID';
        if (inv.status === 'PAID') { statusColor = '#10b981'; statusText = 'PAID IN FULL'; }
        else if (inv.status === 'PARTIAL') { statusColor = '#3b82f6'; statusText = `PARTIALLY PAID (${fmtPKR(amountPaid)} received)`; }

        document.getElementById("invoicePdfArea").innerHTML = `
            <div style="margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e2e8f0;">
                <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:12px;">
                    <div><h1 style="font-size:2rem;font-weight:bold;color:#0ea5e9;margin-bottom:8px;">AQUA PACK</h1>
                    <p style="color:#64748b;font-size:0.9rem;">Clean. Purified. Delivered Daily.</p></div>
                    <div style="text-align:right;">
                        <h2 style="font-size:1.5rem;font-weight:bold;margin-bottom:8px;">INVOICE</h2>
                        <p style="font-size:0.9rem;"><strong>Invoice #:</strong> ${inv.invoiceNo}</p>
                        <p style="font-size:0.9rem;"><strong>Issue Date:</strong> ${fmtDate(inv.issueDate)}</p>
                    </div>
                </div>
            </div>
            <div style="margin-bottom:24px;">
                <h3 style="font-weight:600;margin-bottom:8px;">Billed To:</h3>
                <p style="font-size:1.1rem;font-weight:bold;">${inv.clientName}</p>
                <p style="color:#64748b;font-size:0.9rem;">${inv.clientAddress}</p>
            </div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#f1f5f9;"><th style="padding:10px;text-align:left;">S.No</th><th style="padding:10px;text-align:left;">Date</th><th style="padding:10px;text-align:left;">Particulars</th><th style="padding:10px;text-align:center;">Qty</th><th style="padding:10px;text-align:right;">Rate</th><th style="padding:10px;text-align:right;">Amount</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot>
                    <tr style="background:#f8fafc"><td colspan="4" style="text-align:right;font-weight:bold;padding:10px;">Subtotal:</td><td colspan="2" style="text-align:right;font-weight:bold;padding:10px;">PKR ${subtotal.toLocaleString()}</td></tr>
                    ${inv.previousBalance > 0 ? `<tr><td colspan="4" style="text-align:right;padding:10px;">Previous Balance:</td><td colspan="2" style="text-align:right;color:#ef4444;padding:10px;">+ PKR ${inv.previousBalance.toLocaleString()}</td></tr>` : ''}
                    <tr style="border-top:2px solid #e2e8f0"><td colspan="4" style="text-align:right;font-weight:bold;font-size:1.05rem;padding:10px;">Grand Total:</td><td colspan="2" style="text-align:right;font-weight:bold;font-size:1.05rem;color:#0ea5e9;padding:10px;">PKR ${inv.grandTotal.toLocaleString()}</td></tr>
                    ${inv.midPeriodPaid > 0 ? `<tr style="background:#fefce8"><td colspan="4" style="text-align:right;padding:10px;color:#92400e;font-weight:600;">Already Collected (mid-month):</td><td colspan="2" style="text-align:right;color:#16a34a;font-weight:bold;padding:10px;">- PKR ${Number(inv.midPeriodPaid).toLocaleString()}</td></tr>` : ''}
                    ${paymentHistoryHtml}
                    ${amountPaid > 0 ? `<tr style="border-top:2px solid #e2e8f0;background:#f0fdf4"><td colspan="4" style="text-align:right;font-weight:bold;font-size:1.1rem;padding:10px;">Amount Due:</td><td colspan="2" style="text-align:right;font-weight:bold;font-size:1.1rem;color:${remaining > 0 ? '#ef4444' : '#10b981'};padding:10px;">PKR ${remaining.toLocaleString()}</td></tr>` : ''}
                </tfoot>
            </table>
            <div style="display:flex;justify-content:space-between;margin-top:24px;flex-wrap:wrap;gap:12px;">
                <div style="color:#64748b;font-size:0.9rem;"><p>Thank you for choosing AQUA PACK!</p></div>
                <div style="text-align:right;">
                    <div><span style="color:#64748b;">Status:</span> <span style="font-weight:bold;margin-left:16px;color:${statusColor};">${statusText}</span></div>
                </div>
            </div>
            ${allPayHtml}`;

        const paidBtn = document.getElementById("invoiceMarkPaidBtn");
        const partialBtn = document.getElementById("invoicePartialBtn");
        if (paidBtn) {
            paidBtn.style.display = inv.status === 'PAID' ? 'none' : 'inline-flex';
            paidBtn.innerText = inv.status === 'PARTIAL' ? `Mark Fully Paid (${fmtPKR(remaining)} left)` : 'Mark as Paid';
        }
        if (partialBtn) partialBtn.style.display = inv.status === 'PAID' ? 'none' : 'inline-flex';

        document.getElementById("invoiceModal").classList.add("show");
    },
    closeModal() { document.getElementById("invoiceModal").classList.remove("show"); this.activeInvoice = null; },
    markAsPaid() {
        if (!this.activeInvoice) return;
        const inv = this.activeInvoice;
        const remaining = inv.grandTotal - (inv.amountPaid || 0);
        if (remaining <= 0) { showToast("Already fully paid!", true); return; }
        
        const client = state.clients.find(c => c.id === inv.clientId);
        if (!confirm(`Mark full payment of ${fmtPKR(remaining)} for ${client ? client.name : 'this client'}? This will deduct from their ledger balance.`)) return;

        if (!inv.payments) inv.payments = [];
        // Use invoice end date as payment date (not today) so it records in correct month
        const payDate = inv.endDate || inv.issueDate || todayStr();
        inv.payments.push({ amount: remaining, date: payDate, note: 'Marked as fully paid' });
        inv.amountPaid = inv.grandTotal;
        inv.status = 'PAID';

        if (client) client.balance = recalcClientBalance(inv.clientId);

        saveLocalState();
        showToast(`Invoice ${inv.invoiceNo} marked as PAID! Client ledger updated.`);
        this.closeModal();
        dashboard.render();
        this.renderList();
        this.renderClientGrid();
        clientsTab.renderList();
        syncApp.autoSync();
    },
    exportPdf() {
        if (!this.activeInvoice) return;
        const inv = this.activeInvoice;
        const filename = `${inv.invoiceNo}_${inv.clientName.replace(/\s+/g, '_')}`;

        const amountPaid = inv.amountPaid || 0;
        const remaining = inv.grandTotal - amountPaid;
        let subtotal = 0;
        inv.items.forEach(item => { subtotal += (item.qty * item.price); });

        let itemsHtml = inv.items.map((item, idx) => `
            <tr>
                <td style="text-align:center;padding:8px 10px;border-bottom:1px solid #e2e8f0;">${idx + 1}</td>
                <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${item.date}</td>
                <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">Water Bottle (19L)<br><span style="font-size:11px;color:#94a3b8">Vehicle: ${item.vehicle} &nbsp;|&nbsp; Driver: ${item.driver}</span></td>
                <td style="text-align:center;padding:8px 10px;border-bottom:1px solid #e2e8f0;">${item.qty}</td>
                <td style="text-align:right;padding:8px 10px;border-bottom:1px solid #e2e8f0;">PKR ${Number(item.price).toLocaleString()}</td>
                <td style="text-align:right;font-weight:700;padding:8px 10px;border-bottom:1px solid #e2e8f0;">PKR ${(item.qty * item.price).toLocaleString()}</td>
            </tr>`).join('');

        let paymentRowsHtml = '';
        if (inv.payments && inv.payments.length > 0) {
            paymentRowsHtml = inv.payments.map(p => `
                <tr style="background:#f0fdf4;">
                    <td colspan="4" style="text-align:right;padding:8px 10px;color:#16a34a;">${fmtDate(p.date)}${p.note ? ' — ' + p.note : ''}</td>
                    <td colspan="2" style="text-align:right;font-weight:700;padding:8px 10px;color:#16a34a;">− PKR ${Number(p.amount).toLocaleString()}</td>
                </tr>`).join('');
        }

        let statusColor = '#f59e0b', statusText = 'UNPAID';
        if (inv.status === 'PAID')    { statusColor = '#16a34a'; statusText = 'PAID IN FULL'; }
        if (inv.status === 'PARTIAL') { statusColor = '#3b82f6'; statusText = `PARTIALLY PAID (PKR ${amountPaid.toLocaleString()} received)`; }

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${filename}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; background: #fff; }
  .page { max-width: 800px; margin: 0 auto; padding: 40px 48px; }
  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 3px solid #0ea5e9; margin-bottom: 28px; }
  .brand-name { font-size: 32px; font-weight: 900; color: #0ea5e9; letter-spacing: -1px; }
  .brand-tagline { font-size: 12px; color: #64748b; margin-top: 4px; }
  .brand-contact { font-size: 11px; color: #64748b; margin-top: 6px; }
  .invoice-meta { text-align: right; }
  .invoice-meta h2 { font-size: 22px; font-weight: 800; color: #1e293b; letter-spacing: 2px; }
  .invoice-meta p { font-size: 12px; color: #64748b; margin-top: 4px; }
  .invoice-meta .inv-no { font-size: 15px; font-weight: 700; color: #0ea5e9; margin-top: 6px; }
  /* Bill to */
  .bill-section { display: flex; justify-content: space-between; margin-bottom: 28px; }
  .bill-to { background: #f8fafc; border-left: 4px solid #0ea5e9; padding: 14px 18px; border-radius: 0 6px 6px 0; flex: 1; margin-right: 20px; }
  .bill-to h4 { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .bill-to .client-name { font-size: 17px; font-weight: 800; color: #0f172a; }
  .bill-to .client-info { font-size: 12px; color: #64748b; margin-top: 4px; }
  .period-box { background: #f8fafc; padding: 14px 18px; border-radius: 6px; text-align: right; min-width: 180px; }
  .period-box h4 { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .period-box p { font-size: 12px; color: #475569; margin-top: 3px; }
  /* Table */
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  thead tr { background: #0f172a; color: #fff; }
  thead th { padding: 11px 10px; text-align: left; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tfoot tr { background: #f1f5f9; }
  /* Status stamp */
  .status-stamp { display: inline-block; border: 3px solid ${statusColor}; color: ${statusColor}; font-size: 15px; font-weight: 900; letter-spacing: 2px; padding: 6px 18px; border-radius: 6px; transform: rotate(-2deg); text-transform: uppercase; }
  /* Footer */
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; }
  .footer-note { font-size: 11px; color: #94a3b8; }
  @page { size: A4 portrait; margin: 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none; } }
</style>
</head>
<body>
<div class="page">

  <!-- TOP PRINT BUTTON (hidden on print) -->
  <div class="no-print" style="text-align:right;margin-bottom:20px;">
    <button onclick="window.print()" style="background:#0ea5e9;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;">
      ⬇ Download / Print PDF
    </button>
  </div>

  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="brand-name">💧 AQUA PACK</div>
      <div class="brand-tagline">Clean. Purified. Delivered Daily.</div>
      <div class="brand-contact">Rawalpindi / Islamabad</div>
    </div>
    <div class="invoice-meta">
      <h2>INVOICE</h2>
      <div class="inv-no">${inv.invoiceNo}</div>
      <p><strong>Issue Date:</strong> ${fmtDate(inv.issueDate)}</p>
      <p><strong>Period:</strong> ${fmtDate(inv.startDate)} → ${fmtDate(inv.endDate)}</p>
    </div>
  </div>

  <!-- BILL TO + PERIOD -->
  <div class="bill-section">
    <div class="bill-to">
      <h4>Billed To</h4>
      <div class="client-name">${inv.clientName}</div>
      ${inv.clientAddress ? `<div class="client-info">📍 ${inv.clientAddress}</div>` : ''}
      ${inv.clientPhone   ? `<div class="client-info">📞 ${inv.clientPhone}</div>`   : ''}
    </div>
    <div class="period-box">
      <h4>Summary</h4>
      <p><strong>Total Bottles:</strong> ${inv.qty}</p>
      <p><strong>Issue Date:</strong> ${fmtDate(inv.issueDate)}</p>
      <p><strong>Status:</strong> <span style="color:${statusColor};font-weight:700;">${inv.status}</span></p>
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <table>
    <thead>
      <tr>
        <th style="text-align:center;width:40px;">#</th>
        <th>Date</th>
        <th>Description</th>
        <th style="text-align:center;width:60px;">Qty</th>
        <th style="text-align:right;width:90px;">Rate</th>
        <th style="text-align:right;width:110px;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
    <tfoot>
      <tr>
        <td colspan="4" style="text-align:right;font-weight:700;padding:10px;">Subtotal:</td>
        <td colspan="2" style="text-align:right;font-weight:700;padding:10px;">PKR ${subtotal.toLocaleString()}</td>
      </tr>
      ${inv.previousBalance > 0 ? `
      <tr>
        <td colspan="4" style="text-align:right;padding:8px 10px;color:#ef4444;">Previous Balance:</td>
        <td colspan="2" style="text-align:right;padding:8px 10px;color:#ef4444;font-weight:700;">+ PKR ${Number(inv.previousBalance).toLocaleString()}</td>
      </tr>` : ''}
      <tr style="background:#0f172a;color:#fff;">
        <td colspan="4" style="text-align:right;font-weight:800;font-size:15px;padding:12px 10px;">Grand Total:</td>
        <td colspan="2" style="text-align:right;font-weight:800;font-size:15px;padding:12px 10px;color:#38bdf8;">PKR ${Number(inv.grandTotal).toLocaleString()}</td>
      </tr>
      ${paymentRowsHtml}
      ${amountPaid > 0 ? `
      <tr style="background:#f0fdf4;">
        <td colspan="4" style="text-align:right;font-weight:800;font-size:14px;padding:12px 10px;">Amount Due:</td>
        <td colspan="2" style="text-align:right;font-weight:800;font-size:14px;padding:12px 10px;color:${remaining > 0 ? '#ef4444' : '#16a34a'};">PKR ${remaining.toLocaleString()}</td>
      </tr>` : ''}
    </tfoot>
  </table>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-note">
      <p>Thank you for choosing Aqua Pack!</p>
      <p style="margin-top:4px;">For queries, contact us on WhatsApp.</p>
    </div>
    <div style="text-align:right;">
      <div class="status-stamp">${statusText}</div>
      <div style="margin-top:28px;border-top:1px solid #cbd5e1;padding-top:8px;font-size:11px;color:#94a3b8;">Authorized Signature</div>
    </div>
  </div>

</div>
</body>
</html>`;

        const printWindow = window.open('', '_blank', 'width=900,height=750');
        if (!printWindow) { showToast("Popup blocked! Allow popups for this site.", true); return; }
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
    }
};

// ==========================================
// EXPENSES MODULE
// ==========================================
const expensesTab = {
    init() { document.getElementById("expenseDate").value = todayStr(); this.renderList(); },
    save() {
        const date = document.getElementById("expenseDate").value;
        const category = document.getElementById("expenseCategory").value;
        const details = document.getElementById("expenseDetails").value.trim();
        const amount = parseFloat(document.getElementById("expenseAmount").value) || 0;
        if (!date || !details || amount <= 0) return showToast("Date, Details & Amount required!", true);
        state.expenses.push({ id: 'exp_' + Date.now(), date, category, details, amount });
        saveLocalState();
        showToast("Expense logged.");
        document.getElementById("expenseDetails").value = "";
        document.getElementById("expenseAmount").value = "";
        this.renderList(); dashboard.render(); syncApp.autoSync();
    },
    delete(id) {
        if (!confirm("Delete this expense?")) return;
        state.expenses = state.expenses.filter(e => e.id !== id);
        saveLocalState(); this.renderList(); dashboard.render(); syncApp.autoSync();
        showToast("Expense deleted.");
    },
    renderList() {
        const tbody = document.getElementById("expenseTableBody");
        if (!tbody) return;
        tbody.innerHTML = "";
        if (state.expenses.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:2rem;">No expenses logged</td></tr>`; return; }
        [...state.expenses].sort((a, b) => b.date.localeCompare(a.date)).forEach(exp => {
            const tr = document.createElement("tr");
            tr.className = "table-row border-b border-gray-800";
            tr.innerHTML = `
                <td class="py-3"><strong>${fmtDate(exp.date)}</strong></td>
                <td class="py-3"><span class="badge badge-bal">${exp.category}</span></td>
                <td class="py-3">${exp.details}</td>
                <td class="py-3 text-red-400 font-bold">${fmtPKR(exp.amount)}</td>
                <td class="py-3 text-center"><button class="btn-danger" onclick="expensesTab.delete('${exp.id}')"><i class="fa-solid fa-trash"></i></button></td>`;
            tbody.appendChild(tr);
        });
    }
};

// ==========================================
// SYNC MODULE (FIXED CORS & VERIFICATION)
// ==========================================
const syncApp = {
    isSyncing: false,
    lastSyncTime: null,

    init() {
        if (state.config.webAppUrl) {
            document.getElementById("webAppUrl").value = state.config.webAppUrl;
            this.setStatus(true);
        } else {
            this.setStatus(false);
        }
    },

    setStatus(online, message) {
        const dot     = document.getElementById("statusDot");
        const txt     = document.getElementById("statusText");
        const syncDot = document.getElementById("syncStatusDot");
        const syncTxt = document.getElementById("syncStatusText");
        const label   = message || (online ? "Synced Online" : "Offline Storage");
        const color   = online ? "bg-green-500" : "bg-red-500";
        [dot, syncDot].forEach(d => { if (d) d.className = `w-2 h-2 rounded-full ${color}`; });
        [txt, syncTxt].forEach(t => { if (t) t.innerText = label; });
    },

    saveConfig() {
        const url = document.getElementById("webAppUrl").value.trim();
        if (!url) return showToast("URL is required!", true);
        state.config.webAppUrl = url;
        saveLocalState();
        this.setStatus(true, "Testing...");
        showToast("Config saved. Testing connection with a push...");
        // Test by pushing — safer than pulling which could overwrite local data
        this.pushToSheets(false);
    },

    clearConfig() {
        state.config.webAppUrl = "";
        document.getElementById("webAppUrl").value = "";
        saveLocalState();
        this.setStatus(false);
        showToast("Config cleared.");
    },

    manualSync()  { this.pushToSheets(false); },
    autoSync()    { if (state.config.webAppUrl && !this.isSyncing) this.pushToSheets(true); },

    pullFromSheets(silent = false) {
        if (!state.config.webAppUrl) { showToast("No URL configured!", true); return; }
        // Don't block pull on isSyncing — manual pull should always go through
        if (this.isSyncing && silent) return;
        this.isSyncing = true;
        this.setStatus(true, "Pulling...");

        fetch(`${state.config.webAppUrl}`)
            .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
            .then(data => {
                if (data.status === 'error') throw new Error(data.message || "Pull failed");

                // SAFE MERGE: only overwrite if Google Sheets has MORE data than local
                // This prevents empty sheets from wiping your local data
                let updated = [];
                if (data.clients  && data.clients.length  > state.clients.length)  { state.clients  = data.clients;  updated.push(`${data.clients.length} clients`); }
                if (data.routes   && data.routes.length   > state.routes.length)   { state.routes   = data.routes;   updated.push(`${data.routes.length} routes`); }
                if (data.expenses && data.expenses.length > state.expenses.length)  { state.expenses = data.expenses; updated.push(`${data.expenses.length} expenses`); }
                if (data.invoices && data.invoices.length > state.invoices.length)  { state.invoices = data.invoices; updated.push(`${data.invoices.length} invoices`); }
                if (data.staff          && data.staff.length          > (state.staff||[]).length)          { state.staff          = data.staff;          updated.push(`${data.staff.length} staff`); }
                if (data.salaryPayments && data.salaryPayments.length > (state.salaryPayments||[]).length) { state.salaryPayments = data.salaryPayments; updated.push(`${data.salaryPayments.length} payments`); }

                saveLocalState();
                dashboard.render();
                routeSheet.renderArchive();
                clientsTab.renderList();
                invoicesTab.renderList();
                expensesTab.renderList();

                this.lastSyncTime = new Date();
                this.setStatus(true, "Synced " + this.lastSyncTime.toLocaleTimeString());

                if (!silent) {
                    if (updated.length > 0) showToast("Pull complete! Updated: " + updated.join(", "));
                    else showToast("Pull complete — local data is already up to date.");
                }
            })
            .catch(err => {
                console.error("Pull error:", err);
                this.setStatus(false, "Pull failed");
                if (!silent) showToast("Pull failed! " + err.message, true);
            })
            .finally(() => { this.isSyncing = false; });
    },

    pushToSheets(silent = false) {
        if (!state.config.webAppUrl) { if (!silent) showToast("No URL configured!", true); return; }
        if (this.isSyncing && silent) return; // skip auto-sync if busy, but allow manual push
        this.isSyncing = true;
        this.setStatus(true, "Pushing...");

        fetch(state.config.webAppUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: "syncAll",
                clients:        state.clients,
                routes:         state.routes,
                expenses:       state.expenses,
                invoices:       state.invoices,
                staff:          state.staff          || [],
                salaryPayments: state.salaryPayments || []
            })
        })
        .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
        .then(data => {
            if (data.status === "success") {
                this.lastSyncTime = new Date();
                this.setStatus(true, "Synced " + this.lastSyncTime.toLocaleTimeString());
                if (!silent) showToast(data.message || "Pushed to Google Sheets successfully!");
            } else {
                this.setStatus(false, "Sync error");
                showToast("Sync error: " + (data.message || "Unknown error"), true);
            }
        })
        .catch(err => {
            console.error("Push error:", err);
            this.setStatus(false, "Push failed");
            if (!silent) showToast("Push failed! Check your internet or URL.", true);
        })
        .finally(() => { this.isSyncing = false; });
    }
};

// ============ BACKUP & RESTORE ============
const backupApp = {
    checkSundayReminder() {
        const today = new Date();
        const isSunday = today.getDay() === 0; // 0 = Sunday
        if (!isSunday) return;

        // Check if we already reminded today
        const lastReminded = localStorage.getItem('aqua_backup_reminded');
        const todayKey = today.toISOString().slice(0, 10); // YYYY-MM-DD
        if (lastReminded === todayKey) return;

        // Mark as reminded for today
        localStorage.setItem('aqua_backup_reminded', todayKey);

        // Show reminder banner after 3 seconds so app loads first
        setTimeout(() => {
            const banner = document.createElement('div');
            banner.id = 'sundayBackupBanner';
            banner.style.cssText = `
                position:fixed; bottom:20px; left:50%; transform:translateX(-50%);
                background:#1e3a5f; border:1px solid #3b82f6; color:#e0f2fe;
                padding:14px 20px; border-radius:12px; z-index:9999;
                box-shadow:0 4px 20px rgba(0,0,0,0.5);
                display:flex; align-items:center; gap:14px;
                max-width:420px; width:90%;
                animation: slideUp 0.4s ease;
            `;
            banner.innerHTML = `
                <div style="font-size:1.6rem;">📅</div>
                <div style="flex:1">
                    <div style="font-weight:700;margin-bottom:3px;">Sunday Backup Reminder</div>
                    <div style="font-size:0.8rem;color:#93c5fd;">It's Sunday — time to download your weekly backup!</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;">
                    <button onclick="backupApp.download(); document.getElementById('sundayBackupBanner').remove();"
                        style="background:#3b82f6;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:600;white-space:nowrap;">
                        ⬇ Download Now
                    </button>
                    <button onclick="document.getElementById('sundayBackupBanner').remove();"
                        style="background:transparent;color:#93c5fd;border:1px solid #3b82f6;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.75rem;">
                        Remind Later
                    </button>
                </div>
            `;
            document.body.appendChild(banner);

            // Auto remove after 30 seconds if ignored
            setTimeout(() => { if (banner.parentNode) banner.remove(); }, 30000);
        }, 3000);
    },
    download() {
        const backup = {
            version: 1,
            exportedAt: new Date().toISOString(),
            appName: "Aqua Pack ERP",
            clients:  state.clients,
            routes:   state.routes,
            expenses: state.expenses,
            invoices: state.invoices
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        const date = new Date().toISOString().slice(0, 10);
        a.href     = url;
        a.download = `AquaPack_Backup_${date}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Backup downloaded successfully!");
        this.setStatus(`Last backup: ${new Date().toLocaleString()}`, "text-green-400");
    },

    restore(input) {
        const file = input.files[0];
        if (!file) return;
        if (!file.name.endsWith(".json")) {
            showToast("Please select a valid .json backup file!", true);
            input.value = "";
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const backup = JSON.parse(e.target.result);
                // Validate it's an Aqua Pack backup
                if (!backup.appName || backup.appName !== "Aqua Pack ERP") {
                    showToast("Invalid backup file — not an Aqua Pack backup!", true);
                    input.value = "";
                    return;
                }
                if (!confirm(`Restore backup from ${new Date(backup.exportedAt).toLocaleString()}?\n\nThis will overwrite ALL current data. Are you sure?`)) {
                    input.value = "";
                    return;
                }
                // Restore each data set
                if (backup.clients  && Array.isArray(backup.clients))  state.clients  = backup.clients;
                if (backup.routes   && Array.isArray(backup.routes))   state.routes   = backup.routes;
                if (backup.expenses && Array.isArray(backup.expenses)) state.expenses = backup.expenses;
                if (backup.invoices && Array.isArray(backup.invoices)) state.invoices = backup.invoices;
                saveLocalState();
                // Refresh all tabs
                dashboard.render();
                routeSheet.renderArchive();
                clientsTab.renderList();
                invoicesTab.renderList();
                invoicesTab.renderClientGrid();
                expensesTab.renderList();
                showToast(`Restored! ${backup.clients?.length || 0} clients, ${backup.routes?.length || 0} routes, ${backup.invoices?.length || 0} invoices, ${backup.expenses?.length || 0} expenses.`);
                this.setStatus(`Restored from: ${file.name}`, "text-green-400");
            } catch (err) {
                showToast("Restore failed — file may be corrupted!", true);
                this.setStatus("Restore failed: " + err.message, "text-red-400");
            }
            input.value = ""; // reset file input
        };
        reader.readAsText(file);
    },

    setStatus(msg, colorClass = "text-gray-400") {
        const el = document.getElementById("backupStatus");
        if (!el) return;
        el.className = `mt-4 text-sm ${colorClass}`;
        el.textContent = msg;
        el.classList.remove("hidden");
    }
};


// ============ STAFF & SALARIES MODULE ============
const staffTab = {
    init() {
        document.getElementById('staffJoinDate').value = todayStr();
        this.renderList();
        this.renderSalaryPayments();
        this.renderSecurityDeposits();
        this.renderStats();
    },

    save() {
        const name     = document.getElementById('staffName').value.trim();
        const role     = document.getElementById('staffRole').value;
        const salary   = parseFloat(document.getElementById('staffSalary').value) || 0;
        const phone    = document.getElementById('staffPhone').value.trim();
        const joinDate = document.getElementById('staffJoinDate').value;
        if (!name) return showToast('Name is required!', true);
        if (!state.staff) state.staff = [];
        const editId = document.getElementById('staffName').dataset.editId;
        if (editId) {
            const s = state.staff.find(s => s.id === editId);
            if (s) { Object.assign(s, { name, role, salary, phone, joinDate }); showToast('Staff updated!'); }
            delete document.getElementById('staffName').dataset.editId;
        } else {
            state.staff.push({ id: 'st_' + Date.now(), name, role, salary, phone, joinDate });
            showToast(`${name} added!`);
        }
        saveLocalState();
        this.clearForm();
        this.renderList();
        this.renderStats();
        syncApp.autoSync();
    },

    edit(id) {
        if (!state.staff) return;
        const s = state.staff.find(s => s.id === id);
        if (!s) return;
        document.getElementById('staffName').value    = s.name;
        document.getElementById('staffName').dataset.editId = s.id;
        document.getElementById('staffRole').value    = s.role;
        document.getElementById('staffSalary').value  = s.salary;
        document.getElementById('staffPhone').value   = s.phone || '';
        document.getElementById('staffJoinDate').value = s.joinDate || todayStr();
        document.getElementById('staff').scrollIntoView({ behavior: 'smooth' });
    },

    delete(id) {
        if (!confirm('Remove this staff member?')) return;
        state.staff = (state.staff || []).filter(s => s.id !== id);
        saveLocalState();
        this.renderList();
        this.renderStats();
        syncApp.autoSync();
        showToast('Staff removed.');
    },

    clearForm() {
        document.getElementById('staffName').value    = '';
        document.getElementById('staffSalary').value  = '0';
        document.getElementById('staffPhone').value   = '';
        document.getElementById('staffJoinDate').value = todayStr();
        delete document.getElementById('staffName').dataset.editId;
        document.getElementById('staffRole').value = 'Driver';
    },

    showPaySalary() {
        if (!state.staff || state.staff.length === 0) return showToast('Add staff members first!', true);
        const options = state.staff.map(s => `<option value="${s.id}">${s.name} — ${s.role} (PKR ${Number(s.salary).toLocaleString()}/mo)</option>`).join('');
        showModal('Record Salary Payment', `
            <div class="space-y-3">
                <div><label class="block text-sm text-gray-400 mb-1">Staff Member</label>
                    <select id="payStaffId" class="input-field">${options}</select></div>
                <div><label class="block text-sm text-gray-400 mb-1">Amount (PKR)</label>
                    <input type="number" id="payAmount" class="input-field" value="0"></div>
                <div><label class="block text-sm text-gray-400 mb-1">Date</label>
                    <input type="date" id="payDate" class="input-field" value="${todayStr()}"></div>
                <div><label class="block text-sm text-gray-400 mb-1">Note (optional)</label>
                    <input type="text" id="payNote" class="input-field" placeholder="e.g. June salary"></div>
            </div>`,
            () => this.recordPayment()
        );
    },

    recordPayment() {
        const staffId = document.getElementById('payStaffId')?.value;
        const amount  = parseFloat(document.getElementById('payAmount')?.value) || 0;
        const date    = document.getElementById('payDate')?.value || todayStr();
        const note    = document.getElementById('payNote')?.value.trim() || '';
        if (!staffId || amount <= 0) { showToast('Select staff and enter amount!', true); return false; }
        const staff = state.staff.find(s => s.id === staffId);
        if (!state.salaryPayments) state.salaryPayments = [];
        state.salaryPayments.push({ id: 'pay_' + Date.now(), staffId, staffName: staff?.name || '', role: staff?.role || '', amount, date, note });
        saveLocalState();
        this.renderSalaryPayments();
        this.renderStats();
        syncApp.autoSync();
        showToast(`Salary of PKR ${amount.toLocaleString()} recorded for ${staff?.name}!`);
        // Return undefined so showModal auto-closes
    },

    deletePayment(id) {
        if (!confirm('Delete this payment record?')) return;
        state.salaryPayments = (state.salaryPayments || []).filter(p => p.id !== id);
        saveLocalState();
        this.renderSalaryPayments();
        this.renderStats();
        showToast('Payment record deleted.');
    },

    renderStats() {
        const staff    = state.staff || [];
        const totalSal = staff.reduce((a, s) => a + Number(s.salary || 0), 0);
        const totalSec = state.clients.reduce((a, c) => a + Number(c.security || 0), 0);
        const el = id => document.getElementById(id);
        if (el('staffCount'))       el('staffCount').innerText       = staff.length;
        if (el('staffTotalSalary')) el('staffTotalSalary').innerText = fmtPKR(totalSal);
        if (el('staffTotalSecurity')) el('staffTotalSecurity').innerText = fmtPKR(totalSec);
    },

    renderList() {
        const el = document.getElementById('staffList');
        if (!el) return;
        const staff = state.staff || [];
        if (staff.length === 0) { el.innerHTML = '<p class="text-gray-400 text-sm">No staff added yet.</p>'; return; }
        const roleColors = { Driver: '#3b82f6', 'Plant Worker': '#10b981', 'Guard / Security': '#f59e0b', Helper: '#8b5cf6', Manager: '#ec4899', Other: '#64748b' };
        el.innerHTML = staff.map(s => `
            <div style="background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:12px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
                <div>
                    <div style="font-weight:700;">${s.name}</div>
                    <div style="margin-top:3px;">
                        <span style="background:${roleColors[s.role]||'#64748b'}22;color:${roleColors[s.role]||'#64748b'};padding:2px 8px;border-radius:9999px;font-size:0.72rem;font-weight:600;">${s.role}</span>
                        <span style="color:#94a3b8;font-size:0.8rem;margin-left:8px;">PKR ${Number(s.salary).toLocaleString()}/mo</span>
                    </div>
                    ${s.phone ? `<div style="color:#64748b;font-size:0.75rem;margin-top:2px;">${s.phone}</div>` : ''}
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0;">
                    <button onclick="staffTab.edit('${s.id}')" class="btn-secondary" style="padding:5px 10px;font-size:0.8rem;"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="staffTab.delete('${s.id}')" class="btn-danger" style="padding:5px 10px;font-size:0.8rem;"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`).join('');
    },

    renderSalaryPayments() {
        const tbody = document.getElementById('salaryPaymentsList');
        if (!tbody) return;
        const payments = (state.salaryPayments || []).slice().reverse();
        if (payments.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:1.5rem;">No payments recorded yet.</td></tr>'; return; }
        tbody.innerHTML = payments.map(p => `
            <tr class="table-row border-b border-gray-800">
                <td class="py-3">${fmtDate(p.date)}</td>
                <td class="py-3 font-semibold">${p.staffName}</td>
                <td class="py-3"><span style="color:#94a3b8;font-size:0.8rem;">${p.role}</span></td>
                <td class="py-3 font-bold text-green-400">${fmtPKR(p.amount)}</td>
                <td class="py-3 text-gray-400 text-sm">${p.note || '-'}</td>
                <td class="py-3"><button onclick="staffTab.deletePayment('${p.id}')" class="btn-danger" style="padding:4px 8px;font-size:0.75rem;"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`).join('');
    },

    renderSecurityDeposits() {
        const tbody = document.getElementById('securityDepositsList');
        if (!tbody) return;
        const clients = state.clients.filter(c => Number(c.security || 0) > 0);
        if (clients.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:1.5rem;">No security deposits recorded. Add a security amount when creating a client.</td></tr>'; return; }
        tbody.innerHTML = clients.map(c => `
            <tr class="table-row border-b border-gray-800">
                <td class="py-3 font-semibold">${c.name}</td>
                <td class="py-3 text-gray-400">${c.address || '-'}</td>
                <td class="py-3 font-bold text-green-400">${fmtPKR(c.security)}</td>
                <td class="py-3 text-gray-400 text-sm">${fmtDate(c.joinDate) || '-'}</td>
            </tr>`).join('');
    }
};

// ============ DASHBOARD EXTENSIONS ============
// Patch into existing dashboard object
dashboard.showSub = function(sub, btn) {
    ['outstanding','aging','pl','expchart'].forEach(s => {
        const el = document.getElementById('sub-' + s);
        if (el) el.style.display = s === sub ? 'block' : 'none';
    });
    document.querySelectorAll('.dash-sub').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    if (sub === 'aging')    dashboard.renderAging();
    if (sub === 'pl')       dashboard.renderPL();
    if (sub === 'expchart') dashboard.renderExpenseChart();
};

// ---- Aging Report ----
dashboard.renderAging = function() {
    const el = document.getElementById('agingContent');
    if (!el) return;
    const today = new Date();
    const buckets = { b0: [], b30: [], b60: [], b90: [] };
    const labels  = { b0: '0–30 days', b30: '31–60 days', b60: '61–90 days', b90: '90+ days' };
    const colors  = { b0: '#10b981', b30: '#f59e0b', b60: '#f97316', b90: '#ef4444' };

    state.clients.forEach(c => {
        const bal = recalcClientBalance(c.id);
        if (bal <= 0) return;
        // Find oldest unpaid delivery
        let oldestDate = null;
        state.routes.forEach(r => {
            (r.deliveries||[]).forEach(d => {
                if (d.clientId === c.id && Number(d.balance||0) > 0) {
                    if (!oldestDate || r.date < oldestDate) oldestDate = r.date;
                }
            });
        });
        const days = oldestDate ? Math.floor((today - new Date(oldestDate)) / 86400000) : 0;
        const entry = { name: c.name, address: c.address||'', type: c.type, bal, days, id: c.id };
        if      (days <= 30) buckets.b0.push(entry);
        else if (days <= 60) buckets.b30.push(entry);
        else if (days <= 90) buckets.b60.push(entry);
        else                 buckets.b90.push(entry);
    });

    let html = '';
    ['b0','b30','b60','b90'].forEach(key => {
        const list  = buckets[key];
        const total = list.reduce((a,c) => a + c.bal, 0);
        html += `
        <div style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-weight:700;color:${colors[key]};font-size:0.9rem;">${labels[key]}</span>
                <span style="font-weight:700;color:${colors[key]};">${fmtPKR(total)} (${list.length} clients)</span>
            </div>
            ${list.length === 0 ? `<div style="color:#64748b;font-size:0.8rem;padding:8px;">No clients in this range</div>` :
            list.sort((a,b) => b.bal - a.bal).map(c => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#0f172a;border-radius:8px;margin-bottom:4px;font-size:0.82rem;">
                    <div>
                        <span style="font-weight:600;">${c.name}</span>
                        <span style="color:#64748b;margin-left:6px;">${c.days} days overdue</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="color:${colors[key]};font-weight:700;">${fmtPKR(c.bal)}</span>
                        <button onclick="clientsTab.viewProfile('${c.id}')" style="background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:3px 8px;border-radius:6px;cursor:pointer;font-size:0.75rem;">View</button>
                    </div>
                </div>`).join('')}
        </div>`;
    });

    const grandTotal = Object.values(buckets).flat().reduce((a,c) => a + c.bal, 0);
    el.innerHTML = `
        <div style="background:#1e293b;border-radius:10px;padding:12px;margin-bottom:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;">
            ${['b0','b30','b60','b90'].map(k => `
                <div><div style="font-size:0.65rem;color:#64748b;text-transform:uppercase;">${labels[k]}</div>
                <div style="font-weight:700;color:${colors[k]};">${fmtPKR(buckets[k].reduce((a,c)=>a+c.bal,0))}</div></div>`).join('')}
        </div>
        ${html}
        <div style="border-top:2px solid #334155;padding-top:10px;display:flex;justify-content:space-between;font-weight:700;">
            <span>Total Outstanding</span><span style="color:#f59e0b;">${fmtPKR(grandTotal)}</span>
        </div>`;
};

// ---- P&L Statement ----
dashboard.renderPL = function() {
    const el = document.getElementById('plContent');
    if (!el) return;
    const plEl = document.getElementById('plMonth'); if (plEl && !plEl.value) plEl.value = todayStr().slice(0,7);
    const month = plEl?.value || todayStr().slice(0,7);
    if (!month) { el.innerHTML = '<p style="color:#64748b;">Select a month above.</p>'; return; }

    const routes   = state.routes.filter(r => r.date?.startsWith(month));
    const expenses = state.expenses.filter(e => e.date?.startsWith(month));

    let totalSales = 0, totalCash = 0, totalBal = 0;
    let fuelExp = 0, foodExp = 0, otherRouteExp = 0;
    routes.forEach(r => {
        totalSales += Number(r.totalVal||0);
        totalCash  += Number(r.collectedCash||0);
        totalBal   += Number(r.outstandingAdded||0);
        fuelExp    += Number(r.fuel||0);
        foodExp    += Number(r.food||0);
        otherRouteExp += Number(r.other||0);
    });

    // Standalone expenses by category
    const expByCategory = {};
    expenses.forEach(e => {
        expByCategory[e.category] = (expByCategory[e.category]||0) + Number(e.amount||0);
    });
    const standaloneTotal = Object.values(expByCategory).reduce((a,b) => a+b, 0);
    const routeExpTotal   = fuelExp + foodExp + otherRouteExp;
    const totalExpenses   = routeExpTotal + standaloneTotal;

    // Invoice payments received this month
    let invoicePaid = 0;
    state.invoices.forEach(inv => {
        (inv.payments||[]).forEach(p => {
            if (p.date?.startsWith(month)) invoicePaid += Number(p.amount||0);
        });
    });

    const grossProfit  = totalCash + invoicePaid;
    const netProfit    = grossProfit - totalExpenses;
    const [yr, mn]     = month.split('-');
    const mNames       = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mLabel       = `${mNames[parseInt(mn)]} ${yr}`;

    const row = (label, val, color='#f1f5f9', bold=false) =>
        `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #1e293b;font-size:0.85rem;">
            <span style="color:#94a3b8;">${label}</span>
            <span style="color:${color};font-weight:${bold?'700':'500'};">${fmtPKR(val)}</span>
        </div>`;

    el.innerHTML = `
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:16px;">
            <div style="font-weight:700;font-size:1rem;margin-bottom:14px;color:#60a5fa;">
                📊 Profit & Loss — ${mLabel}
                <button onclick="dashboard.printPL('${month}')" style="float:right;background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.75rem;">🖨 Print</button>
            </div>
            <div style="margin-bottom:12px;">
                <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:6px;">REVENUE</div>
                ${row('Total Sales (Delivered)', totalSales, '#60a5fa')}
                ${row('Cash Collected (Routes)', totalCash, '#10b981')}
                ${row('Invoice Payments Received', invoicePaid, '#10b981')}
                ${row('Outstanding Added (Credit)', totalBal, '#f59e0b')}
            </div>
            <div style="margin-bottom:12px;">
                <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:6px;">ROUTE EXPENSES</div>
                ${row('Fuel', fuelExp, '#ef4444')}
                ${row('Food', foodExp, '#ef4444')}
                ${row('Other Route', otherRouteExp, '#ef4444')}
            </div>
            ${Object.keys(expByCategory).length > 0 ? `
            <div style="margin-bottom:12px;">
                <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:6px;">STANDALONE EXPENSES</div>
                ${Object.entries(expByCategory).map(([k,v]) => row(k, v, '#ef4444')).join('')}
            </div>` : ''}
            <div style="border-top:2px solid #334155;padding-top:10px;margin-top:4px;">
                ${row('Total Expenses', totalExpenses, '#ef4444', true)}
                ${row('Gross Cash In (Routes + Invoices)', grossProfit, '#10b981', true)}
                <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:1rem;font-weight:700;margin-top:4px;border-top:1px solid #334155;">
                    <span>NET PROFIT</span>
                    <span style="color:${netProfit>=0?'#10b981':'#ef4444'};">${fmtPKR(netProfit)}</span>
                </div>
            </div>
        </div>`;
};

dashboard.printPL = function(month) {
    const plEl = document.getElementById('plMonth');
    const m = plEl?.value || month;
    const mNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const [yr, mn] = m.split('-');
    const mLabel = mNames[parseInt(mn)] + ' ' + yr;

    const routes   = state.routes.filter(r => r.date?.startsWith(m));
    const expenses = state.expenses.filter(e => e.date?.startsWith(m));
    let totalSales=0, totalCash=0, totalBal=0, fuelExp=0, foodExp=0, otherExp=0;
    routes.forEach(r => { totalSales+=Number(r.totalVal||0); totalCash+=Number(r.collectedCash||0); totalBal+=Number(r.outstandingAdded||0); fuelExp+=Number(r.fuel||0); foodExp+=Number(r.food||0); otherExp+=Number(r.other||0); });
    const expByCategory = {};
    expenses.forEach(e => { expByCategory[e.category]=(expByCategory[e.category]||0)+Number(e.amount||0); });
    const standaloneTotal = Object.values(expByCategory).reduce((a,b)=>a+b,0);
    const totalExpenses = fuelExp+foodExp+otherExp+standaloneTotal;
    let invoicePaid = 0;
    state.invoices.forEach(inv => { (inv.payments||[]).forEach(p => { if(p.date?.startsWith(m)) invoicePaid+=Number(p.amount||0); }); });
    const grossProfit = totalCash + invoicePaid;
    const netProfit   = grossProfit - totalExpenses;

    const row = (label, val, bold=false, color='#111') =>
        `<tr><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;color:#555;">${label}</td>
         <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:${bold?'700':'400'};color:${color};">${fmtPKR(val)}</td></tr>`;

    const win = window.open('', '_blank', 'width=600,height=800');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>P&L ${mLabel}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:Arial,sans-serif; background:#fff; color:#111; padding:30px; }
        .header { border-bottom:3px solid #0ea5e9; padding-bottom:16px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:flex-end; }
        .brand { font-size:1.8rem; font-weight:900; color:#0ea5e9; }
        .doc-title { font-size:1.1rem; font-weight:700; color:#111; }
        .doc-sub { font-size:0.85rem; color:#666; margin-top:4px; }
        .section { margin-bottom:20px; }
        .section-title { font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#888; background:#f8f8f8; padding:6px 10px; margin-bottom:0; }
        table { width:100%; border-collapse:collapse; }
        .net-row td { padding:12px 10px; font-size:1.1rem; font-weight:900; border-top:3px solid #111; color:${netProfit>=0?'#16a34a':'#dc2626'}; }
        .no-print { display:block; text-align:center; margin-top:20px; }
        @media print { .no-print { display:none; } }
    </style></head><body>
    <div class="header">
        <div><div class="brand">💧 AQUA PACK</div><div style="font-size:0.8rem;color:#888;margin-top:3px;">Water Delivery Services</div></div>
        <div style="text-align:right;"><div class="doc-title">Profit & Loss Statement</div><div class="doc-sub">${mLabel}</div></div>
    </div>
    <div class="section">
        <div class="section-title">Revenue</div>
        <table>
            ${row('Total Sales (Delivered)', totalSales, false, '#0ea5e9')}
            ${row('Cash Collected (Routes)', totalCash, false, '#16a34a')}
            ${row('Invoice Payments Received', invoicePaid, false, '#16a34a')}
            ${row('Outstanding Added (Credit)', totalBal, false, '#d97706')}
        </table>
    </div>
    <div class="section">
        <div class="section-title">Route Expenses</div>
        <table>
            ${row('Fuel', fuelExp, false, '#dc2626')}
            ${row('Food', foodExp, false, '#dc2626')}
            ${row('Other', otherExp, false, '#dc2626')}
        </table>
    </div>
    ${Object.keys(expByCategory).length>0?`<div class="section"><div class="section-title">Standalone Expenses</div><table>${Object.entries(expByCategory).map(([k,v])=>row(k,v,false,'#dc2626')).join('')}</table></div>`:''}
    <div class="section">
        <table>
            ${row('Total Expenses', totalExpenses, true, '#dc2626')}
            ${row('Gross Cash In', grossProfit, true, '#16a34a')}
            <tr class="net-row"><td>NET PROFIT</td><td style="text-align:right;">${fmtPKR(netProfit)}</td></tr>
        </table>
    </div>
    <div class="no-print">
        <button onclick="window.print()" style="background:#0ea5e9;color:white;border:none;padding:10px 30px;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer;">🖨 Print / Save PDF</button>
    </div>
    </body></html>`);
    win.document.close();
};

// ---- Expense Pie Chart ----
dashboard.expensePieChart = null;
dashboard.renderExpenseChart = function() {
    const ctx = document.getElementById('expensePieChart')?.getContext('2d');
    if (!ctx) return;
    if (this.expensePieChart) this.expensePieChart.destroy();

    const { routes, expenses } = this.getFilteredData();
    const cats = {};
    routes.forEach(r => {
        if (Number(r.fuel||0)  > 0) cats['Fuel']          = (cats['Fuel']||0)          + Number(r.fuel);
        if (Number(r.food||0)  > 0) cats['Food']          = (cats['Food']||0)          + Number(r.food);
        if (Number(r.other||0) > 0) cats['Route Other']   = (cats['Route Other']||0)   + Number(r.other);
    });
    expenses.forEach(e => { cats[e.category] = (cats[e.category]||0) + Number(e.amount||0); });

    const labels = Object.keys(cats);
    const data   = Object.values(cats);
    const total  = data.reduce((a,b) => a+b, 0);
    const palette = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#f97316','#06b6d4','#84cc16'];

    this.expensePieChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: palette.slice(0, labels.length), borderWidth: 2, borderColor: '#0f172a' }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmtPKR(ctx.raw)} (${((ctx.raw/total)*100).toFixed(1)}%)` } }
            }
        }
    });

    const legend = document.getElementById('expChartLegend');
    if (legend) legend.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${labels.map((l,i) => `
            <div style="display:flex;align-items:center;gap:5px;font-size:0.78rem;">
                <div style="width:10px;height:10px;border-radius:50%;background:${palette[i]};flex-shrink:0;"></div>
                <span style="color:#94a3b8;">${l}:</span>
                <span style="font-weight:700;">${fmtPKR(data[i])}</span>
                <span style="color:#64748b;">(${((data[i]/total)*100).toFixed(0)}%)</span>
            </div>`).join('')}
        <div style="margin-left:auto;font-weight:700;font-size:0.82rem;">Total: ${fmtPKR(total)}</div>
    </div>`;
};

// ---- Security Deposit deducted from balance ----
// Patch recalcClientBalance to deduct security deposit
const _origRecalc = recalcClientBalance;
window.recalcClientBalance = function(clientId) {
    const raw = _origRecalc(clientId);
    const client = state.clients.find(c => c.id === clientId);
    const security = Number(client?.security || 0);
    return Math.max(0, raw - security);
};
// Make sure all calls use the patched version
window.addEventListener('load', () => {
    // Re-render dashboard after patch
    setTimeout(() => dashboard.render(), 100);
});

// ---- Payment Receipt ----
function printPaymentReceipt(clientName, amount, date, note, invoiceNo) {
    const win = window.open('', '_blank', 'width=400,height=500');
    win.document.write(`<!DOCTYPE html><html><head><title>Receipt</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #111; max-width: 320px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #0ea5e9; padding-bottom: 12px; margin-bottom: 16px; }
        .logo { font-size: 1.4rem; font-weight: 900; color: #0ea5e9; }
        .title { font-size: 0.8rem; color: #64748b; }
        .receipt-no { font-size: 0.75rem; color: #94a3b8; margin-top: 4px; }
        .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e5e7eb; font-size: 0.85rem; }
        .amount-box { text-align: center; background: #f0fdf4; border: 2px solid #10b981; border-radius: 8px; padding: 12px; margin: 16px 0; }
        .amount-label { font-size: 0.75rem; color: #64748b; }
        .amount-val { font-size: 1.6rem; font-weight: 900; color: #10b981; }
        .footer { text-align: center; font-size: 0.7rem; color: #94a3b8; margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
        .stamp { text-align: center; margin-top: 20px; }
        .stamp span { border: 2px solid #10b981; color: #10b981; padding: 4px 16px; border-radius: 4px; font-weight: 700; font-size: 0.9rem; }
        @media print { button { display: none; } }
    </style></head><body>
    <div class="header">
        <div class="logo">💧 AQUA PACK</div>
        <div class="title">Water Delivery Services — Rawalpindi</div>
        <div class="receipt-no">Receipt: ${invoiceNo || 'RCP-' + Date.now()}</div>
    </div>
    <div class="amount-box">
        <div class="amount-label">AMOUNT RECEIVED</div>
        <div class="amount-val">PKR ${Number(amount).toLocaleString()}</div>
    </div>
    <div class="row"><span>Client</span><strong>${clientName}</strong></div>
    <div class="row"><span>Date</span><span>${date}</span></div>
    <div class="row"><span>Note</span><span>${note || 'Payment received'}</span></div>
    <div class="stamp"><span>✓ PAID</span></div>
    <div class="footer">Thank you for your payment!<br>Aqua Pack Water Delivery — Rawalpindi/Islamabad</div>
    <br>
    <button onclick="window.print()" style="width:100%;padding:10px;background:#0ea5e9;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:700;">🖨 Print Receipt</button>
    </body></html>`);
    win.document.close();
}
