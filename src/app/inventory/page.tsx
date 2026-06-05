"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

/* ── Types ── */

type InventoryItem = {
  id: string;
  user_id: string;
  item_name: string;
  current_stock: number;
  unit: string;
  cost_per_unit: number;
  low_stock_threshold: number;
  created_at: string;
};

/* ── Helpers ── */

function isLow(item: InventoryItem) {
  return (
    Number(item.low_stock_threshold) > 0 &&
    Number(item.current_stock) <= Number(item.low_stock_threshold)
  );
}

function peso(v: number) {
  return `₱${Number(v).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function stockDisplay(item: InventoryItem) {
  const n = Number(item.current_stock);
  return `${n % 1 === 0 ? n : n.toFixed(2)} ${item.unit}`;
}

/* ── Main Page ── */

export default function InventoryPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadItems() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("inventory")
      .select("*")
      .order("item_name", { ascending: true });
    if (err) setError("Hindi ma-load ang inventory. Subukan ulit.");
    else setItems((data ?? []) as InventoryItem[]);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
    loadItems();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddItem(
    itemName: string,
    stock: number,
    unit: string,
    costPerUnit: number,
    threshold: number
  ) {
    const { data, error: err } = await supabase
      .from("inventory")
      .insert({
        user_id: currentUser!.id,
        item_name: itemName,
        current_stock: stock,
        unit,
        cost_per_unit: costPerUnit,
        low_stock_threshold: threshold,
      })
      .select()
      .single();
    if (err) throw err;
    setItems(prev =>
      [...prev, data as InventoryItem].sort((a, b) =>
        a.item_name.localeCompare(b.item_name)
      )
    );
    setShowAddItem(false);
  }

  async function handleUpdateStock(item: InventoryItem, newStock: number) {
    const { data, error: err } = await supabase
      .from("inventory")
      .update({ current_stock: newStock })
      .eq("id", item.id)
      .select()
      .single();
    if (err) throw err;
    setItems(prev => prev.map(i => (i.id === item.id ? (data as InventoryItem) : i)));
    setEditingItem(null);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const { error: err } = await supabase.from("inventory").delete().eq("id", id);
    if (err) {
      alert("Hindi ma-delete. Subukan ulit.");
    } else {
      setItems(prev => prev.filter(i => i.id !== id));
      setConfirmDeleteId(null);
    }
    setDeletingId(null);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  /* Derived */
  const totalValue    = items.reduce((s, i) => s + Number(i.current_stock) * Number(i.cost_per_unit), 0);
  const lowStockItems = items.filter(isLow);

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-10">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="text-gray-400 hover:text-gray-700 text-xl leading-none transition-colors"
              aria-label="Back to dashboard"
            >
              ←
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xl">☕</span>
              <span className="text-lg font-bold text-gray-900 tracking-tight">Kape</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Title + Add button */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory 📦</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track your stock and supplies</p>
          </div>
          <button
            onClick={() => setShowAddItem(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors shrink-0"
          >
            + Add Item
          </button>
        </div>

        {/* Summary stats */}
        {!loading && !error && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon="📦" label="Total Items" value={String(items.length)} />
            <StatCard icon="💰" label="Total Value" value={peso(totalValue)} small />
            <StatCard
              icon={lowStockItems.length > 0 ? "⚠️" : "✅"}
              label="Low Stock"
              value={String(lowStockItems.length)}
              alert={lowStockItems.length > 0}
            />
          </div>
        )}
        {loading && (
          <div className="grid grid-cols-3 gap-3">
            <SkeletonStat /><SkeletonStat /><SkeletonStat />
          </div>
        )}

        {/* Low-stock alert banner */}
        {!loading && lowStockItems.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-lg shrink-0">⚠️</span>
            <p className="text-sm font-medium text-red-700">
              {lowStockItems.length} item{lowStockItems.length > 1 ? "s are" : " is"} running low on stock
            </p>
            <span className="ml-auto text-xs text-red-500 font-medium">
              {lowStockItems.map(i => i.item_name).join(", ")}
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={loadItems}
              className="text-xs font-medium text-red-600 underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* Item list */}
        {loading ? (
          <div className="space-y-3">
            <SkeletonItem /><SkeletonItem /><SkeletonItem />
          </div>
        ) : !error && items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 px-4 py-14 flex flex-col items-center gap-2 text-center">
            <span className="text-4xl">📦</span>
            <p className="text-sm font-semibold text-gray-600">Wala pang inventory items</p>
            <p className="text-xs text-gray-400">Click "Add Item" to start tracking your stock.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                confirmDeleteId={confirmDeleteId}
                deletingId={deletingId}
                onEditStock={() => setEditingItem(item)}
                onDeleteClick={() => setConfirmDeleteId(item.id)}
                onDeleteConfirm={() => handleDelete(item.id)}
                onDeleteCancel={() => setConfirmDeleteId(null)}
              />
            ))}
          </div>
        )}
      </main>

      {showAddItem && (
        <AddItemModal onClose={() => setShowAddItem(false)} onSubmit={handleAddItem} />
      )}
      {editingItem && (
        <EditStockModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSubmit={handleUpdateStock}
        />
      )}
    </div>
  );
}

/* ── Item Card ── */

function ItemCard({
  item,
  confirmDeleteId,
  deletingId,
  onEditStock,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  item: InventoryItem;
  confirmDeleteId: string | null;
  deletingId: string | null;
  onEditStock: () => void;
  onDeleteClick: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const low      = isLow(item);
  const value    = Number(item.current_stock) * Number(item.cost_per_unit);
  const isDeleting = deletingId === item.id;
  const confirming = confirmDeleteId === item.id;

  return (
    <div
      className={`bg-white rounded-2xl border p-4 transition-colors ${
        low ? "border-red-200" : "border-gray-200"
      }`}
    >
      {/* Row 1: name + low stock badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-gray-900 leading-snug">{item.item_name}</p>
        {low && (
          <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            Low Stock
          </span>
        )}
      </div>

      {/* Row 2: stock details */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
        <span>
          <span className="font-semibold text-gray-700">{stockDisplay(item)}</span>
          {" "}in stock
        </span>
        <span>{peso(Number(item.cost_per_unit))}/{item.unit}</span>
        <span className="font-medium text-gray-700">Value: {peso(value)}</span>
        {Number(item.low_stock_threshold) > 0 && (
          <span className={low ? "text-red-500 font-medium" : ""}>
            Threshold: {item.low_stock_threshold} {item.unit}
          </span>
        )}
      </div>

      {/* Row 3: actions */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
        <button
          onClick={onEditStock}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
        >
          Edit Stock
        </button>

        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Delete this item?</span>
            <button
              onClick={onDeleteConfirm}
              disabled={isDeleting}
              className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              {isDeleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              onClick={onDeleteCancel}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={onDeleteClick}
            className="text-xs font-medium text-gray-400 hover:text-red-500 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Add Item Modal ── */

const UNIT_SUGGESTIONS = ["kg", "g", "liters", "ml", "pieces", "packs", "bottles", "bags", "boxes", "trays"];

function AddItemModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (name: string, stock: number, unit: string, cost: number, threshold: number) => Promise<void>;
}) {
  const [name, setName]           = useState("");
  const [stock, setStock]         = useState("");
  const [unit, setUnit]           = useState("");
  const [cost, setCost]           = useState("");
  const [threshold, setThreshold] = useState("");
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Item name is required.";
    if (stock === "" || isNaN(parseFloat(stock)) || parseFloat(stock) < 0)
      e.stock = "Enter a valid stock amount (0 or more).";
    if (!unit.trim()) e.unit = "Unit is required (e.g. kg, liters, pieces).";
    if (cost === "" || isNaN(parseFloat(cost)) || parseFloat(cost) < 0)
      e.cost = "Enter a valid cost per unit.";
    if (threshold !== "" && (isNaN(parseFloat(threshold)) || parseFloat(threshold) < 0))
      e.threshold = "Threshold must be 0 or more.";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit(
        name.trim(),
        parseFloat(stock),
        unit.trim(),
        parseFloat(cost),
        threshold === "" ? 0 : parseFloat(threshold)
      );
    } catch {
      setSaveError("Hindi na-save. Subukan ulit.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Add Inventory Item 📦</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Item Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: "" })); }}
              placeholder="e.g. Arabica Coffee Beans"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Stock + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock</label>
              <input
                type="number" inputMode="decimal" min="0" step="any"
                value={stock}
                onChange={e => { setStock(e.target.value); setErrors(p => ({ ...p, stock: "" })); }}
                placeholder="0"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {errors.stock && <p className="text-xs text-red-500 mt-1">{errors.stock}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <input
                type="text"
                list="unit-suggestions"
                value={unit}
                onChange={e => { setUnit(e.target.value); setErrors(p => ({ ...p, unit: "" })); }}
                placeholder="kg"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <datalist id="unit-suggestions">
                {UNIT_SUGGESTIONS.map(u => <option key={u} value={u} />)}
              </datalist>
              {errors.unit && <p className="text-xs text-red-500 mt-1">{errors.unit}</p>}
            </div>
          </div>

          {/* Cost per unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cost per Unit (₱)</label>
            <input
              type="number" inputMode="decimal" min="0" step="any"
              value={cost}
              onChange={e => { setCost(e.target.value); setErrors(p => ({ ...p, cost: "" })); }}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {errors.cost && <p className="text-xs text-red-500 mt-1">{errors.cost}</p>}
          </div>

          {/* Low stock threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Low Stock Threshold
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <input
              type="number" inputMode="decimal" min="0" step="any"
              value={threshold}
              onChange={e => { setThreshold(e.target.value); setErrors(p => ({ ...p, threshold: "" })); }}
              placeholder={`0 ${unit || "units"}`}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <p className="text-xs text-gray-400 mt-1">Show a Low Stock alert when stock falls to this amount. Leave at 0 to disable.</p>
            {errors.threshold && <p className="text-xs text-red-500 mt-1">{errors.threshold}</p>}
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
              {saving ? "Saving…" : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Edit Stock Modal ── */

function EditStockModal({
  item,
  onClose,
  onSubmit,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSubmit: (item: InventoryItem, newStock: number) => Promise<void>;
}) {
  const [newStock, setNewStock] = useState(String(Number(item.current_stock)));
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const parsed  = parseFloat(newStock);
  const current = Number(item.current_stock);
  const diff    = !isNaN(parsed) ? parsed - current : null;
  const isValid = !isNaN(parsed) && parsed >= 0;

  const diffLabel = diff !== null && diff !== 0
    ? diff > 0
      ? `+${diff % 1 === 0 ? diff : diff.toFixed(2)} ${item.unit} — Restock`
      : `${diff % 1 === 0 ? diff : diff.toFixed(2)} ${item.unit} — Usage`
    : null;

  const diffColor = diff !== null && diff > 0 ? "text-green-600" : "text-red-500";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit(item, parsed);
    } catch {
      setSaveError("Hindi na-save. Subukan ulit.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Edit Stock</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="bg-gray-50 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-0.5">Item</p>
          <p className="text-sm font-semibold text-gray-800">{item.item_name}</p>
        </div>

        <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Current Stock</p>
            <p className={`text-lg font-bold ${isLow(item) ? "text-red-600" : "text-gray-800"}`}>
              {stockDisplay(item)}
              {isLow(item) && (
                <span className="ml-2 text-xs font-semibold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                  Low
                </span>
              )}
            </p>
          </div>
          <span className="text-2xl">📦</span>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Amount</label>
            <div className="flex items-center gap-2">
              <input
                type="number" inputMode="decimal" min="0" step="any"
                value={newStock}
                onChange={e => setNewStock(e.target.value)}
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                autoFocus
              />
              <span className="text-sm text-gray-500 font-medium shrink-0">{item.unit}</span>
            </div>
            {!isNaN(parsed) && parsed < 0 && (
              <p className="text-xs text-red-500 mt-1">Stock cannot be negative.</p>
            )}
          </div>

          {diffLabel && (
            <div className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-center ${diff! > 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"} ${diffColor}`}>
              {diffLabel}
            </div>
          )}

          {saveError && <p className="text-xs text-red-500 text-center">{saveError}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving || !isValid || diff === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Spinner />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Small reusable pieces ── */

function StatCard({
  icon, label, value, alert = false, small = false,
}: {
  icon: string; label: string; value: string; alert?: boolean; small?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-3 text-center ${alert ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
      <span className="text-xl">{icon}</span>
      <p className={`font-bold mt-1 ${small ? "text-sm" : "text-lg"} ${alert ? "text-red-700" : "text-gray-800"}`}>
        {value}
      </p>
      <p className={`text-xs mt-0.5 ${alert ? "text-red-500" : "text-gray-400"}`}>{label}</p>
    </div>
  );
}

function SkeletonStat() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 flex flex-col items-center gap-2 animate-pulse">
      <div className="h-5 w-5 rounded-full bg-gray-200" />
      <div className="h-5 w-12 rounded bg-gray-200" />
      <div className="h-3 w-14 rounded bg-gray-100" />
    </div>
  );
}

function SkeletonItem() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse space-y-3">
      <div className="flex justify-between">
        <div className="h-4 w-36 rounded bg-gray-200" />
        <div className="h-4 w-16 rounded bg-gray-100" />
      </div>
      <div className="h-3 w-48 rounded bg-gray-100" />
      <div className="h-3 w-24 rounded bg-gray-100" />
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
