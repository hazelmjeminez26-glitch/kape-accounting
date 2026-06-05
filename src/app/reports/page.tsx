"use client";

import { useEffect, useRef, useState } from "react";

// RGB equivalents of CATEGORY_COLORS for use inside jsPDF (which takes r,g,b).
const CATEGORY_RGB: Record<string, [number, number, number]> = {
  Ingredients: [249, 115,  22],
  Rent:        [168,  85, 247],
  Salaries:    [ 99, 102, 241],
  Utilities:   [  6, 182, 212],
  Equipment:   [245, 158,  11],
  Other:       [107, 114, 128],
};
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell,
} from "recharts";
import { supabase } from "@/lib/supabase";

/* ── Types ── */

type Transaction = {
  id: string;
  type: "sale" | "expense";
  item_name: string;
  amount: number;
  category: string | null;
  created_at: string;
};

/* ── Constants ── */

const CATEGORY_COLORS: Record<string, string> = {
  Ingredients: "#f97316",
  Rent:        "#a855f7",
  Salaries:    "#6366f1",
  Utilities:   "#06b6d4",
  Equipment:   "#f59e0b",
  Other:       "#6b7280",
};

/* ── Helpers ── */

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function fmtMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-PH", {
    month: "long", year: "numeric",
  });
}

function peso(v: number) {
  return `₱${Number(v).toLocaleString("en-PH")}`;
}

function shortPeso(v: number) {
  if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₱${(v / 1_000).toFixed(1)}k`;
  return `₱${v}`;
}

function buildWeeklyData(txns: Transaction[], year: number, month: number) {
  const days = daysInMonth(year, month);
  const buckets = [
    { name: "Wk 1", start: 1,  end: 7  },
    { name: "Wk 2", start: 8,  end: 14 },
    { name: "Wk 3", start: 15, end: 21 },
    { name: "Wk 4", start: 22, end: 28 },
    { name: "Wk 5", start: 29, end: 31 },
  ].filter(b => b.start <= days);

  return buckets.map(({ name, start, end }) => {
    const wt = txns.filter(t => {
      const d = new Date(t.created_at).getDate();
      return d >= start && d <= Math.min(end, days);
    });
    return {
      name,
      Revenue:  wt.filter(t => t.type === "sale").reduce((s, t) => s + Number(t.amount), 0),
      Expenses: wt.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
    };
  });
}

function buildDailyProfit(txns: Transaction[], year: number, month: number) {
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => {
    const day = i + 1;
    const dt = txns.filter(t => new Date(t.created_at).getDate() === day);
    const rev = dt.filter(t => t.type === "sale").reduce((s, t) => s + Number(t.amount), 0);
    const exp = dt.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { day: String(day), Profit: rev - exp };
  });
}

function buildCategoryData(txns: Transaction[]) {
  const expenses = txns.filter(t => t.type === "expense");
  const total = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const map: Record<string, number> = {};
  expenses.forEach(t => {
    const cat = t.category || "Other";
    map[cat] = (map[cat] || 0) + Number(t.amount);
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value, pct: total > 0 ? (value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
}

/* ── Custom Tooltip ── */

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-md px-3 py-2 text-xs">
      {label && <p className="font-semibold text-gray-600 mb-1">{label}</p>}
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {peso(p.value)}
        </p>
      ))}
    </div>
  );
}

/* ── Small reusable pieces ── */

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 animate-pulse space-y-3">
      <div className="h-4 w-24 rounded bg-gray-200" />
      <div className="h-7 w-28 rounded bg-gray-200" />
      <div className="h-3 w-20 rounded bg-gray-100" />
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h3>
      {children}
    </div>
  );
}

function ReportSummaryCard({
  label, amount, icon, color, highlight = false, period,
}: {
  label: string; amount: number; icon: string;
  color: "green" | "red" | "blue"; highlight?: boolean; period: string;
}) {
  const c = {
    green: { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  badge: "bg-green-100 text-green-700"  },
    red:   { bg: "bg-red-50",    border: "border-red-200",    text: "text-red-700",    badge: "bg-red-100 text-red-700"    },
    blue:  { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700",   badge: "bg-blue-100 text-blue-700"   },
  }[color];
  return (
    <div className={`rounded-2xl border p-4 ${c.bg} ${c.border} ${highlight ? "ring-2 ring-blue-300" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.badge}`}>{period}</span>
      </div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${c.text}`}>₱{amount.toLocaleString("en-PH")}</p>
    </div>
  );
}

function EmptyState({ month }: { month: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 px-4 py-14 flex flex-col items-center gap-2 text-center">
      <span className="text-4xl">📊</span>
      <p className="text-sm font-semibold text-gray-600">Walang transaksyon para sa {month}</p>
      <p className="text-xs text-gray-400">Add sales and expenses on the dashboard to see reports here.</p>
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

/* ── Main Page ── */

export default function ReportsPage() {
  const router = useRouter();
  const reportRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  // Charts use browser APIs — only render after hydration.
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (isCurrentMonth) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const start = new Date(year, month - 1, 1).toISOString();
      const end   = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      const { data, error: err } = await supabase
        .from("transactions")
        .select("id, type, item_name, amount, category, created_at")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: true });
      if (err) setError("Hindi ma-load ang data. Subukan ulit.");
      else setTransactions((data ?? []) as Transaction[]);
      setLoading(false);
    }
    load();
  }, [year, month]);

  /* Derived data */
  const totalRevenue  = transactions.filter(t => t.type === "sale").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const netProfit     = totalRevenue - totalExpenses;

  const weeklyData  = buildWeeklyData(transactions, year, month);
  const dailyData   = buildDailyProfit(transactions, year, month);
  const catData     = buildCategoryData(transactions);
  const hasData     = transactions.length > 0;
  const hasExpenses = catData.length > 0;
  const period      = fmtMonth(year, month);

  /* PDF download — programmatic jsPDF (no html2canvas needed) */
  async function handleDownloadPDF() {
    setDownloading(true);
    try {
      // Dynamic import keeps jsPDF out of the initial bundle.
      const { jsPDF } = await import("jspdf");

      const pdf      = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW    = pdf.internal.pageSize.getWidth();
      const pageH    = pdf.internal.pageSize.getHeight();
      const margin   = 14;
      const right    = pageW - margin;
      const contentW = pageW - margin * 2;
      let y          = 0;

      // ── Branded header ───────────────────────────────────────────
      pdf.setFillColor(37, 99, 235);
      pdf.rect(0, 0, pageW, 22, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("Kape — Monthly Financial Report", margin, 14);

      // Subtitle bar
      pdf.setFillColor(249, 250, 251);
      pdf.rect(0, 22, pageW, 14, "F");
      pdf.setTextColor(75, 85, 99);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(period, margin, 31);
      pdf.text(`Generated: ${now.toLocaleDateString("en-PH")}`, right, 31, { align: "right" });

      y = 46;

      // ── Section: Summary ─────────────────────────────────────────
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(107, 114, 128);
      pdf.text("SUMMARY", margin, y);
      y += 4;
      pdf.setDrawColor(229, 231, 235);
      pdf.setLineWidth(0.3);
      pdf.line(margin, y, right, y);
      y += 7;

      const summaryRows: [string, number, [number, number, number]][] = [
        ["Total Revenue",  totalRevenue,  [22, 163, 74]],
        ["Total Expenses", totalExpenses, [220, 38, 38]],
        ["Net Profit",     netProfit,     [37, 99, 235]],
      ];

      summaryRows.forEach(([label, amount, [r, g, b]]) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.setTextColor(55, 65, 81);
        pdf.text(label, margin, y);

        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(r, g, b);
        pdf.text(`PHP ${amount.toLocaleString("en-PH")}`, right, y, { align: "right" });
        y += 10;
      });

      y += 2;
      pdf.setDrawColor(229, 231, 235);
      pdf.setLineWidth(0.3);
      pdf.line(margin, y, right, y);
      y += 10;

      // ── Section: Expense breakdown ───────────────────────────────
      if (catData.length > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(107, 114, 128);
        pdf.text("EXPENSE BREAKDOWN BY CATEGORY", margin, y);
        y += 4;
        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.3);
        pdf.line(margin, y, right, y);
        y += 7;

        catData.forEach((cat, idx) => {
          // Zebra row
          if (idx % 2 === 0) {
            pdf.setFillColor(249, 250, 251);
            pdf.rect(margin, y - 4, contentW, 10, "F");
          }

          const [r, g, b] = CATEGORY_RGB[cat.name] ?? [107, 114, 128];

          // Colour dot
          pdf.setFillColor(r, g, b);
          pdf.circle(margin + 3, y + 1, 1.5, "F");

          // Name
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(10);
          pdf.setTextColor(55, 65, 81);
          pdf.text(cat.name, margin + 9, y + 2);

          // Amount
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(r, g, b);
          pdf.text(
            `PHP ${cat.value.toLocaleString("en-PH")}`,
            right - 18, y + 2,
            { align: "right" }
          );

          // Percentage
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(156, 163, 175);
          pdf.text(`${cat.pct.toFixed(1)}%`, right, y + 2, { align: "right" });

          // Mini progress bar
          const barMaxW = 40;
          const barW    = Math.max((barMaxW * cat.pct) / 100, 1);
          pdf.setFillColor(229, 231, 235);
          pdf.rect(margin + 60, y, barMaxW, 2, "F");
          pdf.setFillColor(r, g, b);
          pdf.rect(margin + 60, y, barW, 2, "F");

          y += 10;
        });

        y += 4;
      }

      // ── Footer ───────────────────────────────────────────────────
      const footerY = pageH - 10;
      pdf.setDrawColor(229, 231, 235);
      pdf.setLineWidth(0.3);
      pdf.line(margin, footerY - 4, right, footerY - 4);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(156, 163, 175);
      pdf.text("Generated by Kape Accounting", margin, footerY);
      pdf.text(period, right, footerY, { align: "right" });

      pdf.save(`kape-report-${year}-${String(month).padStart(2, "0")}.pdf`);

    } catch (err) {
      console.error("PDF error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Hindi ma-generate ang PDF: ${msg}`);
    } finally {
      setDownloading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const xInterval = Math.max(0, Math.floor(dailyData.length / 6) - 1);

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
        {/* Title + month selector */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports 📊</h1>
            <p className="text-sm text-gray-500 mt-0.5">Financial overview by month</p>
          </div>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-2xl px-3 py-2 shrink-0">
            <button
              onClick={prevMonth}
              className="text-gray-400 hover:text-gray-700 text-lg font-medium w-6 text-center transition-colors"
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-gray-800 px-1 min-w-[110px] text-center">
              {period}
            </span>
            <button
              onClick={nextMonth}
              disabled={isCurrentMonth}
              className="text-gray-400 hover:text-gray-700 text-lg font-medium w-6 text-center transition-colors disabled:opacity-25"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); }}
              className="text-xs font-medium text-red-600 underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Capturable report content ── */}
        <div ref={reportRef} className="space-y-6">

          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {loading ? (
              <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
            ) : (
              <>
                <ReportSummaryCard label="Total Revenue"  amount={totalRevenue}  icon="💰" color="green" period={period} />
                <ReportSummaryCard label="Total Expenses" amount={totalExpenses} icon="🧾" color="red"   period={period} />
                <ReportSummaryCard label="Net Profit"     amount={netProfit}     icon="📈" color="blue"  period={period} highlight />
              </>
            )}
          </div>

          {/* Charts + breakdown */}
          {!loading && !error && (
            !hasData ? (
              <EmptyState month={period} />
            ) : (
              <>
                {/* Bar chart: Weekly Revenue vs Expenses */}
                <ChartCard title="Weekly Revenue vs Expenses">
                  {mounted ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={shortPeso} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                        <Bar dataKey="Revenue"  fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <Bar dataKey="Expenses" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[260px] animate-pulse bg-gray-100 rounded-xl" />
                  )}
                </ChartCard>

                {/* Line chart: Daily net profit */}
                <ChartCard title="Daily Net Profit">
                  {mounted ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={dailyData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="day" interval={xInterval} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={shortPeso} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="Profit"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: "#2563eb" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[220px] animate-pulse bg-gray-100 rounded-xl" />
                  )}
                </ChartCard>

                {/* Expense breakdown */}
                {hasExpenses && (
                  <ChartCard title="Expense Breakdown by Category">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      {/* Pie chart */}
                      {mounted ? (
                        <div className="w-full sm:w-[200px] shrink-0">
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={catData}
                                cx="50%"
                                cy="50%"
                                innerRadius={54}
                                outerRadius={88}
                                paddingAngle={2}
                                dataKey="value"
                                strokeWidth={0}
                              >
                                {catData.map((entry, i) => (
                                  <Cell key={i} fill={CATEGORY_COLORS[entry.name] ?? "#6b7280"} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(v) => peso(Number(v ?? 0))}
                                contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}
                                itemStyle={{ color: "#374151" }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="w-[200px] h-[200px] rounded-full animate-pulse bg-gray-100" />
                      )}

                      {/* Category list */}
                      <div className="flex-1 w-full space-y-3">
                        {catData.map(cat => (
                          <div key={cat.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: CATEGORY_COLORS[cat.name] ?? "#6b7280" }}
                              />
                              <span className="text-sm text-gray-700">{cat.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${cat.pct}%`,
                                    backgroundColor: CATEGORY_COLORS[cat.name] ?? "#6b7280",
                                  }}
                                />
                              </div>
                              <span className="text-sm font-semibold text-gray-800 w-20 text-right tabular-nums">
                                {peso(cat.value)}
                              </span>
                              <span className="text-xs text-gray-400 w-10 text-right tabular-nums">
                                {cat.pct.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ChartCard>
                )}
              </>
            )
          )}
        </div>

        {/* Download PDF — outside the ref so it's not captured */}
        {!loading && !error && hasData && (
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-60 text-white rounded-2xl py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {downloading ? <><Spinner /> Generating PDF…</> : <>📄 Download PDF</>}
          </button>
        )}
      </main>
    </div>
  );
}
