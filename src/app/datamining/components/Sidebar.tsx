"use client";

import { useEffect, useMemo, useState } from "react";
import { reportTree } from "../dataTree";

type SidebarProps = {
  selectedReport: string;
  setSelectedReport: (id: string) => void;
};

export default function Sidebar({ selectedReport, setSelectedReport }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false); // retrátil
  const [open, setOpen] = useState<Record<string, boolean>>({}); // grupos abertos/fechados

  // carregar estado salvo
  useEffect(() => {
    try {
      const c = localStorage.getItem("dm:sidebar:collapsed");
      const o = localStorage.getItem("dm:sidebar:open");
      if (c) setCollapsed(c === "1");
      if (o) setOpen(JSON.parse(o));
    } catch {}
  }, []);

  // iniciar com defaultExpanded
  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      for (const n of reportTree) {
        if (next[n.id] === undefined) next[n.id] = !!n.defaultExpanded;
      }
      return next;
    });
  }, []);

  // persistir
  useEffect(() => {
    try { localStorage.setItem("dm:sidebar:collapsed", collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);
  useEffect(() => {
    try { localStorage.setItem("dm:sidebar:open", JSON.stringify(open)); } catch {}
  }, [open]);

  const rootClasses = useMemo(
    () =>
      "flex h-full flex-col " + (collapsed ? "w-12" : "w-64"),
    [collapsed]
  );

  return (
    <div className={rootClasses}>
      {/* header + botão colapsar */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-slate-700 bg-[#18212c] text-white">
        <span className={`text-sm font-semibold ${collapsed ? "sr-only" : ""}`}>Data Mining</span>
        <button
          title={collapsed ? "Expandir" : "Recolher"}
          onClick={() => setCollapsed((v) => !v)}
          className="p-1 rounded hover:bg-slate-800"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="text-xl leading-none">{collapsed ? "›" : "‹"}</span>
        </button>
      </div>

      {/* conteúdo */}
      <nav className="px-2 py-2 space-y-2 bg-[#1e2a38] flex-1 overflow-auto text-white">
        {reportTree.map((group) => {
          const isOpen = !!open[group.id];
          return (
            <div key={group.id} className="text-sm">
              <button
                onClick={() => setOpen((o) => ({ ...o, [group.id]: !o[group.id] }))}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800"
                aria-expanded={isOpen}
                title={group.label}
              >
                <span className="text-xs">{isOpen ? "▾" : "▸"}</span>
                <span className={collapsed ? "sr-only" : ""}>{group.label}</span>
              </button>

              {isOpen && !collapsed && group.children?.length ? (
                <ul className="mt-1 ml-5 border-l border-slate-700">
                  {group.children.map((child) => {
                    const active = selectedReport === child.id;
                    return (
                      <li key={child.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedReport(child.id)}
                          className={
                            "w-full text-left px-2 py-1.5 rounded-l-md hover:bg-slate-800 " +
                            (active ? "bg-yellow-600 text-black" : "text-slate-200")
                          }
                        >
                          {child.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
