export default function DashboardPage() {
  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const sales = 8450;
  const expenses = 3120;
  const profit = sales - expenses;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">☕</span>
            <span className="text-xl font-bold text-gray-900 tracking-tight">Kape</span>
          </div>
          <span className="text-sm text-gray-500">{today}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Magandang araw, Maria! 👋</h1>
          <p className="text-gray-500 mt-1 text-sm">Here's your shop's financial summary for today.</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Total Sales"
            amount={sales}
            icon="💰"
            color="green"
            description="Revenue earned today"
          />
          <SummaryCard
            label="Total Expenses"
            amount={expenses}
            icon="🧾"
            color="red"
            description="Costs incurred today"
          />
          <SummaryCard
            label="Net Profit"
            amount={profit}
            icon="📈"
            color="blue"
            description="Sales minus expenses"
            highlight
          />
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickActionButton icon="➕" label="Add Sale" />
            <QuickActionButton icon="📝" label="Add Expense" />
            <QuickActionButton icon="📊" label="View Reports" />
            <QuickActionButton icon="📋" label="Transaction History" />
          </div>
        </div>

        {/* Recent Transactions placeholder */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Recent Transactions
          </h2>
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            <TransactionRow
              label="Barako Blend — 3 cups"
              time="2:34 PM"
              amount={+270}
              type="sale"
            />
            <TransactionRow
              label="Coffee beans restock"
              time="11:20 AM"
              amount={-1500}
              type="expense"
            />
            <TransactionRow
              label="Iced Latte — 5 cups"
              time="10:05 AM"
              amount={+450}
              type="sale"
            />
            <TransactionRow
              label="Milk delivery"
              time="8:00 AM"
              amount={-620}
              type="expense"
            />
          </div>
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

      {/* Spacer so content isn't hidden behind nav */}
      <div className="h-20" />
    </div>
  );
}

/* ── Sub-components ── */

function SummaryCard({
  label,
  amount,
  icon,
  color,
  description,
  highlight = false,
}: {
  label: string;
  amount: number;
  icon: string;
  color: "green" | "red" | "blue";
  description: string;
  highlight?: boolean;
}) {
  const colorMap = {
    green: {
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-700",
      badge: "bg-green-100 text-green-700",
    },
    red: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      badge: "bg-red-100 text-red-700",
    },
    blue: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      badge: "bg-blue-100 text-blue-700",
    },
  };

  const c = colorMap[color];

  return (
    <div
      className={`rounded-2xl border p-4 ${c.bg} ${c.border} ${
        highlight ? "sm:col-span-1 ring-2 ring-blue-300" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.badge}`}>
          Today
        </span>
      </div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${c.text}`}>
        ₱{amount.toLocaleString("en-PH")}
      </p>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
    </div>
  );
}

function QuickActionButton({ icon, label }: { icon: string; label: string }) {
  return (
    <button className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left w-full">
      <span className="text-lg">{icon}</span>
      {label}
    </button>
  );
}

function TransactionRow({
  label,
  time,
  amount,
  type,
}: {
  label: string;
  time: string;
  amount: number;
  type: "sale" | "expense";
}) {
  const isPositive = amount > 0;
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-lg">{isPositive ? "☕" : "🧾"}</span>
        <div>
          <p className="text-sm font-medium text-gray-800">{label}</p>
          <p className="text-xs text-gray-400">{time}</p>
        </div>
      </div>
      <span
        className={`text-sm font-semibold ${
          isPositive ? "text-green-600" : "text-red-500"
        }`}
      >
        {isPositive ? "+" : ""}₱{Math.abs(amount).toLocaleString("en-PH")}
      </span>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active = false,
}: {
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs font-medium transition-colors ${
        active ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
      }`}
    >
      <span className="text-xl">{icon}</span>
      {label}
    </button>
  );
}
