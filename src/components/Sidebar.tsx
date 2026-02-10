"use client";

const navGroups = [
  {
    title: "Operations",
    items: [
      { label: "Dashboard", hint: "Company overview", href: "/" },
      { label: "Calendar", hint: "Sales & notifications", href: "/calendar" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Commissions", hint: "QBO sync & payouts", href: "/commissions" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Price List", hint: "SKU shipping + sale", href: "/admin/price-list" },
      { label: "Purchasing", hint: "POs and payments", href: "/admin/purchasing" },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Settings", hint: "QBO & Shopify config", href: "/settings" },
    ],
  },
];

export function Sidebar({ activePage }: { activePage: string }) {
  return (
    <aside
      className="relative flex w-72 flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-blue-900 to-blue-700 px-4 py-6 shadow-2xl ring-1 ring-slate-900/30"
    >
      <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 opacity-35">
        <div className="absolute bottom-8 left-6 h-32 w-32 rounded-3xl border border-white/40 bg-white/5" />
        <div className="absolute bottom-16 left-20 h-24 w-24 rotate-12 rounded-2xl border border-blue-200/50 bg-white/5" />
        <div className="absolute bottom-6 left-28 h-16 w-16 rotate-45 border border-blue-200/50 bg-white/5" />
        <div className="absolute bottom-2 left-10 h-10 w-10 rotate-[25deg] border border-white/40 bg-white/5" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-sm font-semibold text-blue-100 ring-1 ring-blue-300/30">
            OSE
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-blue-200">Management</p>
            <p className="text-lg font-semibold text-white">Performance Hub</p>
          </div>
        </div>
      </div>

      <nav className="mt-6 space-y-4">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <p className="px-2 text-[10px] uppercase tracking-[0.3em] text-blue-200/80">
              {group.title}
            </p>
            {group.items.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`block w-full rounded-xl border px-3 py-3 text-left text-sm transition ${
                  item.label === activePage
                    ? "border-blue-400/50 bg-blue-900/40 text-white hover:-translate-y-[1px]"
                    : "border-slate-800/70 bg-slate-900/40 text-slate-100 hover:-translate-y-[1px] hover:border-blue-400/50 hover:bg-blue-900/40 hover:text-white"
                }`}
                title={item.label}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-[10px] uppercase tracking-wide text-blue-200">view</span>
                </div>
                <p className="text-xs text-slate-300">{item.hint}</p>
              </a>
            ))}
          </div>
        ))}
      </nav>

      <div className="flex-1" />
    </aside>
  );
}
