"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type PaymentMethod = "Cash" | "GCash" | "Card";

type ExpenseCategory =
  | "Ingredients"
  | "Rent"
  | "Salaries"
  | "Utilities"
  | "Equipment"
  | "Other";

// Shape mirrors the Supabase table exactly; amount is always positive here.
type Transaction = {
  id: string;
  type: "sale" | "expense";
  item_name: string;
  amount: number;
  quantity: number | null;
  payment_method: PaymentMethod | null;
  category: ExpenseCategory | null;
  supplier: string | null;
  created_at: string;
};

function txLabel(t: Transaction) {
  if (t.type === "sale" && t.quantity) return `${t.item_name} — ${t.quantity}x`;
  return t.item_name;
}

function txTime(t: Transaction) {
  return new Date(t.created_at).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddSale, setShowAddSale] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);

  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  async function loadTransactions() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) {
      setError("Hindi ma-load ang mga transaksyon. Subukan ulit.");
    } else {
      setTransactions((data ?? []) as Transaction[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
    loadTransactions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const totalSales = transactions
    .filter((t) => t.type === "sale")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const netProfit = totalSales - totalExpenses;

  async function handleAddSale(
    itemName: string,
    quantity: number,
    pricePerItem: number,
    paymentMethod: PaymentMethod
  ) {
    const { data, error: err } = await supabase
      .from("transactions")
      .insert({
        type: "sale",
        item_name: itemName,
        amount: quantity * pricePerItem,
        quantity,
        payment_method: paymentMethod,
        user_id: currentUser!.id,
      })
      .select()
      .single();
    if (err) throw err;
    setTransactions((prev) => [data as Transaction, ...prev]);
    setShowAddSale(false);
  }

  async function handleAddExpense(
    expenseName: string,
    amount: number,
    category: ExpenseCategory,
    supplier: string
  ) {
    const { data, error: err } = await supabase
      .from("transactions")
      .insert({
        type: "expense",
        item_name: expenseName,
        amount,
        category,
        supplier: supplier.trim() || null,
        user_id: currentUser!.id,
      })
      .select()
      .single();
    if (err) throw err;
    setTransactions((prev) => [data as Transaction, ...prev]);
    setShowAddExpense(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">☕</span>
            <span className="text-xl font-bold text-gray-900 tracking-tight">Kape</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{today}</span>
            <button
              onClick={handleLogout}
              className="text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Magandang araw, Maria! 👋</h1>
          <p className="text-gray-500 mt-1 text-sm">Here&apos;s your shop&apos;s financial summary for today.</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <SummaryCard label="Total Sales" amount={totalSales} icon="💰" color="green" description="Revenue earned today" />
              <SummaryCard label="Total Expenses" amount={totalExpenses} icon="🧾" color="red" description="Costs incurred today" />
              <SummaryCard label="Net Profit" amount={netProfit} icon="📈" color="blue" description="Sales minus expenses" highlight />
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickActionButton icon="➕" label="Add Sale" onClick={() => setShowAddSale(true)} />
            <QuickActionButton icon="📝" label="Add Expense" onClick={() => setShowAddExpense(true)} />
            <QuickActionButton icon="📊" label="View Reports" />
            <QuickActionButton icon="📋" label="Transaction History" />
          </div>
        </div>

        {/* Recent Transactions */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent Transactions</h2>

          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-5 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={loadTransactions}
                className="text-sm font-medium text-red-600 underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 px-4 py-10 flex flex-col items-center gap-2 text-center">
              <span className="text-3xl">☕</span>
              <p className="text-sm font-medium text-gray-600">Wala pang transaksyon</p>
              <p className="text-xs text-gray-400">Add your first sale or expense to get started.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
              {transactions.map((t) => (
                <TransactionRow
                  key={t.id}
                  label={txLabel(t)}
                  time={txTime(t)}
                  amount={t.amount}
                  type={t.type}
                  paymentMethod={t.payment_method ?? undefined}
                  category={t.category ?? undefined}
                  supplier={t.supplier ?? undefined}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-10">
        <div className="max-w-2xl mx-auto px-4 flex justify-around py-2">
          <NavItem icon="🏠" label="Home" active />
          <NavItem icon="💳" label="Sales" />
          <NavItem icon="🧾" label="Expenses" />
          <NavItem icon="📊" label="Reports" />
        </div>
      </nav>

      <div className="h-20" />

      {showAddSale && (
        <AddSaleModal onClose={() => setShowAddSale(false)} onSubmit={handleAddSale} />
      )}
      {showAddExpense && (
        <AddExpenseModal onClose={() => setShowAddExpense(false)} onSubmit={handleAddExpense} />
      )}
    </div>
  );
}

/* ── Skeleton loaders ── */

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 animate-pulse space-y-3">
      <div className="flex justify-between">
        <div className="h-5 w-5 rounded-full bg-gray-200" />
        <div className="h-4 w-12 rounded-full bg-gray-200" />
      </div>
      <div className="h-3 w-20 rounded bg-gray-200" />
      <div className="h-7 w-28 rounded bg-gray-200" />
      <div className="h-2.5 w-24 rounded bg-gray-100" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between px-4 py-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 rounded-full bg-gray-200" />
        <div className="space-y-1.5">
          <div className="h-3 w-36 rounded bg-gray-200" />
          <div className="h-2.5 w-20 rounded bg-gray-100" />
        </div>
      </div>
      <div className="h-4 w-14 rounded bg-gray-200" />
    </div>
  );
}

/* ── Add Sale Modal ── */

function AddSaleModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (itemName: string, quantity: number, pricePerItem: number, paymentMethod: PaymentMethod) => Promise<void>;
}) {
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const total =
    quantity && price ? (parseFloat(quantity) || 0) * (parseFloat(price) || 0) : null;

  function validate() {
    const e: Record<string, string> = {};
    if (!itemName.trim()) e.itemName = "Item name is required.";
    if (!quantity || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0)
      e.quantity = "Enter a valid quantity.";
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0)
      e.price = "Enter a valid price.";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit(itemName.trim(), parseFloat(quantity), parseFloat(price), paymentMethod);
    } catch {
      setSaveError("Hindi na-save. Subukan ulit.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Add New Sale ☕</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => { setItemName(e.target.value); setErrors((p) => ({ ...p, itemName: "" })); }}
              placeholder="e.g. Barako Blend"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {errors.itemName && <p className="text-xs text-red-500 mt-1">{errors.itemName}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number" inputMode="numeric" min="1"
                value={quantity}
                onChange={(e) => { setQuantity(e.target.value); setErrors((p) => ({ ...p, quantity: "" })); }}
                placeholder="1"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price per Item (₱)</label>
              <input
                type="number" inputMode="decimal" min="0.01" step="0.01"
                value={price}
                onChange={(e) => { setPrice(e.target.value); setErrors((p) => ({ ...p, price: "" })); }}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
            </div>
          </div>

          {total !== null && total > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm text-green-700 font-medium">Total</span>
              <span className="text-lg font-bold text-green-700">
                ₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <div className="flex gap-2">
              {(["Cash", "GCash", "Card"] as PaymentMethod[]).map((m) => (
                <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${paymentMethod === m ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
                  {m === "Cash" && "💵 "}{m === "GCash" && "📱 "}{m === "Card" && "💳 "}{m}
                </button>
              ))}
            </div>
          </div>

          {saveError && <p className="text-xs text-red-500 text-center">{saveError}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Spinner />}
              {saving ? "Saving…" : "Add Sale"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Add Expense Modal ── */

const CATEGORIES: { value: ExpenseCategory; icon: string }[] = [
  { value: "Ingredients", icon: "🥄" },
  { value: "Rent",        icon: "🏠" },
  { value: "Salaries",    icon: "👥" },
  { value: "Utilities",   icon: "💡" },
  { value: "Equipment",   icon: "🔧" },
  { value: "Other",       icon: "📦" },
];

const CATEGORY_BADGE: Record<ExpenseCategory, string> = {
  Ingredients: "bg-orange-100 text-orange-700",
  Rent:        "bg-purple-100 text-purple-700",
  Salaries:    "bg-indigo-100 text-indigo-700",
  Utilities:   "bg-cyan-100 text-cyan-700",
  Equipment:   "bg-amber-100 text-amber-700",
  Other:       "bg-gray-100 text-gray-600",
};

function AddExpenseModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (expenseName: string, amount: number, category: ExpenseCategory, supplier: string) => Promise<void>;
}) {
  const [expenseName, setExpenseName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Ingredients");
  const [supplier, setSupplier] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function validate() {
    const e: Record<string, string> = {};
    if (!expenseName.trim()) e.expenseName = "Expense name is required.";
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)
      e.amount = "Enter a valid amount.";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit(expenseName.trim(), parseFloat(amount), category, supplier);
    } catch {
      setSaveError("Hindi na-save. Subukan ulit.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Add New Expense 🧾</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expense Name</label>
            <input
              type="text"
              value={expenseName}
              onChange={(e) => { setExpenseName(e.target.value); setErrors((p) => ({ ...p, expenseName: "" })); }}
              placeholder="e.g. Coffee beans restock"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            {errors.expenseName && <p className="text-xs text-red-500 mt-1">{errors.expenseName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₱)</label>
            <input
              type="number" inputMode="decimal" min="0.01" step="0.01"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: "" })); }}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm text-red-700 font-medium">Total Expense</span>
              <span className="text-lg font-bold text-red-700">
                ₱{parseFloat(amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(({ value, icon }) => (
                <button key={value} type="button" onClick={() => setCategory(value)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium border transition-colors ${category === value ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
                  <span className="text-base">{icon}</span>
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supplier <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="e.g. Juan's Supplies"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>

          {saveError && <p className="text-xs text-red-500 text-center">{saveError}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Spinner />}
              {saving ? "Saving…" : "Add Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Spinner ── */

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

/* ── Sub-components ── */

function SummaryCard({
  label, amount, icon, color, description, highlight = false,
}: {
  label: string; amount: number; icon: string;
  color: "green" | "red" | "blue"; description: string; highlight?: boolean;
}) {
  const colorMap = {
    green: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", badge: "bg-green-100 text-green-700" },
    red:   { bg: "bg-red-50",   border: "border-red-200",   text: "text-red-700",   badge: "bg-red-100 text-red-700"   },
    blue:  { bg: "bg-blue-50",  border: "border-blue-200",  text: "text-blue-700",  badge: "bg-blue-100 text-blue-700" },
  };
  const c = colorMap[color];
  return (
    <div className={`rounded-2xl border p-4 ${c.bg} ${c.border} ${highlight ? "ring-2 ring-blue-300" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.badge}`}>Today</span>
      </div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${c.text}`}>₱{amount.toLocaleString("en-PH")}</p>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
    </div>
  );
}

function QuickActionButton({ icon, label, onClick }: { icon: string; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left w-full">
      <span className="text-lg">{icon}</span>
      {label}
    </button>
  );
}

const PAYMENT_BADGE: Record<PaymentMethod, string> = {
  Cash:  "bg-yellow-100 text-yellow-700",
  GCash: "bg-blue-100 text-blue-700",
  Card:  "bg-purple-100 text-purple-700",
};

function TransactionRow({
  label, time, amount, type, paymentMethod, category, supplier,
}: {
  label: string; time: string; amount: number; type: "sale" | "expense";
  paymentMethod?: PaymentMethod; category?: ExpenseCategory; supplier?: string;
}) {
  const isSale = type === "sale";
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-lg">{isSale ? "☕" : "🧾"}</span>
        <div>
          <p className="text-sm font-medium text-gray-800">{label}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <p className="text-xs text-gray-400">{time}</p>
            {paymentMethod && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${PAYMENT_BADGE[paymentMethod]}`}>
                {paymentMethod}
              </span>
            )}
            {category && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${CATEGORY_BADGE[category]}`}>
                {category}
              </span>
            )}
            {supplier && (
              <span className="text-xs text-gray-400 truncate max-w-[120px]">{supplier}</span>
            )}
          </div>
        </div>
      </div>
      <span className={`text-sm font-semibold shrink-0 ml-2 ${isSale ? "text-green-600" : "text-red-500"}`}>
        {isSale ? "+" : "−"}₱{Number(amount).toLocaleString("en-PH")}
      </span>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: string; label: string; active?: boolean }) {
  return (
    <button className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs font-medium transition-colors ${active ? "text-blue-600" : "text-gray-400 hover:text-gray-600"}`}>
      <span className="text-xl">{icon}</span>
      {label}
    </button>
  );
}
