"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

/* ── Types ── */

type MenuCategory = "Coffee" | "Non-Coffee" | "Food" | "Pastry";
type PaymentMethod = "Cash" | "GCash" | "Card";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: MenuCategory;
};

type CartItem = {
  menuItemId: string;
  name: string;
  price: number;
  category: MenuCategory;
  quantity: number;
};

type Receipt = {
  items: CartItem[];
  total: number;
  paymentMethod: PaymentMethod;
  time: string;
};

/* ── Constants ── */

const CATEGORIES: { value: MenuCategory; icon: string }[] = [
  { value: "Coffee",     icon: "☕" },
  { value: "Non-Coffee", icon: "🧃" },
  { value: "Food",       icon: "🍽️" },
  { value: "Pastry",     icon: "🥐" },
];

const PAYMENT_METHODS: { value: PaymentMethod; icon: string }[] = [
  { value: "Cash",  icon: "💵" },
  { value: "GCash", icon: "📱" },
  { value: "Card",  icon: "💳" },
];

/* ── Helpers ── */

function fmtPrice(price: number) {
  return `₱${Number(price).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/* ── Main Page ── */

export default function POSPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser]   = useState<User | null>(null);
  const [menuItems, setMenuItems]       = useState<MenuItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<MenuCategory | "All">("All");
  const [cart, setCart]                 = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [submitting, setSubmitting]     = useState(false);
  const [receipt, setReceipt]           = useState<Receipt | null>(null);

  async function loadMenu() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("menu_items")
      .select("id, name, price, category")
      .eq("is_available", true)
      .order("category")
      .order("name");
    if (err) setError("Hindi ma-load ang menu. Subukan ulit.");
    else setMenuItems((data ?? []) as MenuItem[]);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
    loadMenu();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Cart operations ── */

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id);
      if (existing) {
        return prev.map(c =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, {
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        quantity: 1,
      }];
    });
  }

  function updateQty(menuItemId: string, qty: number) {
    if (qty <= 0) {
      setCart(prev => prev.filter(c => c.menuItemId !== menuItemId));
    } else {
      setCart(prev => prev.map(c =>
        c.menuItemId === menuItemId ? { ...c, quantity: qty } : c
      ));
    }
  }

  function removeFromCart(menuItemId: string) {
    setCart(prev => prev.filter(c => c.menuItemId !== menuItemId));
  }

  /* ── Complete order ── */

  async function handleCompleteOrder() {
    if (cart.length === 0 || !currentUser) return;
    setSubmitting(true);

    const inserts = cart.map(item => ({
      user_id:       currentUser.id,
      type:          "sale",
      item_name:     item.name,
      amount:        item.price * item.quantity,
      quantity:      item.quantity,
      payment_method: paymentMethod,
      menu_item_id:  item.menuItemId, // used by Stage 4 for inventory deduction
    }));

    const { error: err } = await supabase.from("transactions").insert(inserts);

    if (err) {
      alert("Hindi nai-save ang order. Subukan ulit.");
      setSubmitting(false);
      return;
    }

    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const time  = new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
    setReceipt({ items: [...cart], total, paymentMethod, time });
    setCart([]);
    setSubmitting(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  /* ── Derived ── */

  const filteredItems = activeCategory === "All"
    ? menuItems
    : menuItems.filter(i => i.category === activeCategory);

  const grandTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount  = cart.reduce((s, i) => s + i.quantity, 0);

  // Only show category pills for categories that have available items.
  const presentCategories = CATEGORIES.filter(c =>
    menuItems.some(i => i.category === c.value)
  );

  /* ── Render ── */

  return (
    // flex-1 fills the flex body without creating a body scrollbar
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-100">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 shrink-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="text-gray-400 hover:text-gray-700 text-xl transition-colors"
              aria-label="Back to dashboard"
            >
              ←
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xl">🛒</span>
              <span className="text-base font-bold text-gray-900">New Order</span>
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

      {/* ── Two-panel content ── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

        {/* LEFT / TOP — Menu items */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">

          {/* Category filter pills */}
          {!loading && !error && presentCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
              <CategoryPill label="All" active={activeCategory === "All"} onClick={() => setActiveCategory("All")} />
              {presentCategories.map(({ value, icon }) => (
                <CategoryPill
                  key={value}
                  label={`${icon} ${value}`}
                  active={activeCategory === value}
                  onClick={() => setActiveCategory(value)}
                />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-red-700">{error}</p>
              <button onClick={loadMenu} className="text-xs font-medium text-red-600 underline">Retry</button>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }, (_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Empty — no available items at all */}
          {!loading && !error && menuItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="text-5xl mb-3">☕</span>
              <p className="text-sm font-semibold text-gray-600">Wala pang available na menu items</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">
                Add menu items and mark them available first.
              </p>
              <button
                onClick={() => router.push("/menu")}
                className="text-sm font-semibold text-blue-600 hover:text-blue-800 underline"
              >
                Go to Menu →
              </button>
            </div>
          )}

          {/* Empty — active category filter has no items */}
          {!loading && !error && menuItems.length > 0 && filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-gray-400">No available {activeCategory} items.</p>
            </div>
          )}

          {/* Menu grid */}
          {!loading && !error && filteredItems.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredItems.map(item => {
                const inCart = cart.find(c => c.menuItemId === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className={`relative bg-white rounded-2xl p-3 text-left transition-all active:scale-95 shadow-sm border-2 ${
                      inCart
                        ? "border-blue-500 bg-blue-50 shadow-blue-100"
                        : "border-transparent hover:border-gray-200 hover:shadow-md"
                    }`}
                  >
                    {/* Quantity badge */}
                    {inCart && (
                      <span className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1 shadow">
                        {inCart.quantity}
                      </span>
                    )}
                    <p className="text-sm font-semibold text-gray-800 leading-snug pr-7 line-clamp-2">
                      {item.name}
                    </p>
                    <p className="text-sm font-bold text-blue-600 mt-2">
                      {fmtPrice(item.price)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT / BOTTOM — Order panel */}
        <div className="h-[48vh] md:h-auto md:w-80 shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col overflow-hidden">

          {/* Panel header */}
          <div className="px-4 py-3 border-b border-gray-100 shrink-0 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Current Order</h2>
            {cartCount > 0 && (
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {cartCount} item{cartCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Cart items — scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-6 text-center px-4">
                <span className="text-3xl mb-2">🛒</span>
                <p className="text-sm font-medium text-gray-400">Cart is empty</p>
                <p className="text-xs text-gray-300 mt-0.5">Tap a menu item to add it</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {cart.map(item => (
                  <CartItemRow
                    key={item.menuItemId}
                    item={item}
                    onUpdateQty={updateQty}
                    onRemove={removeFromCart}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer: total + payment + button */}
          <div className="shrink-0 border-t border-gray-100">

            {/* Grand total */}
            {cart.length > 0 && (
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm text-gray-500 font-medium">Total</span>
                <span className="text-xl font-bold text-gray-900">{fmtPrice(grandTotal)}</span>
              </div>
            )}

            {/* Payment method */}
            <div className="px-4 pb-2">
              <div className="flex gap-1.5">
                {PAYMENT_METHODS.map(({ value, icon }) => (
                  <button
                    key={value}
                    onClick={() => setPaymentMethod(value)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      paymentMethod === value
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {icon} {value}
                  </button>
                ))}
              </div>
            </div>

            {/* Complete Order button */}
            <div className="px-4 pb-4 pt-1">
              <button
                onClick={handleCompleteOrder}
                disabled={cart.length === 0 || submitting || !currentUser}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl py-3.5 text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {submitting && <Spinner />}
                {submitting
                  ? "Processing…"
                  : cart.length === 0
                  ? "Add items to start an order"
                  : `Complete Order · ${fmtPrice(grandTotal)}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Success receipt overlay ── */}
      {receipt && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-sm">
            <div className="text-6xl mb-3">✅</div>
            <h2 className="text-2xl font-bold text-gray-900">Order Complete!</h2>
            <p className="text-gray-500 text-sm mt-1 mb-6">
              {receipt.time} ·{" "}
              {PAYMENT_METHODS.find(m => m.value === receipt.paymentMethod)?.icon}{" "}
              {receipt.paymentMethod}
            </p>

            {/* Receipt */}
            <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-2 mb-6">
              {receipt.items.map(item => (
                <div
                  key={item.menuItemId}
                  className="flex items-center justify-between text-sm gap-2"
                >
                  <span className="text-gray-700 flex-1 min-w-0 truncate">{item.name}</span>
                  <span className="text-gray-400 shrink-0">×{item.quantity}</span>
                  <span className="font-semibold text-gray-900 shrink-0">
                    {fmtPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-2.5 flex items-center justify-between font-bold text-base">
                <span>Total</span>
                <span>{fmtPrice(receipt.total)}</span>
              </div>
            </div>

            <button
              onClick={() => setReceipt(null)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-3.5 font-semibold text-sm transition-colors"
            >
              New Order →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Category filter pill ── */

function CategoryPill({
  label, active, onClick,
}: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

/* ── Cart item row ── */

function CartItemRow({
  item, onUpdateQty, onRemove,
}: {
  item: CartItem;
  onUpdateQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}) {
  const lineTotal = item.price * item.quantity;
  return (
    <div className="px-4 py-2.5 flex items-center gap-2">
      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
        <p className="text-xs text-gray-400">{fmtPrice(item.price)} each</p>
      </div>

      {/* Qty controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onUpdateQty(item.menuItemId, item.quantity - 1)}
          className="w-6 h-6 rounded-full bg-gray-100 hover:bg-red-100 hover:text-red-600 text-gray-600 font-bold text-sm flex items-center justify-center transition-colors"
          aria-label="Decrease"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-semibold text-gray-800">
          {item.quantity}
        </span>
        <button
          onClick={() => onUpdateQty(item.menuItemId, item.quantity + 1)}
          className="w-6 h-6 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-sm flex items-center justify-center transition-colors"
          aria-label="Increase"
        >
          +
        </button>
      </div>

      {/* Line total + remove */}
      <div className="text-right shrink-0 min-w-[56px]">
        <p className="text-sm font-semibold text-gray-900">{fmtPrice(lineTotal)}</p>
        <button
          onClick={() => onRemove(item.menuItemId)}
          className="text-xs text-gray-300 hover:text-red-400 transition-colors"
        >
          remove
        </button>
      </div>
    </div>
  );
}

/* ── Skeleton card ── */

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-3 animate-pulse space-y-2.5 shadow-sm">
      <div className="h-4 w-4/5 rounded bg-gray-200" />
      <div className="h-4 w-1/2 rounded bg-gray-200" />
    </div>
  );
}

/* ── Spinner ── */

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
