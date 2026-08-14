import React, { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Plus, Trash2, Pencil, Check, X, AlertTriangle } from "lucide-react";

// ---- Design tokens ----
// Ledger-book aesthetic: warm paper, ink navy, ledger green, muted gold accent.
const COLORS = {
  paper: "#FAF7F1",
  paperLine: "#E7DFCF",
  ink: "#20302C",
  inkSoft: "#5B6B62",
  ledger: "#2F5233",
  ledgerLight: "#4A7654",
  gold: "#A6763D",
  goldLight: "#D9B98C",
  alert: "#B0453B",
  alertBg: "#F6E6E1",
  card: "#FFFFFF",
};

const CATEGORY_COLORS = {
  Supplies: "#2F5233",
  Payroll: "#5B6B62",
  Rent: "#A6763D",
  Marketing: "#7A8B6F",
  Utilities: "#8C6A3F",
  Other: "#3F5A54",
};

const CATEGORIES = ["Supplies", "Payroll", "Rent", "Marketing", "Utilities", "Other"];

const todayISO = () => new Date().toISOString().slice(0, 10);

const fmt = (n) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// ---- Seed data so the tracker isn't empty on first load ----
const initialBudgets = {
  Supplies: 800,
  Payroll: 3500,
  Rent: 1800,
  Marketing: 600,
  Utilities: 350,
  Other: 250,
};

const initialExpenses = [
  { id: 1, amount: 240, category: "Supplies", date: "2026-07-03", note: "Packaging materials" },
  { id: 2, amount: 3500, category: "Payroll", date: "2026-07-05", note: "Bi-weekly payroll run" },
  { id: 3, amount: 1800, category: "Rent", date: "2026-07-01", note: "Storefront rent" },
  { id: 4, amount: 180, category: "Marketing", date: "2026-07-10", note: "Local paper ad" },
  { id: 5, amount: 96, category: "Utilities", date: "2026-07-08", note: "Electric bill" },
  { id: 6, amount: 65, category: "Other", date: "2026-07-12", note: "Bank fees" },
  { id: 7, amount: 410, category: "Supplies", date: "2026-07-18", note: "Restock inventory" },
  { id: 8, amount: 120, category: "Marketing", date: "2026-07-20", note: "Social ads" },
];

function StatusTab({ pct }) {
  // Folder-tab signature element: color and label change with budget status.
  let label = "On track";
  let bg = COLORS.ledger;
  if (pct >= 100) {
    label = "Over budget";
    bg = COLORS.alert;
  } else if (pct >= 80) {
    label = "Close to limit";
    bg = COLORS.gold;
  }
  return (
    <div
      style={{
        position: "absolute",
        top: -14,
        left: 20,
        background: bg,
        color: "#fff",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11,
        letterSpacing: 0.4,
        padding: "4px 10px",
        borderRadius: "4px 4px 0 0",
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  );
}

function BudgetCard({ category, spent, cap, onEditCap }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cap);
  const pct = cap > 0 ? Math.min((spent / cap) * 100, 999) : 0;
  const barColor = pct >= 100 ? COLORS.alert : pct >= 80 ? COLORS.gold : COLORS.ledger;

  return (
    <div
      style={{
        position: "relative",
        background: COLORS.card,
        border: `1px solid ${COLORS.paperLine}`,
        borderRadius: 6,
        padding: "22px 20px 18px",
        marginTop: 14,
      }}
    >
      <StatusTab pct={pct} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3
          style={{
            margin: 0,
            fontFamily: "'lila Slab', serif",
            fontSize: 18,
            color: COLORS.ink,
            fontWeight: 600,
          }}
        >
          {category}
        </h3>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: CATEGORY_COLORS[category],
            display: "inline-block",
          }}
        />
      </div>

      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 22,
          color: COLORS.ink,
          marginTop: 8,
        }}
      >
        {fmt(spent)}{" "}
        <span style={{ fontSize: 13, color: COLORS.inkSoft, fontWeight: 400 }}>
          of{" "}
          {editing ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <input
                autoFocus
                type="number"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                style={{
                  width: 70,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 13,
                  padding: "1px 4px",
                  border: `1px solid ${COLORS.paperLine}`,
                  borderRadius: 3,
                }}
              />
              <button
                aria-label="Save budget cap"
                onClick={() => {
                  onEditCap(category, Number(draft) || 0);
                  setEditing(false);
                }}
                style={iconBtnStyle}
              >
                <Check size={13} />
              </button>
              <button
                aria-label="Cancel edit"
                onClick={() => {
                  setDraft(cap);
                  setEditing(false);
                }}
                style={iconBtnStyle}
              >
                <X size={13} />
              </button>
            </span>
          ) : (
            <>
              {fmt(cap)}{" "}
              <button
                aria-label={`Edit ${category} budget`}
                onClick={() => setEditing(true)}
                style={iconBtnStyle}
              >
                <Pencil size={12} />
              </button>
            </>
          )}
        </span>
      </div>

      <div
        style={{
          marginTop: 12,
          height: 8,
          borderRadius: 4,
          background: COLORS.paperLine,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(pct, 100)}%`,
            height: "100%",
            background: barColor,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: COLORS.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
        {pct.toFixed(0)}% used
      </div>
    </div>
  );
}

const iconBtnStyle = {
  border: "none",
  background: "transparent",
  color: COLORS.inkSoft,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  padding: 2,
};

export default function BusinessBudgetTracker() {
  const [budgets, setBudgets] = useState(initialBudgets);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [filterCategory, setFilterCategory] = useState("All");
  const [form, setForm] = useState({
    amount: "",
    category: CATEGORIES[0],
    date: todayISO(),
    note: "",
  });
  const [formError, setFormError] = useState("");

  const spentByCategory = useMemo(() => {
    const totals = {};
    CATEGORIES.forEach((c) => (totals[c] = 0));
    expenses.forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    return totals;
  }, [expenses]);

  const totalBudget = useMemo(
    () => Object.values(budgets).reduce((a, b) => a + b, 0),
    [budgets]
  );
  const totalSpent = useMemo(
    () => expenses.reduce((a, e) => a + e.amount, 0),
    [expenses]
  );
  const totalRemaining = totalBudget - totalSpent;

  const pieData = CATEGORIES.map((c) => ({
    name: c,
    value: spentByCategory[c] || 0,
  })).filter((d) => d.value > 0);

  const barData = CATEGORIES.map((c) => ({
    name: c,
    Spent: spentByCategory[c] || 0,
    Budget: budgets[c] || 0,
  }));

  const filteredExpenses = useMemo(() => {
    const list =
      filterCategory === "All"
        ? expenses
        : expenses.filter((e) => e.category === filterCategory);
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [expenses, filterCategory]);

  function handleAddExpense(e) {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!amt || amt <= 0) {
      setFormError("Enter an amount greater than zero.");
      return;
    }
    if (!form.date) {
      setFormError("Choose a date.");
      return;
    }
    setExpenses((prev) => [
      ...prev,
      {
        id: Date.now(),
        amount: amt,
        category: form.category,
        date: form.date,
        note: form.note.trim(),
      },
    ]);
    setForm({ amount: "", category: form.category, date: todayISO(), note: "" });
    setFormError("");
  }

  function handleDelete(id) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  function handleEditCap(category, value) {
    setBudgets((prev) => ({ ...prev, [category]: value }));
  }

  const overBudgetCategories = CATEGORIES.filter(
    (c) => budgets[c] > 0 && spentByCategory[c] >= budgets[c]
  );

  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        background: COLORS.paper,
        minHeight: "100vh",
        color: COLORS.ink,
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=lila+Slab:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
      />

      {/* Top bar */}
      <header
        style={{
          borderBottom: `1px solid ${COLORS.paperLine}`,
          padding: "20px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: COLORS.paper,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: 1.5,
              color: COLORS.gold,
              textTransform: "uppercase",
            }}
          >
            The Ledger
          </div>
          <h1
            style={{
              margin: "2px 0 0",
              fontFamily: "'lila Slab', serif",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            Business Budget Tracker
          </h1>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: COLORS.inkSoft }}>Monthly budget remaining</div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 24,
              fontWeight: 600,
              color: totalRemaining < 0 ? COLORS.alert : COLORS.ledger,
            }}
          >
            {fmt(totalRemaining)}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 32px 60px" }}>
        {overBudgetCategories.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: COLORS.alertBg,
              color: COLORS.alert,
              border: `1px solid ${COLORS.alert}33`,
              borderRadius: 6,
              padding: "10px 16px",
              marginBottom: 24,
              fontSize: 14,
            }}
          >
            <AlertTriangle size={16} />
            {overBudgetCategories.length === 1
              ? `${overBudgetCategories[0]} is over budget this month.`
              : `${overBudgetCategories.join(", ")} are over budget this month.`}
          </div>
        )}

        {/* Summary strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            marginBottom: 32,
          }}
        >
          {[
            { label: "Total budget", value: totalBudget, color: COLORS.ink },
            { label: "Total spent", value: totalSpent, color: COLORS.gold },
            {
              label: "Remaining",
              value: totalRemaining,
              color: totalRemaining < 0 ? COLORS.alert : COLORS.ledger,
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: COLORS.card,
                border: `1px solid ${COLORS.paperLine}`,
                borderRadius: 6,
                padding: "16px 18px",
              }}
            >
              <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 6 }}>
                {s.label}
              </div>
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 22,
                  fontWeight: 600,
                  color: s.color,
                }}
              >
                {fmt(s.value)}
              </div>
            </div>
          ))}
        </div>

        {/* Category budget cards */}
        <h2 style={{ fontFamily: "'lila Slab', serif", fontSize: 20, marginBottom: 0 }}>
          Category budgets
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: "16px 16px",
          }}
        >
          {CATEGORIES.map((c) => (
            <BudgetCard
              key={c}
              category={c}
              spent={spentByCategory[c] || 0}
              cap={budgets[c] || 0}
              onEditCap={handleEditCap}
            />
          ))}
        </div>

        {/* Charts */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginTop: 40,
          }}
        >
          <div
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.paperLine}`,
              borderRadius: 6,
              padding: 20,
            }}
          >
            <h3 style={{ fontFamily: "'lila Slab', serif", fontSize: 16, marginTop: 0 }}>
              Spending by category
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.paperLine}`,
              borderRadius: 6,
              padding: 20,
            }}
          >
            <h3 style={{ fontFamily: "'lila Slab', serif", fontSize: 16, marginTop: 0 }}>
              Budget vs. spent
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData}>
                <CartesianGrid stroke={COLORS.paperLine} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="Budget" fill={COLORS.goldLight} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Spent" fill={COLORS.ledger} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Add expense + transaction log */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px 1fr",
            gap: 20,
            marginTop: 40,
          }}
        >
          <form
            onSubmit={handleAddExpense}
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.paperLine}`,
              borderRadius: 6,
              padding: 20,
              alignSelf: "start",
            }}
          >
            <h3 style={{ fontFamily: "'lila Slab', serif", fontSize: 16, marginTop: 0 }}>
              Log an expense
            </h3>

            <label style={labelStyle}>Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              style={inputStyle}
            />

            <label style={labelStyle}>Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              style={inputStyle}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <label style={labelStyle}>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              style={inputStyle}
            />

            <label style={labelStyle}>Note (optional)</label>
            <input
              type="text"
              placeholder="What was this for?"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              style={inputStyle}
            />

            {formError && (
              <div style={{ color: COLORS.alert, fontSize: 12, marginBottom: 8 }}>
                {formError}
              </div>
            )}

            <button
              type="submit"
              style={{
                width: "100%",
                background: COLORS.ledger,
                color: "#fff",
                border: "none",
                borderRadius: 5,
                padding: "10px 0",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginTop: 4,
              }}
            >
              <Plus size={15} /> Add expense
            </button>
          </form>

          <div
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.paperLine}`,
              borderRadius: 6,
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3 style={{ fontFamily: "'lila Slab', serif", fontSize: 16, margin: 0 }}>
                Transaction log
              </h3>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                style={{ ...inputStyle, width: 160, marginBottom: 0 }}
              >
                <option value="All">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: COLORS.inkSoft }}>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Note</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: "18px 0", color: COLORS.inkSoft }}>
                        No expenses logged in this category yet.
                      </td>
                    </tr>
                  )}
                  {filteredExpenses.map((e) => (
                    <tr key={e.id} style={{ borderTop: `1px solid ${COLORS.paperLine}` }}>
                      <td style={tdStyle}>{e.date}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: CATEGORY_COLORS[e.category],
                              display: "inline-block",
                            }}
                          />
                          {e.category}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: COLORS.inkSoft }}>{e.note || "—"}</td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          fontFamily: "'IBM Plex Mono', monospace",
                        }}
                      >
                        {fmt(e.amount)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <button
                          aria-label="Delete expense"
                          onClick={() => handleDelete(e.id)}
                          style={iconBtnStyle}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 12,
  color: COLORS.inkSoft,
  marginBottom: 4,
  marginTop: 12,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: `1px solid ${COLORS.paperLine}`,
  borderRadius: 4,
  padding: "8px 10px",
  fontSize: 14,
  fontFamily: "'Inter', sans-serif",
  marginBottom: 4,
};

const thStyle = {
  padding: "0 8px 8px 0",
  fontWeight: 500,
  fontSize: 12,
};

const tdStyle = {
  padding: "8px 8px 8px 0",
};