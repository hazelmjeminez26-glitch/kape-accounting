"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

/* ── Types ── */

type MenuCategory = "Coffee" | "Non-Coffee" | "Food" | "Pastry";

type MenuItem = {
  id: string;
  user_id: string;
  name: string;
  price: number;
  category: MenuCategory;
  is_available: boolean;
  created_at: string;
};

/* ── Constants ── */

const CATEGORIES: { value: MenuCategory; icon: string }[] = [
  { value: "Coffee",     icon: "☕" },
  { value: "Non-Coffee", icon: "🧃" },
  { value: "Food",       icon: "🍽️" },
  { value: "Pastry",     icon: "🥐" },
];

/* ── Helpers ── */

function fmtPrice(price: number) {
  return `₱${Number(price).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/* ── Main Page ── */

export default function MenuPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [items, setItems]             = useState<MenuItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [showModal, setShowModal]     = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [togglingId, setTogglingId]   = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  async function loadItems() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("menu_items")
      .select("*")
      .order("category")
      .order("name");
    if (err) setError("Hindi ma-load ang menu. Subukan ulit.");
    else setItems((data ?? []) as MenuItem[]);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
    loadItems();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Toggle availability with optimistic update */
  async function handleToggle(item: MenuItem) {
    setTogglingId(item.id);
    const next = !item.is_available;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: next } : i));

    const { error: err } = await supabase
      .from("menu_items")
      .update({ is_available: next })
      .eq("id", item.id);

    if (err) {
      // Revert optimistic update
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: item.is_available } : i));
      alert("Hindi ma-update. Subukan ulit.");
    }
    setTogglingId(null);
  }

  /* Save (add or edit) */
  async function handleSave(
    name: string,
    price: number,
    category: MenuCategory,
    isAvailable: boolean,
    id?: string
  ) {
    const sorted = (arr: MenuItem[]) =>
      [...arr].sort(
        (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
      );

    if (id) {
      const { data, error: err } = await supabase
        .from("menu_items")
        .update({ name, price, category, is_available: isAvailable })
        .eq("id", id)
        .select()
        .single();
      if (err) throw err;
      setItems(prev => sorted(prev.map(i => (i.id === id ? (data as MenuItem) : i))));
    } else {
      const { data, error: err } = await supabase
        .from("menu_items")
        .insert({ user_id: currentUser!.id, name, price, category, is_available: isAvailable })
        .select()
        .single();
      if (err) throw err;
      setItems(prev => sorted([...prev, data as MenuItem]));
    }
    setShowModal(false);
    setEditingItem(null);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const { error: err } = await supabase.from("menu_items").delete().eq("id", id);
    if (err) {
      alert("Hindi ma-delete. Subukan ulit.");
    } else {
      setItems(prev => prev.filter(i => i.id !== id));
      setDeleteConfirmId(null);
    }
    setDeletingId(null);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  /* Derived */
  const totalItems      = items.length;
  const availableCount  = items.filter(i => i.is_available).length;
  const unavailableCount = totalItems - availableCount;

  const grouped = CATEGORIES.reduce((acc, { value }) => {
    acc[value] = items.filter(i => i.category === value);
    return acc;
  }, {} as Record<MenuCategory, MenuItem[]>);

  const nonEmptyCategories = CATEGORIES.filter(({ value }) => grouped[value].length > 0);

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
        {/* Title + Add */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Menu Items ☕</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your coffee shop menu</p>
          </div>
          <button
            onClick={() => { setEditingItem(null); setShowModal(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors shrink-0"
          >
            + Add Item
          </button>
        </div>

        {/* Summary stats */}
        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            <SkeletonStat /><SkeletonStat /><SkeletonStat />
          </div>
        ) : !error && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon="📋" label="Total Items"  value={String(totalItems)} />
            <StatCard icon="✅" label="Available"    value={String(availableCount)} />
            <StatCard icon="🔴" label="Unavailable"  value={String(unavailableCount)} muted={unavailableCount === 0} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={loadItems} className="text-xs font-medium text-red-600 underline underline-offset-2">Retry</button>
          </div>
        )}

        {/* Menu list */}
        {loading ? (
          <div className="space-y-4">
            <SkeletonGroup /><SkeletonGroup />
          </div>
        ) : !error && totalItems === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 px-4 py-14 flex flex-col items-center gap-2 text-center">
            <span className="text-4xl">☕</span>
            <p className="text-sm font-semibold text-gray-600">Wala pang menu items</p>
            <p className="text-xs text-gray-400">Click "+ Add Item" to start building your menu.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {nonEmptyCategories.map(({ value: cat, icon }) => (
              <div key={cat} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {/* Category header */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <span>{icon}</span>
                  <h3 className="text-sm font-semibold text-gray-700">{cat}</h3>
                  <span className="ml-auto text-xs text-gray-400">
                    {grouped[cat].length} item{grouped[cat].length !== 1 ? "s" : ""}
                  </span>
                </div>
                {/* Items */}
                <div className="divide-y divide-gray-100">
                  {grouped[cat].map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      togglingId={togglingId}
                      deleteConfirmId={deleteConfirmId}
                      deletingId={deletingId}
                      onToggle={() => handleToggle(item)}
                      onEdit={() => { setEditingItem(item); setShowModal(true); }}
                      onDeleteClick={() => setDeleteConfirmId(item.id)}
                      onDeleteConfirm={() => handleDelete(item.id)}
                      onDeleteCancel={() => setDeleteConfirmId(null)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <MenuItemModal
          editingItem={editingItem}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          onSubmit={handleSave}
        />
      )}
    </div>
  );
}

/* ── Item Row ── */

function ItemRow({
  item, togglingId, deleteConfirmId, deletingId,
  onToggle, onEdit, onDeleteClick, onDeleteConfirm, onDeleteCancel,
}: {
  item: MenuItem;
  togglingId: string | null;
  deleteConfirmId: string | null;
  deletingId: string | null;
  onToggle: () => void;
  onEdit: () => void;
  onDeleteClick: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const isToggling = togglingId === item.id;
  const confirming = deleteConfirmId === item.id;
  const isDeleting = deletingId === item.id;

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Name + price */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${item.is_available ? "text-gray-800" : "text-gray-400 line-through"}`}>
            {item.name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{fmtPrice(item.price)}</p>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Toggle checked={item.is_available} onChange={onToggle} disabled={isToggling} />
          {isToggling ? (
            <Spinner className="h-3 w-3 text-gray-400" />
          ) : (
            <span className={`text-xs w-16 ${item.is_available ? "text-green-600 font-medium" : "text-gray-400"}`}>
              {item.is_available ? "Available" : "Unavailable"}
            </span>
          )}
        </div>

        {/* Edit */}
        <button
          onClick={onEdit}
          className="shrink-0 text-gray-400 hover:text-blue-500 transition-colors p-1 rounded-lg hover:bg-blue-50"
          aria-label="Edit"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.364-6.364a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2.414a2 2 0 01.586-1.414z" />
          </svg>
        </button>

        {/* Delete */}
        {!confirming && (
          <button
            onClick={onDeleteClick}
            className="shrink-0 text-gray-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
            aria-label="Delete"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Inline delete confirmation */}
      {confirming && (
        <div className="px-4 py-2.5 bg-red-50 border-t border-red-100 flex items-center justify-between gap-3">
          <p className="text-xs text-red-600 font-medium truncate">Delete &quot;{item.name}&quot;?</p>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onDeleteConfirm}
              disabled={isDeleting}
              className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              {isDeleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button onClick={onDeleteCancel} className="text-xs text-gray-400 hover:text-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Add / Edit Modal ── */

function MenuItemModal({
  editingItem,
  onClose,
  onSubmit,
}: {
  editingItem: MenuItem | null;
  onClose: () => void;
  onSubmit: (name: string, price: number, category: MenuCategory, isAvailable: boolean, id?: string) => Promise<void>;
}) {
  const isEdit = editingItem !== null;
  const [name, setName]               = useState(editingItem?.name ?? "");
  const [price, setPrice]             = useState(editingItem ? String(Number(editingItem.price)) : "");
  const [category, setCategory]       = useState<MenuCategory>(editingItem?.category ?? "Coffee");
  const [isAvailable, setIsAvailable] = useState(editingItem?.is_available ?? true);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required.";
    const p = parseFloat(price);
    if (price === "" || isNaN(p) || p < 0) e.price = "Enter a valid price (0 or more).";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit(name.trim(), parseFloat(price), category, isAvailable, editingItem?.id);
    } catch {
      setSaveError("Hindi na-save. Subukan ulit.");
      setSaving(false);
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? "Edit Menu Item" : "Add Menu Item"} ☕
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: "" })); }}
              placeholder="e.g. Barako Blend"
              className={inputClass}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Price + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (₱)</label>
              <input
                type="number" inputMode="decimal" min="0" step="any"
                value={price}
                onChange={e => { setPrice(e.target.value); setErrors(p => ({ ...p, price: "" })); }}
                placeholder="0.00"
                className={inputClass}
              />
              {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as MenuCategory)}
                className={inputClass}
              >
                {CATEGORIES.map(({ value, icon }) => (
                  <option key={value} value={value}>{icon} {value}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Available toggle */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Available</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {isAvailable ? "Showing on menu" : "Hidden / sold out"}
              </p>
            </div>
            <Toggle checked={isAvailable} onChange={() => setIsAvailable(v => !v)} />
          </div>

          {saveError && <p className="text-xs text-red-500 text-center">{saveError}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button" onClick={onClose} disabled={saving}
              className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && <Spinner className="h-4 w-4" />}
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Toggle switch ── */

function Toggle({
  checked, onChange, disabled = false,
}: {
  checked: boolean; onChange: () => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        checked ? "bg-green-500" : "bg-gray-300"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/* ── Small reusable pieces ── */

function StatCard({
  icon, label, value, muted = false,
}: {
  icon: string; label: string; value: string; muted?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-3 text-center ${muted ? "bg-white border-gray-200" : "bg-white border-gray-200"}`}>
      <span className="text-xl">{icon}</span>
      <p className="text-lg font-bold mt-1 text-gray-800">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function SkeletonStat() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 flex flex-col items-center gap-2 animate-pulse">
      <div className="h-5 w-5 rounded-full bg-gray-200" />
      <div className="h-5 w-8 rounded bg-gray-200" />
      <div className="h-3 w-14 rounded bg-gray-100" />
    </div>
  );
}

function SkeletonGroup() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="h-4 w-24 rounded bg-gray-200" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-gray-200" />
            <div className="h-3 w-16 rounded bg-gray-100" />
          </div>
          <div className="h-5 w-9 rounded-full bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
