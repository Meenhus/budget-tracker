const CATEGORIES = [
  "Supplies",
  "Payroll",
  "Rent",
  "Marketing",
  "Marketing Promotions",
  "Events",
  "Employee Bonus",
  "Rewards & Recognition",
  "External Facilitators",
  "Consulting",
  "Utilities",
  "Other",
];
const COLORS = {
  Supplies: "#284c3d",
  Payroll: "#63776a",
  Rent: "#b07839",
  Marketing: "#7f956c",
  "Marketing Promotions": "#6b8fb1",
  Events: "#a36b8f",
  "Employee Bonus": "#c46b6b",
  "Rewards & Recognition": "#8fb16b",
  "External Facilitators": "#6b9aa3",
  Consulting: "#b19a6b",
  Utilities: "#8d7044",
  Other: "#3c6058",
};
function hexToRgb(hex) {
  if (!hex) return { r: 0, g: 0, b: 0 };
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  if (clean.length === 6) {
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
  }
  if (clean.length === 3) {
    return { r: parseInt(clean[0] + clean[0], 16), g: parseInt(clean[1] + clean[1], 16), b: parseInt(clean[2] + clean[2], 16) };
  }
  return { r: 0, g: 0, b: 0 };
}

function monthColor(index) {
  // generate distinguishable HSL colors across 12 months
  const hue = (index * 30) % 360;
  return `linear-gradient(180deg, hsl(${hue} 45% 55%) 0%, hsl(${(hue + 18) % 360} 40% 35%) 100%)`;
}
const DEFAULT_BUDGETS = {
  Supplies: 800,
  Payroll: 3500,
  Rent: 1800,
  Marketing: 600,
  "Marketing Promotions": 300,
  Events: 1000,
  "Employee Bonus": 500,
  "Rewards & Recognition": 250,
  "External Facilitators": 1500,
  Consulting: 1200,
  Utilities: 350,
  Other: 250,
};
const DEFAULT_EXPENSES = [
  { id: 1, amount: 240, category: "Supplies", date: "2026-07-03", note: "Packaging materials" }, { id: 2, amount: 3500, category: "Payroll", date: "2026-07-05", note: "Bi-weekly payroll run" }, { id: 3, amount: 1800, category: "Rent", date: "2026-07-01", note: "Storefront rent" }, { id: 4, amount: 180, category: "Marketing", date: "2026-07-10", note: "Local paper ad" }, { id: 5, amount: 96, category: "Utilities", date: "2026-07-08", note: "Electric bill" }, { id: 6, amount: 65, category: "Other", date: "2026-07-12", note: "Bank fees" }, { id: 7, amount: 410, category: "Supplies", date: "2026-07-18", note: "Restock inventory" }, { id: 8, amount: 120, category: "Marketing", date: "2026-07-20", note: "Social ads" }
];
const defaultYearlyBudgets = () => Object.fromEntries(Object.entries(DEFAULT_BUDGETS).map(([category, monthlyValue]) => [category, Number(monthlyValue) * 12]));
const storageKey = "the-ledger-business-budget-v1";
const CURRENCY_SYMBOLS = { USD: "$", NGN: "₦", EUR: "€" };
const formatCurrency = (value, currency = state?.currency || "USD") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
const dateInput = () => new Date().toISOString().slice(0, 10);
let state = JSON.parse(localStorage.getItem(storageKey) || "null") || {
  currency: "USD",
  budgets: { ...DEFAULT_BUDGETS },
  yearlyBudgets: defaultYearlyBudgets(),
  expenses: [...DEFAULT_EXPENSES]
};
if (!state.currency) state.currency = "USD";
if (!state.yearlyBudgets) state.yearlyBudgets = defaultYearlyBudgets();
Object.keys(DEFAULT_BUDGETS).forEach((category) => {
  if (state.yearlyBudgets[category] === undefined || Number(state.yearlyBudgets[category]) <= 0) {
    state.yearlyBudgets[category] = Number(state.budgets[category] || 0) * 12;
  }
});
let supabase = null;
let currentUser = null;
let authMode = "signin";
let cloudSaveTimer = null;

const $ = (selector) => document.querySelector(selector);
function save() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  if (currentUser) {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(saveCloudWorkspace, 450);
  }
}
async function saveCloudWorkspace() {
  if (!supabase || !currentUser) return;
  setSyncStatus("Saving...");
  const payload = {
    user_id: currentUser.id,
    budgets: state.budgets,
    expenses: state.expenses,
    updated_at: new Date().toISOString()
  };
  if (state.yearlyBudgets) payload.yearly_budgets = state.yearlyBudgets;

  const { error } = await supabase.from("budget_workspaces").upsert(payload, { onConflict: "user_id" });
  if (error && /yearly_budgets|column .* does not exist|does not exist/i.test(error.message)) {
    const { error: fallbackError } = await supabase.from("budget_workspaces").upsert({
      user_id: currentUser.id,
      budgets: state.budgets,
      expenses: state.expenses,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    setSyncStatus(fallbackError ? "Sync error" : "Cloud synced");
    return;
  }
  setSyncStatus(error ? "Sync error" : "Cloud synced");
}
function setSyncStatus(message) { $("#sync-status").textContent = message; }
function updateAccountControls() {
  const button = $("#account-button");
  const syncUser = $("#sync-user");
  if (currentUser) {
    button.textContent = "Sign out";
    button.title = currentUser.email;
    syncUser.textContent = currentUser.email;
    syncUser.hidden = false;
    setSyncStatus("Cloud synced");
  } else {
    button.textContent = "Sign in";
    button.title = "Sign in to save your workspace";
    syncUser.textContent = "";
    syncUser.hidden = true;
    setSyncStatus(supabase ? "Sign in to sync" : "Local workspace");
  }
}
async function loadCloudWorkspace() {
  if (!supabase || !currentUser) return;
  setSyncStatus("Loading workspace...");

  let { data, error } = await supabase.from("budget_workspaces").select("budgets, yearly_budgets, expenses").eq("user_id", currentUser.id).maybeSingle();
  if (error && /yearly_budgets|column .* does not exist|does not exist/i.test(error.message)) {
    ({ data, error } = await supabase.from("budget_workspaces").select("budgets, expenses").eq("user_id", currentUser.id).maybeSingle());
  }

  if (error) { setSyncStatus("Sync error"); return; }
  if (data) {
    state = {
      ...state,
      budgets: { ...DEFAULT_BUDGETS, ...(data.budgets || {}) },
      yearlyBudgets: { ...defaultYearlyBudgets(), ...((data.yearly_budgets || data.budgets || {})) },
      expenses: Array.isArray(data.expenses) ? data.expenses : []
    };
    Object.keys(DEFAULT_BUDGETS).forEach((category) => {
      if (state.yearlyBudgets[category] === undefined || Number(state.yearlyBudgets[category]) <= 0) {
        state.yearlyBudgets[category] = Number(state.budgets[category] || 0) * 12;
      }
    });
    localStorage.setItem(storageKey, JSON.stringify(state));
  } else {
    await saveCloudWorkspace();
  }
  render();
  setSyncStatus("Cloud synced");
}
async function startCloud() {
  const config = window.APP_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseAnonKey) { updateAccountControls(); return; }
  try {
    const module = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    supabase = module.createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { data } = await supabase.auth.getSession();
    currentUser = data.session?.user || null;
    updateAccountControls();
    if (currentUser) await loadCloudWorkspace();
    supabase.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || null;
      updateAccountControls();
      if (currentUser) await loadCloudWorkspace();
    });
  } catch (error) {
    console.warn("Cloud workspace could not be initialized.", error);
    setSyncStatus("Local workspace");
  }
}
function totals() { const spent = Object.fromEntries(CATEGORIES.map((item) => [item, 0])); state.expenses.forEach((expense) => { spent[expense.category] += Number(expense.amount); }); return spent; }
function status(percent) { if (percent >= 100) return ["Over budget", "var(--red)"]; if (percent >= 80) return ["Close to limit", "var(--gold)"]; return ["On track", "var(--green)"]; }
function updateSummary(spent) { const budget = Object.values(state.budgets).reduce((sum, value) => sum + Number(value), 0); const used = Object.values(spent).reduce((sum, value) => sum + value, 0); const remaining = budget - used; $("#total-budget").textContent = formatCurrency(budget, state.currency); $("#total-spent").textContent = formatCurrency(used, state.currency); $("#total-remaining").textContent = formatCurrency(remaining, state.currency); $("#header-remaining").textContent = formatCurrency(remaining, state.currency); $(".summary-item.remaining").classList.toggle("negative", remaining < 0); $("#header-remaining").style.color = remaining < 0 ? "var(--red)" : "var(--green)"; const over = CATEGORIES.filter((category) => state.budgets[category] > 0 && spent[category] >= state.budgets[category]); const alert = $("#budget-alert"); alert.hidden = !over.length; alert.textContent = over.length === 1 ? `${over[0]} is over budget this month.` : `${over.join(", ")} are over budget this month.`; }
function setBudgetValue(category, type, rawValue) {
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0) {
    alert("Enter a valid budget amount.");
    render();
    return;
  }

  if (type === "monthly") {
    state.budgets[category] = value;
    state.yearlyBudgets[category] = Number(value) * 12;
  } else {
    state.yearlyBudgets[category] = value;
    state.budgets[category] = Number(value) / 12;
  }

  save();
  render();
}
function renderCards(spent) { const host = $("#budget-cards"); const template = $("#budget-card-template"); host.replaceChildren(...CATEGORIES.map((category) => { const fragment = template.content.cloneNode(true); const card = fragment.querySelector("article"); const cap = Number(state.budgets[category]); const used = spent[category]; const pct = cap > 0 ? (used / cap) * 100 : 0; const [label, color] = status(pct); fragment.querySelector("h3").textContent = category; fragment.querySelector(".category-dot").style.background = COLORS[category]; const tab = fragment.querySelector(".status-tab"); tab.textContent = label; tab.style.background = color; fragment.querySelector(".budget-figures strong").textContent = formatCurrency(used, state.currency); fragment.querySelector(".budget-cap").textContent = formatCurrency(cap, state.currency); const monthlyInput = fragment.querySelector('[data-budget-field="monthly"]'); const yearlyInput = fragment.querySelector('[data-budget-field="yearly"]'); monthlyInput.value = Number(state.budgets[category] || 0); yearlyInput.value = Number(state.yearlyBudgets?.[category] ?? Number(state.budgets[category] || 0) * 12); monthlyInput.addEventListener("change", (event) => setBudgetValue(category, "monthly", event.target.value)); yearlyInput.addEventListener("change", (event) => setBudgetValue(category, "yearly", event.target.value)); const progress = fragment.querySelector(".progress-bar"); progress.style.width = `${Math.min(pct, 100)}%`; progress.style.background = color; fragment.querySelector(".usage").textContent = `${pct.toFixed(0)}% used`; return card; })); }
function editBudget(category, type = "monthly") {
  const currentValue = type === "yearly" ? Number(state.yearlyBudgets?.[category] ?? (state.budgets[category] || 0) * 12) : Number(state.budgets[category] || 0);
  const label = type === "yearly" ? `annual budget for ${category}` : `monthly budget for ${category}`;
  const answer = prompt(`Set ${label}:`, currentValue);
  if (answer === null) return;
  setBudgetValue(category, type, answer);
}
function renderDonut(spent) { const entries = CATEGORIES.filter((category) => spent[category] > 0); const total = entries.reduce((sum, category) => sum + spent[category], 0); const donut = $("#donut-chart"); const legend = $("#chart-legend"); if (!total) { donut.style.background = "#e7e1d5"; legend.innerHTML = "<li>No expenses yet.</li>"; return; } let cursor = 0; const parts = entries.map((category) => { const start = cursor; cursor += (spent[category] / total) * 100; return `${COLORS[category]} ${start}% ${cursor}%`; }); donut.style.background = `conic-gradient(${parts.join(",")})`; legend.replaceChildren(...entries.map((category) => { const item = document.createElement("li"); item.innerHTML = `<b style="background:${COLORS[category]}"></b>${category} <strong>${formatCurrency(spent[category], state.currency)}</strong>`; return item; })); }
function renderBars(spent) {
  const maximum = Math.max(...CATEGORIES.flatMap((category) => [state.budgets[category], spent[category]]), 1);
  $("#bar-chart").replaceChildren(...CATEGORIES.map((category, idx) => {
    const group = document.createElement("div");
    group.className = "bar-group";
    const budget = document.createElement("div");
    budget.className = "bar budget";
    budget.style.height = `${(state.budgets[category] / maximum) * 100}%`;
    budget.title = `${category} budget: ${formatCurrency(state.budgets[category], state.currency)}`;

    const used = document.createElement("div");
    used.className = "bar spent";
    used.style.height = `${(spent[category] / maximum) * 100}%`;
    used.title = `${category} spent: ${formatCurrency(spent[category], state.currency)}`;

    // Use category color for spent and a translucent tint for budget
    const rgb = hexToRgb(COLORS[category]);
    used.style.background = COLORS[category];
    budget.style.background = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`;

    group.append(budget, used);
    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = category;
    group.append(label);
    return group;
  }));
}
function editExpense(expense) {
  const amount = prompt("Edit amount:", expense.amount);
  if (amount === null) return;
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) { alert("Enter a valid expense amount."); return; }

  const category = prompt("Edit category:", expense.category);
  if (category === null) return;
  if (!CATEGORIES.includes(category)) { alert(`Choose a valid category: ${CATEGORIES.join(", ")}`); return; }

  const date = prompt("Edit date (YYYY-MM-DD):", expense.date);
  if (date === null) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { alert("Use the format YYYY-MM-DD."); return; }

  const note = prompt("Edit note:", expense.note || "");
  if (note === null) return;

  const nextExpense = { ...expense, amount: parsedAmount, category, date, note: note.trim() };
  state.expenses = state.expenses.map((item) => item.id === expense.id ? nextExpense : item);
  save(); render();
}
function renderTransactions() { const filter = $("#transaction-filter").value; const expenses = state.expenses.filter((expense) => filter === "All" || expense.category === filter).sort((a, b) => b.date.localeCompare(a.date)); const body = $("#transaction-list"); if (!expenses.length) { body.innerHTML = "<tr><td class=\"empty-row\" colspan=\"5\">No expenses logged in this category yet.</td></tr>"; return; } body.replaceChildren(...expenses.map((expense) => { const row = document.createElement("tr"); row.innerHTML = `<td>${expense.date}</td><td><span class="category-cell"><i class="table-dot" style="background:${COLORS[expense.category]}"></i>${expense.category}</span></td><td>${escapeHtml(expense.note || "-")}</td><td class="amount-cell">${formatCurrency(expense.amount, state.currency)}</td><td class="amount-cell action-cell"><button class="edit-button" type="button" aria-label="Edit expense">Edit</button><button class="delete-button" type="button" aria-label="Delete expense">Delete</button></td>`; row.querySelector(".edit-button").addEventListener("click", () => editExpense(expense)); row.querySelector(".delete-button").addEventListener("click", () => { state.expenses = state.expenses.filter((item) => item.id !== expense.id); save(); render(); }); return row; })); }
function getYearlyMonthlyData() {
  const year = new Date().getFullYear();
  const buckets = Array.from({ length: 12 }, (_, monthIndex) => ({
    month: monthIndex,
    label: new Date(year, monthIndex, 1).toLocaleString(undefined, { month: "short" }),
    value: 0
  }));
  state.expenses.forEach((expense) => {
    const date = new Date(expense.date);
    if (date.getFullYear() === year) {
      buckets[date.getMonth()].value += Number(expense.amount || 0);
    }
  });
  return buckets;
}
function getCurrentMonthDailyData() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const buckets = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    return {
      day,
      dateKey: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      label: `${day}`,
      value: 0
    };
  });
  state.expenses.forEach((expense) => {
    const date = new Date(`${expense.date}T00:00:00`);
    if (date.getFullYear() === year && date.getMonth() === month) {
      const dayBucket = buckets[date.getDate() - 1];
      if (dayBucket) dayBucket.value += Number(expense.amount || 0);
    }
  });
  return buckets;
}
function getCurrentMonthWeeklyData() {
  const dailyData = getCurrentMonthDailyData();
  const weeks = [
    { label: "Week 1", value: 0 },
    { label: "Week 2", value: 0 },
    { label: "Week 3", value: 0 },
    { label: "Week 4", value: 0 },
    { label: "Week 5", value: 0 }
  ];
  dailyData.forEach((day) => {
    const weekIndex = Math.min(Math.floor((day.day - 1) / 7), weeks.length - 1);
    weeks[weekIndex].value += day.value;
  });
  return weeks.filter((week) => week.value > 0 || week.label === `Week ${Math.ceil(new Date().getDate() / 7)}`);
}
function renderYearlyOverview() {
  const currentYear = new Date().getFullYear();
  const monthlyData = getYearlyMonthlyData();
  const annualBudget = CATEGORIES.reduce((sum, category) => sum + Number(state.yearlyBudgets?.[category] ?? (state.budgets[category] || 0) * 12), 0);
  const annualSpent = monthlyData.reduce((sum, entry) => sum + entry.value, 0);
  const annualRemaining = annualBudget - annualSpent;
  const averageMonthly = monthlyData.length ? annualSpent / 12 : 0;
  $("#year-label").textContent = String(currentYear);
  $("#annual-budget").textContent = formatCurrency(annualBudget, state.currency);
  $("#annual-spent").textContent = formatCurrency(annualSpent, state.currency);
  $("#annual-remaining").textContent = formatCurrency(annualRemaining, state.currency);
  $("#monthly-average").textContent = formatCurrency(averageMonthly, state.currency);

  const host = $("#yearly-trend");
  const maxValue = Math.max(...monthlyData.map((entry) => entry.value), 1);
  host.replaceChildren(...monthlyData.map((entry) => {
    const item = document.createElement("div");
    item.className = "yearly-month";
    const bar = document.createElement("div");
    bar.className = "yearly-bar";
    bar.style.height = `${Math.max((entry.value / maxValue) * 100, 8)}%`;
    bar.title = `${entry.label}: ${formatCurrency(entry.value, state.currency)}`;
    // vary month colors for clearer presentation
    bar.style.background = monthColor(entry.month);
    const label = document.createElement("span");
    label.textContent = entry.label;
    item.append(bar, label);
    return item;
  }));
}
function renderDailyOverview() {
  const dailyData = getCurrentMonthDailyData();
  const monthTotal = dailyData.reduce((sum, day) => sum + day.value, 0);
  const thisWeek = dailyData.filter((day) => {
    const today = new Date();
    const currentDate = new Date(today.getFullYear(), today.getMonth(), day.day);
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return currentDate >= weekStart && currentDate <= weekEnd;
  }).reduce((sum, day) => sum + day.value, 0);

  $("#month-total").textContent = formatCurrency(monthTotal, state.currency);
  $("#week-total").textContent = formatCurrency(thisWeek, state.currency);

  const list = $("#daily-expense-list");
  const activeDays = dailyData.filter((day) => day.value > 0);
  if (!activeDays.length) {
    list.innerHTML = '<div class="daily-day"><div class="day-label"><span>No data</span></div><strong>$0</strong></div>';
  } else {
    list.replaceChildren(...activeDays.map((day) => {
      const item = document.createElement("div");
      item.className = "daily-day";
      item.innerHTML = `<div class="day-label"><span>${day.label}</span><span>${new Date(`${day.dateKey}T00:00:00`).toLocaleString(undefined, { month: "short" })}</span></div><strong>${formatCurrency(day.value, state.currency)}</strong>`;
      return item;
    }));
  }

  const weeklySummary = $("#weekly-summary");
  const weekData = getCurrentMonthWeeklyData();
  weeklySummary.replaceChildren(...weekData.map((week) => {
    const card = document.createElement("div");
    card.className = "weekly-card";
    card.innerHTML = `<span>${week.label}</span><strong>${formatCurrency(week.value, state.currency)}</strong>`;
    return card;
  }));
}
function escapeHtml(value) { const node = document.createElement("div"); node.textContent = value; return node.innerHTML; }
function render() {
  const spent = totals();
  $("#currency-select").value = state.currency;
  const amountPrefix = document.querySelector(".currency-input span");
  if (amountPrefix) amountPrefix.textContent = CURRENCY_SYMBOLS[state.currency] || "$";
  updateSummary(spent);
  renderCards(spent);
  renderDonut(spent);
  renderBars(spent);
  renderYearlyOverview();
  renderDailyOverview();
  renderTransactions();
  renderReviewChart();
}

function renderReviewChart() {
  const host = $("#review-chart");
  if (!host) return;
  host.replaceChildren();
  // Clone existing charts for consistency
  const donut = $("#donut-chart")?.cloneNode(true);
  const bars = $("#bar-chart")?.cloneNode(true);

  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.gap = '18px';
  container.style.alignItems = 'flex-start';

  if (donut) {
    donut.style.width = '260px';
    donut.style.height = '260px';
    donut.style.margin = '0';
    container.appendChild(donut);
  }

  const right = document.createElement('div');
  right.style.flex = '1';

  // KPIs
  const kpis = document.createElement('div');
  kpis.style.display = 'flex';
  kpis.style.gap = '10px';
  kpis.style.marginBottom = '12px';
  kpis.innerHTML = `
    <div style="flex:1;padding:10px;background:var(--card);border:1px solid var(--line);border-radius:8px;">
      <div style="color:var(--muted);font-size:12px">Total budget</div>
      <div style="font-weight:700;font-size:18px">${$('#total-budget').textContent}</div>
    </div>
    <div style="flex:1;padding:10px;background:var(--card);border:1px solid var(--line);border-radius:8px;">
      <div style="color:var(--muted);font-size:12px">Total spent</div>
      <div style="font-weight:700;font-size:18px">${$('#total-spent').textContent}</div>
    </div>
    <div style="flex:1;padding:10px;background:var(--card);border:1px solid var(--line);border-radius:8px;">
      <div style="color:var(--muted);font-size:12px">Remaining</div>
      <div style="font-weight:700;font-size:18px">${$('#total-remaining').textContent}</div>
    </div>
  `;

  right.appendChild(kpis);

  if (bars) {
    bars.style.minHeight = '160px';
    bars.style.maxHeight = '260px';
    bars.style.margin = '0';
    right.appendChild(bars);
  }

  container.appendChild(right);
  host.appendChild(container);
}

async function exportReviewPdf() {
  const host = $("#review-chart");
  if (!host) return alert('Nothing to export');
  try {
    const canvas = await html2canvas(host, { backgroundColor: null, scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf || window.jspdf?.jsPDF || window.jspPDF || {};
    const pdf = jsPDF ? new jsPDF('landscape', 'pt', 'a4') : null;
    if (!pdf) {
      // Fallback: open image in new tab
      const w = window.open('', '_blank');
      w.document.body.style.margin = '0';
      const img = new Image(); img.src = imgData; img.style.width = '100%'; w.document.body.appendChild(img);
      return;
    }
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 20, pdfWidth, pdfHeight);
    pdf.save('budget-review.pdf');
  } catch (err) {
    console.error(err);
    alert('Export failed.');
  }
}

function openPresentationView() {
  const host = $("#review-chart");
  if (!host) return;
  const popup = window.open('', '_blank');
  const doc = popup.document;
  doc.open();
  doc.write(`<!doctype html><html><head><title>Presentation - Budget Review</title><link rel="stylesheet" href="/style.css"></head><body style="margin:0;padding:40px;display:flex;align-items:center;justify-content:center;background:#fff;"></body></html>`);
  doc.close();
  const clone = host.cloneNode(true);
  // Ensure cloned styles are readable
  clone.style.maxWidth = '1000px';
  clone.style.margin = '0 auto';
  popup.document.body.appendChild(clone);
  // Allow the popup to go fullscreen if user accepts
}
function populateCategories() { $("#expense-category").replaceChildren(...CATEGORIES.map((category) => new Option(category, category))); const filter = $("#transaction-filter"); CATEGORIES.forEach((category) => filter.add(new Option(category, category))); $("#expense-date").value = dateInput(); $("#currency-select").value = state.currency; const amountPrefix = document.querySelector(".currency-input span"); if (amountPrefix) amountPrefix.textContent = CURRENCY_SYMBOLS[state.currency] || "$"; }
$("#expense-form").addEventListener("submit", (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const amount = Number(form.get("amount")); const error = $("#form-error"); if (!Number.isFinite(amount) || amount <= 0) { error.textContent = "Enter an amount greater than zero."; return; } state.expenses.push({ id: Date.now(), amount, category: form.get("category"), date: form.get("date"), note: form.get("note").trim() }); save(); event.currentTarget.reset(); $("#expense-date").value = dateInput(); error.textContent = ""; render(); });
$("#currency-select").addEventListener("change", (event) => { state.currency = event.target.value; save(); render(); });
$("#transaction-filter").addEventListener("change", renderTransactions); $("#reset-data").addEventListener("click", () => { if (confirm("Reset all budgets and expenses to the sample data?")) { state = { currency: state.currency || "USD", budgets: { ...DEFAULT_BUDGETS }, yearlyBudgets: defaultYearlyBudgets(), expenses: [...DEFAULT_EXPENSES] }; save(); render(); } });
$("#account-button").addEventListener("click", async () => {
  if (currentUser && supabase) { await supabase.auth.signOut(); return; }
  if (!supabase) { $("#auth-error").textContent = "Add your Supabase public URL and anon key in app-config.js before enabling accounts."; }
  $("#auth-dialog").showModal();
});
$("#close-auth").addEventListener("click", () => $("#auth-dialog").close());
$("#auth-toggle").addEventListener("click", () => {
  authMode = authMode === "signin" ? "signup" : "signin";
  const isSignup = authMode === "signup";
  $("#new-account-fields").hidden = !isSignup;
  $("#auth-phone").required = isSignup;
  $("#auth-country").required = isSignup;
  $("#auth-title").textContent = authMode === "signin" ? "Sign in to The Ledger" : "Create your workspace";
  $("#auth-description").textContent = authMode === "signin" ? "Save your budget securely and access it from any device." : "Create an account to protect and sync your business budget.";
  $("#auth-submit").textContent = authMode === "signin" ? "Sign in" : "Create account";
  $("#auth-toggle").textContent = authMode === "signin" ? "Create an account" : "I already have an account";
  $("#auth-error").textContent = "";
});
$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = $("#auth-error");
  if (!supabase) { error.textContent = "Accounts are not configured yet."; return; }
  const email = $("#auth-email").value.trim();
  const password = $("#auth-password").value;
  const phone = $("#auth-phone").value.trim();
  const country = $("#auth-country").value;
  if (authMode === "signup" && phone.replace(/[^0-9]/g, "").length < 7) {
    error.textContent = "Enter a valid phone number including the country code.";
    return;
  }
  if (authMode === "signup" && !country) {
    error.textContent = "Select your country.";
    return;
  }
  $("#auth-submit").disabled = true;
  const result = authMode === "signin"
    ? await supabase.auth.signInWithPassword({ email, password })
    : await supabase.auth.signUp({ email, password, options: { data: { phone, country } } });
  $("#auth-submit").disabled = false;
  if (result.error) { error.textContent = result.error.message; return; }
  if (authMode === "signup" && !result.data.session) { error.textContent = "Check your email to confirm the account, then sign in."; return; }
  $("#auth-dialog").close();
});
$("#upgrade-button").addEventListener("click", async () => {
  if (!currentUser || !supabase) { $("#auth-dialog").showModal(); return; }
  const button = $("#upgrade-button");
  button.disabled = true;
  button.textContent = "Opening checkout...";
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch("/api/create-checkout-session", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Checkout could not be started.");
    window.location.assign(data.url);
  } catch (error) {
    alert(error.message);
    button.disabled = false;
    button.textContent = "Upgrade to Pro";
  }
});
populateCategories(); render();
startCloud();

// Wire review actions
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'export-pdf') { e.preventDefault(); exportReviewPdf(); }
  if (e.target && e.target.id === 'present-mode') { e.preventDefault(); openPresentationView(); }
});
