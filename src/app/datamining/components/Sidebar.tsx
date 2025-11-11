"use client";

import { useEffect, useMemo, useState } from "react";
import { reportTree } from "../dataTree";

type SidebarProps = {
  selectedReport: string;
  setSelectedReport: (id: string) => void;
};

export default function Sidebar({ selectedReport, setSelectedReport }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const c = localStorage.getItem("dm:sidebar:collapsed");
      const o = localStorage.getItem("dm:sidebar:open");
      if (c) setCollapsed(c === "1");
      if (o) setOpen(JSON.parse(o));
    } catch {}
  }, []);

  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      for (const node of reportTree) {
        if (next[node.id] === undefined) {
          next[node.id] = !!node.defaultExpanded;
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("dm:sidebar:collapsed", collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem("dm:sidebar:open", JSON.stringify(open));
    } catch {}
  }, [open]);

  const rootClasses = useMemo(
    () => `flex h-full flex-col text-white ${collapsed ? "w-12" : "w-64"}`,
    [collapsed]
  );

  return (
    <div className={rootClasses}>
      <div className="flex items-center justify-between border-b border-slate-700 bg-[#18212c] px-2 py-2">
        <span className={`text-sm font-semibold ${collapsed ? "sr-only" : ""}`}>Data Mining</span>
        <button
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((value) => !value)}
          className="rounded p-1 hover:bg-slate-800"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="text-xl leading-none">{collapsed ? "›" : "‹"}</span>
        </button>
      </div>

      <nav className="flex-1 space-y-2 overflow-auto bg-[#1e2a38] px-2 py-2">
        {reportTree.map((group) => {
          const isOpen = !!open[group.id];
          return (
            <div key={group.id} className="text-sm">
              <button
                onClick={() => setOpen((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-800"
                aria-expanded={isOpen}
                title={group.label}
              >
                <span className="text-xs">{isOpen ? "▾" : "▸"}</span>
                <span className={collapsed ? "sr-only" : ""}>{group.label}</span>
              </button>

              {isOpen && !collapsed && group.children?.length ? (
                <ul className="ml-5 mt-1 border-l border-slate-700">
                  {group.children.map((child) => {
                    const active = selectedReport === child.id;
                    return (
                      <li key={child.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedReport(child.id)}
                          className={`w-full rounded-l-md px-2 py-1.5 text-left hover:bg-slate-800 ${
                            active ? "bg-yellow-600 text-black" : "text-slate-200"
                          }`}
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
