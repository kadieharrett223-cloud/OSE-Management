"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CommandGroup = {
  title: string;
  items: CommandItem[];
};

type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  keywords?: string[];
  action: () => Promise<void> | void;
};

export function CommandBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modKey = isMac ? event.metaKey : event.ctrlKey;
      if (modKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setStatus(null);
      }
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
        setStatus(null);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const groups: CommandGroup[] = useMemo(() => [
    {
      title: "Jump to",
      items: [
        {
          id: "jump-invoices",
          label: "Invoice",
          hint: "Open invoice view",
          keywords: ["invoice", "invoices", "billing"],
          action: () => router.push("/commissions"),
        },
        {
          id: "jump-customers",
          label: "Customer",
          hint: "Open customers",
          keywords: ["customer", "customers", "wholesalers"],
          action: () => router.push("/admin/wholesalers"),
        },
        {
          id: "jump-reps",
          label: "Rep",
          hint: "Open reps/commissions",
          keywords: ["rep", "reps", "commissions"],
          action: () => router.push("/commissions"),
        },
        {
          id: "jump-vendors",
          label: "Vendor",
          hint: "Open vendors",
          keywords: ["vendor", "vendors", "suppliers"],
          action: () => router.push("/admin/suppliers"),
        },
      ],
    },
    {
      title: "Quick actions",
      items: [
        {
          id: "create-invoice",
          label: "Create invoice",
          hint: "Open invoice workflow",
          keywords: ["create", "invoice", "new"],
          action: () => router.push("/commissions?create=1"),
        },
        {
          id: "sync-qb",
          label: "Sync QB",
          hint: "Run QuickBooks sync",
          keywords: ["sync", "qbo", "quickbooks"],
          action: async () => {
            setStatus("Syncing QuickBooks...");
            try {
              const res = await fetch("/api/sync/qbo", { method: "POST" });
              if (!res.ok) throw new Error("Sync failed");
              setStatus("QuickBooks sync started.");
            } catch (error) {
              setStatus("QuickBooks sync failed.");
            }
          },
        },
        {
          id: "add-po",
          label: "Add purchase order",
          hint: "Create a new PO",
          keywords: ["purchase", "order", "po", "add"],
          action: () => router.push("/admin/purchasing?new=1"),
        },
      ],
    },
  ], [router]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const haystack = [item.label, item.hint, ...(item.keywords || [])]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-20">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="border-b border-slate-200 px-6 py-4">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands..."
            className="w-full text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-500">Press Esc to close</p>
        </div>

        {status && (
          <div className="px-6 py-2 text-xs text-slate-600 border-b border-slate-200">
            {status}
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto">
          {filteredGroups.map((group) => (
            <div key={group.title} className="px-6 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {group.title}
              </p>
              <div className="mt-2 space-y-1">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={async () => {
                      await item.action();
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-100"
                  >
                    <span>{item.label}</span>
                    {item.hint && <span className="text-xs text-slate-500">{item.hint}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {filteredGroups.length === 0 && (
            <div className="px-6 py-6 text-sm text-slate-500">No results</div>
          )}
        </div>
      </div>
    </div>
  );
}
