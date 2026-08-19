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
  expenses: [...DEFAULT_EXPENSES],
  invoices: [],
  payments: [],
  portfolio: []
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


function getYearlyRevenueData() {
  const year = new Date().getFullYear();
  const buckets = Array.from({ length: 12 }, (_, monthIndex) => ({ month: monthIndex, label: new Date(year, monthIndex, 1).toLocaleString(undefined, { month: 'short' }), value: 0 }));
  state.payments.forEach(p => {
    const d = new Date(p.date);
    if (d.getFullYear() === year) buckets[d.getMonth()].value += Number(p.amount || 0);
  });
  return buckets;
}

function renderPLChart() {
  const host = $("#pl-chart");
  if (!host) return;
  host.replaceChildren();
  const revenueData = getYearlyRevenueData();
  const expenseData = getYearlyMonthlyData();
  const max = Math.max(...revenueData.map(d=>d.value), ...expenseData.map(d=>d.value), 1);
  const wrapper = document.createElement('div'); wrapper.style.display='flex'; wrapper.style.gap='12px'; wrapper.style.alignItems='flex-end'; wrapper.style.justifyContent='space-between';
  const cols = revenueData.map((entry, idx) => {
    const colWrap = document.createElement('div'); colWrap.style.flex='1'; colWrap.style.display='flex'; colWrap.style.flexDirection='column'; colWrap.style.alignItems='center';
    const rev = document.createElement('div'); rev.style.height = `${Math.max((entry.value / max) * 100, 6)}%`; rev.style.width='36%'; rev.style.background='linear-gradient(180deg,#2ecc71,#16a085)'; rev.title = `Revenue ${formatCurrency(entry.value,state.currency)}`;
    const exp = expenseData[idx] || { value:0 };
    const ex = document.createElement('div'); ex.style.height = `${Math.max((exp.value / max) * 100, 6)}%`; ex.style.width='36%'; ex.style.background='linear-gradient(180deg,#f1c40f,#d4a017)'; ex.title = `Expense ${formatCurrency(exp.value,state.currency)}`;
    const bars = document.createElement('div'); bars.style.display='flex'; bars.style.flexDirection='column-reverse'; bars.style.alignItems='center'; bars.style.justifyContent='flex-end'; bars.style.gap='6px'; bars.style.height='160px'; bars.style.width='100%'; bars.appendChild(rev); bars.appendChild(ex);
    const label = document.createElement('span'); label.textContent = entry.label; label.style.fontSize='11px'; label.style.color='var(--muted)'; label.style.marginTop='6px';
    colWrap.appendChild(bars); colWrap.appendChild(label);
    return colWrap;
  });
  cols.forEach(c=>wrapper.appendChild(c));
  // Legend
  const legend = document.createElement('div'); legend.style.display='flex'; legend.style.gap='12px'; legend.style.marginTop='8px';
  const rL = document.createElement('div'); rL.innerHTML = '<span style="display:inline-block;width:10px;height:10px;background:#2ecc71;margin-right:6px;border-radius:2px"></span>Revenue';
  const eL = document.createElement('div'); eL.innerHTML = '<span style="display:inline-block;width:10px;height:10px;background:#f1c40f;margin-right:6px;border-radius:2px"></span>Expenses';
  legend.appendChild(rL); legend.appendChild(eL);
  host.appendChild(wrapper); host.appendChild(legend);
}

function renderPortfolioChart() {
  const host = $("#portfolio-chart");
  if (!host) return;
  host.replaceChildren();
  const pts = (state.portfolio || []).slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
  if (!pts.length) { const empty = document.createElement('div'); empty.textContent = 'No portfolio data yet.'; empty.style.color = 'var(--muted)'; host.appendChild(empty); return; }
  const values = pts.map(p=>Number(p.value||0));
  const initial = values[0]; const latest = values[values.length-1];
  const change = initial ? ((latest - initial) / initial) * 100 : 0;
  const metrics = document.createElement('div'); metrics.className = 'portfolio-metrics';
  metrics.innerHTML = `<div><span class="eyebrow">Entries</span><strong>${pts.length}</strong></div><div><span class="eyebrow">Initial value</span><strong>${formatCurrency(initial||0,state.currency)}</strong></div><div><span class="eyebrow">Latest value</span><strong>${formatCurrency(latest||0,state.currency)}</strong></div><div><span class="eyebrow">Return</span><strong>${change.toFixed(2)}%</strong></div>`;
  host.appendChild(metrics);
  // sparkline
  const width = 600, height = 120, padding = 8;
  const min = Math.min(...values), max = Math.max(...values);
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('viewBox',`0 0 ${width} ${height}`); svg.setAttribute('width','100%'); svg.style.display='block';
  const path = values.map((v,i)=>{ const x = padding + (i/(values.length-1 || 1))*(width-padding*2); const y = height - padding - ((v - min) / ( (max-min)||1))*(height-padding*2); return `${i===0?'M':'L'} ${x} ${y}`; }).join(' ');
  const g = document.createElementNS('http://www.w3.org/2000/svg','path'); g.setAttribute('d', path); g.setAttribute('fill','none'); g.setAttribute('stroke', change >=0 ? '#2ecc71' : '#e74c3c'); g.setAttribute('stroke-width','2'); svg.appendChild(g);
  host.appendChild(svg);
  // list entries
  const list = document.createElement('div'); pts.slice().reverse().forEach(p => { const el = document.createElement('div'); el.className='portfolio-entry'; el.innerHTML = `<div>${escapeHtml(p.name||p.asset||'Asset')}</div><div>${p.date}</div><div><strong>${formatCurrency(p.value||0,state.currency)}</strong></div>`; list.appendChild(el); });
  host.appendChild(list);
}

// ensure portfolio list renders too
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
  renderFinanceOverview();
  renderInvoices();
  renderPayments();
  renderPLChart();
  renderPortfolioChart();
  renderPortfolioList();
}

/* Finance: invoices/payments and P&L */
function addInvoice(invoice) {
  state.invoices.push({ id: Date.now(), ...invoice });
  save(); render();
}

function addPayment(payment) {
  const p = { id: Date.now(), ...payment };
  // normalize invoiceId
  if (p.invoiceId === "" || p.invoiceId === null) delete p.invoiceId;
  state.payments.push(p);
  // if payment references an invoice, mark invoice paid
  if (p.invoiceId) {
    const inv = state.invoices.find(i => String(i.id) === String(p.invoiceId));
    if (inv) { inv.status = 'paid'; inv.paidOn = p.date; inv.paidAmount = p.amount; }
  }
  // attempt auto-reconciliation for payments without explicit invoiceId
  reconcilePayments();
  save(); render();
}

function renderInvoices() {
  const host = $("#invoice-list");
  if (!host) return;
  host.replaceChildren(...state.invoices.slice().reverse().map(inv => {
    const row = document.createElement('tr');
    const paidOn = inv.paidOn ? inv.paidOn : '';
    row.innerHTML = `<td>${escapeHtml(inv.client)}</td><td>${inv.date}</td><td class="amount-cell">${formatCurrency(inv.amount,state.currency)}</td><td>${escapeHtml(inv.status || 'issued')}</td><td>${paidOn}</td>`;
    return row;
  }));
  populatePaymentInvoiceOptions();
}

function renderPayments() {
  const host = $("#payment-list");
  if (!host) return;
  host.replaceChildren(...state.payments.slice().reverse().map(p => {
    const row = document.createElement('tr');
    const invoiceRef = p.invoiceId ? `<a href="#" data-invoice-id="${p.invoiceId}" class="invoice-link">${p.invoiceId}</a>` : '';
    row.innerHTML = `<td>${p.date}</td><td>${escapeHtml(p.client)}</td><td class="amount-cell">${formatCurrency(p.amount,state.currency)}</td><td class="amount-cell">${invoiceRef}</td>`;
    return row;
  }));
}

function populatePaymentInvoiceOptions() {
  const sel = $("#payment-invoice");
  if (!sel) return;
  // keep a default option
  const defaultOpt = '<option value="">Apply to invoice (optional)</option>';
  const unpaid = state.invoices.filter(i => (i.status || 'issued') !== 'paid');
  sel.innerHTML = defaultOpt + unpaid.map(i => `<option value="${i.id}">${escapeHtml(i.client)} — ${i.date} — ${formatCurrency(i.amount,state.currency)}</option>`).join('');
}

// CSV helpers
function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function objArrayToCsv(rows) {
  if (!rows || !rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g,'""')}"`;
  const lines = [headers.map(esc).join(',')];
  rows.forEach(r => lines.push(headers.map(h => esc(r[h])).join(',')));
  return lines.join('\r\n');
}

function csvToObjects(text) {
  // Robust CSV parsing supporting quoted fields and commas inside quotes
  const rows = [];
  const re = /\s*(?:"([^"]*(?:""[^"]*)*)"|([^,]*))\s*(?:,|$)/g;
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
  if (!lines.length) return [];
  const headers = [];
  // parse header
  let m; re.lastIndex = 0; while ((m = re.exec(lines[0]))) { const val = m[1] !== undefined ? m[1].replace(/""/g,'"') : (m[2]||''); headers.push(val); if (m[0].endsWith(',')) continue; else break; }
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const obj = {};
    let idx = 0; re.lastIndex = 0;
    while ((m = re.exec(line))) {
      const val = m[1] !== undefined ? m[1].replace(/""/g,'"') : (m[2]||'');
      const key = headers[idx++] || `col${idx}`;
      obj[key] = val;
      if (!m[0] || m[0].endsWith(',')) continue; else break;
    }
    // fill missing headers
    headers.forEach((h) => { if (!(h in obj)) obj[h] = ''; });
    rows.push(obj);
  }
  return rows;
}

function exportInvoicesCsv() {
  const rows = state.invoices.map(i => ({ id: i.id, client: i.client, amount: i.amount, date: i.date, status: i.status || 'issued', paidOn: i.paidOn || '', paidAmount: i.paidAmount || '' }));
  const csv = objArrayToCsv(rows);
  downloadCsv('invoices.csv', csv);
  showToast('Invoices exported', 'success');
}

function importInvoicesCsvFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const rows = csvToObjects(String(e.target.result || ''));
      rows.forEach((r, idx) => {
        const id = r.id || (Date.now() + idx);
        state.invoices.push({ id, client: r.client || '', amount: Number(r.amount||0), date: r.date || dateInput(), status: r.status || 'issued', paidOn: r.paidOn || null, paidAmount: r.paidAmount || null });
      });
      save(); render();
      showToast('Invoices imported', 'success');
    } catch (err) { alert('Failed to import invoices.'); }
  };
  reader.readAsText(file);
}

function exportPaymentsCsv() {
  const rows = state.payments.map(p => ({ id: p.id, client: p.client, amount: p.amount, date: p.date, invoiceId: p.invoiceId || '' }));
  const csv = objArrayToCsv(rows);
  downloadCsv('payments.csv', csv);
  showToast('Payments exported', 'success');
}

function importPaymentsCsvFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const rows = csvToObjects(String(e.target.result || ''));
      rows.forEach((r, idx) => {
        const id = r.id || (Date.now() + idx);
        const p = { id, client: r.client || '', amount: Number(r.amount||0), date: r.date || dateInput() };
        if (r.invoiceId) p.invoiceId = r.invoiceId;
        state.payments.push(p);
      });
      reconcilePayments(); save(); render();
      showToast('Payments imported', 'success');
    } catch (err) { alert('Failed to import payments.'); }
  };
  reader.readAsText(file);
}

// Toasts
function showToast(message, type='info', ms=3500) {
  let container = document.getElementById('toast-container');
  if (!container) { container = document.createElement('div'); container.id = 'toast-container'; document.body.appendChild(container); }
  const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = message;
  container.appendChild(t);
  setTimeout(()=>{ t.style.opacity = '0'; setTimeout(()=> t.remove(), 300); }, ms);
}

// wire import/export buttons
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'invoice-export') { e.preventDefault(); exportInvoicesCsv(); }
  if (e.target && e.target.id === 'invoice-import-btn') { e.preventDefault(); document.getElementById('invoice-import-file').click(); }
  if (e.target && e.target.id === 'payment-export') { e.preventDefault(); exportPaymentsCsv(); }
  if (e.target && e.target.id === 'payment-import-btn') { e.preventDefault(); document.getElementById('payment-import-file').click(); }
});

const invoiceImportFile = document.getElementById('invoice-import-file');
if (invoiceImportFile) invoiceImportFile.addEventListener('change', (ev) => { const f = ev.target.files[0]; if (f) importInvoicesCsvFile(f); ev.target.value = ''; });

const paymentImportFile = document.getElementById('payment-import-file');
if (paymentImportFile) paymentImportFile.addEventListener('change', (ev) => { const f = ev.target.files[0]; if (f) importPaymentsCsvFile(f); ev.target.value = ''; });

function reconcilePayments() {
  // For payments without invoiceId, try to match by client + amount to an unpaid invoice
  state.payments.forEach(p => {
    if (p.invoiceId) return;
    const candidate = state.invoices.find(i => (i.status || 'issued') !== 'paid' && i.client === p.client && Number(i.amount) === Number(p.amount));
    if (candidate) {
      candidate.status = 'paid';
      candidate.paidOn = p.date;
      candidate.paidAmount = p.amount;
      p.invoiceId = candidate.id;
    }
  });
}

function getMonthlyRevenue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return state.payments.reduce((sum,p)=>{
    const d = new Date(p.date);
    if (d.getFullYear()===year && d.getMonth()===month) return sum + Number(p.amount||0);
    return sum;
  },0);
}

function getYtdRevenue() {
  const year = new Date().getFullYear();
  return state.payments.reduce((sum,p)=>{ const d=new Date(p.date); if(d.getFullYear()===year) return sum+Number(p.amount||0); return sum; },0);
}

function renderFinanceOverview() {
  const monthlyRev = getMonthlyRevenue();
  const ytdRev = getYtdRevenue();
  const spent = totals();
  const monthlyExpenses = getCurrentMonthDailyData().reduce((s,d)=>s+d.value,0);
  const ytdExpenses = Object.values(spent).reduce((s,v)=>s+v,0);
  const monthlyProfit = monthlyRev - monthlyExpenses;
  const ytdProfit = ytdRev - ytdExpenses;
  const elMonthly = $("#monthly-revenue"); if(elMonthly) elMonthly.textContent = formatCurrency(monthlyRev,state.currency);
  const elYtd = $("#ytd-revenue"); if(elYtd) elYtd.textContent = formatCurrency(ytdRev,state.currency);
  const elMProfit = $("#monthly-profit"); if(elMProfit) elMProfit.textContent = formatCurrency(monthlyProfit,state.currency);
  const elYProfit = $("#ytd-profit"); if(elYProfit) elYProfit.textContent = formatCurrency(ytdProfit,state.currency);
}

// Reverse budgeting: simple estimator (distribute shortfall across categories)
function estimateReverseBudget(targetProfit) {
  const spent = totals();
  const totalExpenses = Object.values(spent).reduce((s,v)=>s+v,0);
  const monthlyRevenue = getMonthlyRevenue();
  const target = Number(targetProfit || 0);
  const maxAllowedExpenses = monthlyRevenue - target;
  const requiredReduction = Math.max(0, totalExpenses - maxAllowedExpenses);
  const suggestions = {};
  if (requiredReduction <= 0) {
    return { requiredReduction: 0, totalExpenses, suggestions, note: 'No reduction required', monthlyRevenue, target };
  }

  // Distribute reduction proportionally across categories but never below zero.
  const categories = Object.keys(spent);
  const total = totalExpenses || 1;
  // First pass: proportional reductions
  categories.forEach(cat => {
    const amt = Number(spent[cat] || 0);
    const proportional = (amt / total) * requiredReduction;
    const reduction = Math.min(amt, Math.round(proportional * 100) / 100);
    suggestions[cat] = { current: amt, reduction: reduction, suggested: Math.max(0, +(amt - reduction).toFixed(2)) };
  });

  // Fix residual rounding by assigning remaining reduction to largest categories
  const sumReductions = Object.values(suggestions).reduce((s, o) => s + (o.reduction || 0), 0);
  let residual = +(requiredReduction - sumReductions).toFixed(2);
  if (residual > 0) {
    const sorted = Object.entries(suggestions).sort((a, b) => b[1].current - a[1].current);
    for (const [cat, obj] of sorted) {
      if (residual <= 0) break;
      const available = Math.min(obj.current - obj.suggested, residual);
      obj.reduction = +(obj.reduction + available).toFixed(2);
      obj.suggested = +(obj.current - obj.reduction).toFixed(2);
      residual = +(residual - available).toFixed(2);
    }
  }

  return { requiredReduction: +(requiredReduction.toFixed(2)), totalExpenses, suggestions, monthlyRevenue, target };
}

function showReverseBudgetSuggestions(result) {
  const overlayId = 'reverse-budget-overlay';
  let overlay = document.getElementById(overlayId);
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = overlayId;
  overlay.style = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
  const box = document.createElement('div');
  box.style = 'background:#fff;color:#111;padding:18px;border-radius:8px;max-width:900px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 8px 30px rgba(0,0,0,0.25);';
  const h = document.createElement('h3'); h.textContent = 'Reverse Budget Suggestions';
  const p = document.createElement('p');
  p.textContent = `Monthly revenue: ${formatCurrency(result.monthlyRevenue||0,state.currency)} — Target profit: ${formatCurrency(result.target||0,state.currency)} — Required reduction: ${formatCurrency(result.requiredReduction||0,state.currency)}`;
  box.appendChild(h); box.appendChild(p);
  const table = document.createElement('table');
  table.style = 'width:100%;border-collapse:collapse;margin-top:10px;';
  const thead = document.createElement('thead'); thead.innerHTML = '<tr><th style="text-align:left;padding:6px">Category</th><th style="text-align:right;padding:6px">Current</th><th style="text-align:right;padding:6px">Reduction</th><th style="text-align:right;padding:6px">Suggested</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  Object.entries(result.suggestions || {}).forEach(([cat, obj]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="padding:6px">${escapeHtml(cat)}</td><td style="padding:6px;text-align:right">${formatCurrency(obj.current,state.currency)}</td><td style="padding:6px;text-align:right">${formatCurrency(obj.reduction,state.currency)}</td><td style="padding:6px;text-align:right">${formatCurrency(obj.suggested,state.currency)}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  box.appendChild(table);
  const close = document.createElement('button'); close.textContent = 'Close'; close.style='margin-top:12px;padding:8px 12px;border-radius:6px;border:0;background:#333;color:#fff;cursor:pointer;';
  close.addEventListener('click', ()=> overlay.remove());
  box.appendChild(close);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
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
    // ensure the latest render
    await new Promise((r) => requestAnimationFrame(r));
    const canvas = await html2canvas(host, { backgroundColor: '#ffffff', scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf || window.jspPDF || window.jspdf || {};
    if (!jsPDF) {
      const w = window.open('', '_blank');
      w.document.body.style.margin = '0';
      const img = new Image(); img.src = imgData; img.style.width = '100%'; w.document.body.appendChild(img);
      return;
    }

    const pdf = new jsPDF('portrait', 'pt', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 24; // points
    const usableWidth = pageWidth - margin * 2;

    // scale the canvas image to fit usable width
    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // If fits on one page
    if (imgHeight <= pageHeight - margin * 2) {
      pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
      pdf.save('budget-review.pdf');
      return;
    }

    // Multi-page: slice canvas vertically into page-height chunks
    const pxPerPt = canvas.height / imgHeight; // pixels per point of rendered image
    const slicePtHeight = pageHeight - margin * 2;
    const slicePxHeight = Math.floor(slicePtHeight * pxPerPt);

    let y = 0;
    let page = 0;
    while (y < canvas.height) {
      const sliceH = Math.min(slicePxHeight, canvas.height - y);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      const ctx = sliceCanvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const sliceData = sliceCanvas.toDataURL('image/png');
      const sliceScaledHeight = (sliceCanvas.height * imgWidth) / canvas.width;
      if (page > 0) pdf.addPage();
      pdf.addImage(sliceData, 'PNG', margin, margin, imgWidth, sliceScaledHeight);
      y += sliceH;
      page += 1;
    }
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
  doc.write(`<!doctype html><html><head><title>Presentation - Budget Review</title><link rel="stylesheet" href="/style.css"><style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;background:#fff}#slide{width:1200px;height:720px;box-shadow:0 20px 60px rgba(0,0,0,.12);border-radius:8px;overflow:hidden;background:#fff;padding:28px} .slide-center{display:flex;flex-direction:column;height:100%;}</style></head><body><div id="slide" tabindex="0"><div class="slide-center" id="slide-content"></div></div><script>document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') window.close(); });</script></body></html>`);
  doc.close();
  const container = doc.getElementById('slide-content');
  const clone = host.cloneNode(true);
  clone.style.maxWidth = '100%';
  clone.style.margin = '0';
  clone.querySelectorAll('.review-actions, .primary-button, .text-button').forEach(el=>el && el.remove());
  container.appendChild(clone);
  // request fullscreen if allowed
  popup.onload = () => {
    try { popup.document.getElementById('slide').focus(); popup.document.getElementById('slide').requestFullscreen?.(); } catch (e) {}
  };
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
  if (e.target && e.target.classList && e.target.classList.contains('nav-card')) {
    const sel = e.target.getAttribute('data-target');
    if (!sel) return;
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({behavior:'smooth'});
  }
  if (e.target && e.target.classList && e.target.classList.contains('nav-button')) {
    const t = e.target.getAttribute('data-target');
    if (!t) return;
    if (t === 'finance') document.getElementById('finance-section')?.scrollIntoView({behavior:'smooth'});
    if (t === 'dashboard') window.scrollTo({top:0,behavior:'smooth'});
    if (t === 'budgets') document.getElementById('budget-cards')?.scrollIntoView({behavior:'smooth'});
    if (t === 'transactions') document.getElementById('transaction-list')?.scrollIntoView({behavior:'smooth'});
    if (t === 'review') document.getElementById('review-chart')?.scrollIntoView({behavior:'smooth'});
  }
});

// Invoice form
const invoiceForm = document.getElementById('invoice-form');
if (invoiceForm) invoiceForm.addEventListener('submit', (ev)=>{ev.preventDefault(); const client=document.getElementById('invoice-client').value.trim(); const amount=Number(document.getElementById('invoice-amount').value); const date=document.getElementById('invoice-date').value; const status=document.getElementById('invoice-status').value; if(!client||!amount||!date) return alert('Fill invoice fields'); addInvoice({client,amount,date,status}); invoiceForm.reset(); document.getElementById('invoice-date').value = dateInput();});

// Payment form
const paymentForm = document.getElementById('payment-form');
if (paymentForm) paymentForm.addEventListener('submit',(ev)=>{ev.preventDefault(); const client=document.getElementById('payment-client').value.trim(); const amount=Number(document.getElementById('payment-amount').value); const date=document.getElementById('payment-date').value; if(!client||!amount||!date) return alert('Fill payment fields'); addPayment({client,amount,date}); paymentForm.reset(); document.getElementById('payment-date').value = dateInput();});

// Reverse budget calculator
const calcBtn = document.getElementById('calc-reverse');
if (calcBtn) calcBtn.addEventListener('click', ()=>{
  const t = Number(document.getElementById('target-profit').value || 0);
  if (!t && t !== 0) return alert('Enter a target profit');
  const res = estimateReverseBudget(t);
  showReverseBudgetSuggestions(res);
});

// Portfolio view placeholder
const portBtn = document.getElementById('portfolio-view');
if (portBtn) portBtn.addEventListener('click', ()=>{ alert('Portfolio performance view coming soon.'); });

// Portfolio form
const portfolioForm = document.getElementById('portfolio-form');
if (portfolioForm) portfolioForm.addEventListener('submit', (ev)=>{ ev.preventDefault(); const name = (document.getElementById('portfolio-name').value||'').trim(); const date = document.getElementById('portfolio-date').value || dateInput(); const value = Number(document.getElementById('portfolio-value').value); if(!name||!Number.isFinite(value)) return alert('Enter portfolio name and value'); state.portfolio.push({ id: Date.now(), name, date, value }); save(); render(); portfolioForm.reset(); showToast('Portfolio entry added','success'); });

function renderPortfolioList() {
  const host = document.getElementById('portfolio-list');
  if (!host) return; host.replaceChildren(); (state.portfolio||[]).slice().reverse().forEach(p=>{ const el=document.createElement('div'); el.className='portfolio-entry'; el.innerHTML = `<div>${escapeHtml(p.name)}</div><div>${p.date}</div><div><strong>${formatCurrency(p.value,state.currency)}</strong></div>`; host.appendChild(el); });
}
