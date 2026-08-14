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
const storageKey = "the-ledger-business-budget-v1";
const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const dateInput = () => new Date().toISOString().slice(0, 10);
let state = JSON.parse(localStorage.getItem(storageKey) || "null") || { budgets: { ...DEFAULT_BUDGETS }, expenses: [...DEFAULT_EXPENSES] };
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
  const { error } = await supabase.from("budget_workspaces").upsert({
    user_id: currentUser.id,
    budgets: state.budgets,
    expenses: state.expenses,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id" });
  setSyncStatus(error ? "Sync error" : "Cloud synced");
}
function setSyncStatus(message) { $("#sync-status").textContent = message; }
function updateAccountControls() {
  const button = $("#account-button");
  if (currentUser) {
    button.textContent = "Sign out";
    button.title = currentUser.email;
    setSyncStatus("Cloud synced");
  } else {
    button.textContent = "Sign in";
    button.title = "Sign in to save your workspace";
    setSyncStatus(supabase ? "Sign in to sync" : "Local workspace");
  }
}
async function loadCloudWorkspace() {
  if (!supabase || !currentUser) return;
  setSyncStatus("Loading workspace...");
  const { data, error } = await supabase.from("budget_workspaces").select("budgets, expenses").eq("user_id", currentUser.id).maybeSingle();
  if (error) { setSyncStatus("Sync error"); return; }
  if (data) {
    state = { budgets: { ...DEFAULT_BUDGETS, ...data.budgets }, expenses: Array.isArray(data.expenses) ? data.expenses : [] };
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
function updateSummary(spent) { const budget = Object.values(state.budgets).reduce((sum, value) => sum + Number(value), 0); const used = Object.values(spent).reduce((sum, value) => sum + value, 0); const remaining = budget - used; $("#total-budget").textContent = money.format(budget); $("#total-spent").textContent = money.format(used); $("#total-remaining").textContent = money.format(remaining); $("#header-remaining").textContent = money.format(remaining); $(".summary-item.remaining").classList.toggle("negative", remaining < 0); $("#header-remaining").style.color = remaining < 0 ? "var(--red)" : "var(--green)"; const over = CATEGORIES.filter((category) => state.budgets[category] > 0 && spent[category] >= state.budgets[category]); const alert = $("#budget-alert"); alert.hidden = !over.length; alert.textContent = over.length === 1 ? `${over[0]} is over budget this month.` : `${over.join(", ")} are over budget this month.`; }
function renderCards(spent) { const host = $("#budget-cards"); const template = $("#budget-card-template"); host.replaceChildren(...CATEGORIES.map((category) => { const fragment = template.content.cloneNode(true); const card = fragment.querySelector("article"); const cap = Number(state.budgets[category]); const used = spent[category]; const pct = cap > 0 ? (used / cap) * 100 : 0; const [label, color] = status(pct); fragment.querySelector("h3").textContent = category; fragment.querySelector(".category-dot").style.background = COLORS[category]; const tab = fragment.querySelector(".status-tab"); tab.textContent = label; tab.style.background = color; fragment.querySelector(".budget-figures strong").textContent = money.format(used); fragment.querySelector(".budget-cap").textContent = money.format(cap); const progress = fragment.querySelector(".progress-bar"); progress.style.width = `${Math.min(pct, 100)}%`; progress.style.background = color; fragment.querySelector(".usage").textContent = `${pct.toFixed(0)}% used`; fragment.querySelector(".edit-budget").addEventListener("click", () => editBudget(category)); return card; })); }
function editBudget(category) { const answer = prompt(`Set monthly budget for ${category}:`, state.budgets[category]); if (answer === null) return; const value = Number(answer); if (!Number.isFinite(value) || value < 0) { alert("Enter a valid budget amount."); return; } state.budgets[category] = value; save(); render(); }
function renderDonut(spent) { const entries = CATEGORIES.filter((category) => spent[category] > 0); const total = entries.reduce((sum, category) => sum + spent[category], 0); const donut = $("#donut-chart"); const legend = $("#chart-legend"); if (!total) { donut.style.background = "#e7e1d5"; legend.innerHTML = "<li>No expenses yet.</li>"; return; } let cursor = 0; const parts = entries.map((category) => { const start = cursor; cursor += (spent[category] / total) * 100; return `${COLORS[category]} ${start}% ${cursor}%`; }); donut.style.background = `conic-gradient(${parts.join(",")})`; legend.replaceChildren(...entries.map((category) => { const item = document.createElement("li"); item.innerHTML = `<b style="background:${COLORS[category]}"></b>${category} <strong>${money.format(spent[category])}</strong>`; return item; })); }
function renderBars(spent) { const maximum = Math.max(...CATEGORIES.flatMap((category) => [state.budgets[category], spent[category]]), 1); $("#bar-chart").replaceChildren(...CATEGORIES.map((category) => { const group = document.createElement("div"); group.className = "bar-group"; const budget = document.createElement("div"); budget.className = "bar budget"; budget.style.height = `${(state.budgets[category] / maximum) * 100}%`; budget.title = `${category} budget: ${money.format(state.budgets[category])}`; const used = document.createElement("div"); used.className = "bar spent"; used.style.height = `${(spent[category] / maximum) * 100}%`; used.title = `${category} spent: ${money.format(spent[category])}`; group.append(budget, used); const label = document.createElement("span"); label.className = "bar-label"; label.textContent = category; group.append(label); return group; })); }
function renderTransactions() { const filter = $("#transaction-filter").value; const expenses = state.expenses.filter((expense) => filter === "All" || expense.category === filter).sort((a, b) => b.date.localeCompare(a.date)); const body = $("#transaction-list"); if (!expenses.length) { body.innerHTML = "<tr><td class=\"empty-row\" colspan=\"5\">No expenses logged in this category yet.</td></tr>"; return; } body.replaceChildren(...expenses.map((expense) => { const row = document.createElement("tr"); row.innerHTML = `<td>${expense.date}</td><td><span class="category-cell"><i class="table-dot" style="background:${COLORS[expense.category]}"></i>${expense.category}</span></td><td>${escapeHtml(expense.note || "-")}</td><td class="amount-cell">${money.format(expense.amount)}</td><td class="amount-cell"><button class="delete-button" type="button" aria-label="Delete expense">Delete</button></td>`; row.querySelector("button").addEventListener("click", () => { state.expenses = state.expenses.filter((item) => item.id !== expense.id); save(); render(); }); return row; })); }
function escapeHtml(value) { const node = document.createElement("div"); node.textContent = value; return node.innerHTML; }
function render() { const spent = totals(); updateSummary(spent); renderCards(spent); renderDonut(spent); renderBars(spent); renderTransactions(); }
function populateCategories() { $("#expense-category").replaceChildren(...CATEGORIES.map((category) => new Option(category, category))); const filter = $("#transaction-filter"); CATEGORIES.forEach((category) => filter.add(new Option(category, category))); $("#expense-date").value = dateInput(); }
$("#expense-form").addEventListener("submit", (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const amount = Number(form.get("amount")); const error = $("#form-error"); if (!Number.isFinite(amount) || amount <= 0) { error.textContent = "Enter an amount greater than zero."; return; } state.expenses.push({ id: Date.now(), amount, category: form.get("category"), date: form.get("date"), note: form.get("note").trim() }); save(); event.currentTarget.reset(); $("#expense-date").value = dateInput(); error.textContent = ""; render(); });
$("#transaction-filter").addEventListener("change", renderTransactions); $("#reset-data").addEventListener("click", () => { if (confirm("Reset all budgets and expenses to the sample data?")) { state = { budgets: { ...DEFAULT_BUDGETS }, expenses: [...DEFAULT_EXPENSES] }; save(); render(); } });
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
