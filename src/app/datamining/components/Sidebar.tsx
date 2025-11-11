"use client";

import { useEffect, useMemo, useState } from "react";
import { reportTree } from "../dataTree";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  NewspaperIcon,
  ArrowsRightLeftIcon,
  BellAlertIcon,
  MapIcon,
  SparklesIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

type SidebarProps = {
  selectedReport: string;
  setSelectedReport: (id: string) => void;
};

export default function Sidebar({ selectedReport, setSelectedReport }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  function IconFor({ id }: { id: string }) {
    const cls = "h-5 w-5 shrink-0";
    switch (id) {
      case "bulletins":
        return <NewspaperIcon className={cls} />;
      case "lifecycle":
        return <ArrowsRightLeftIcon className={cls} />;
      case "notices":
        return <BellAlertIcon className={cls} />;
      case "canonical-map":
        return <MapIcon className={cls} />;
      case "new-listings":
        return <SparklesIcon className={cls} />;
      case "cpc":
        return <DocumentTextIcon className={cls} />;
      default:
        return <span className="inline-block h-5 w-5" />;
    }
  }

  // persistência
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
        if (next[node.id] === undefined) next[node.id] = !!node.defaultExpanded;
      }
      return next;
    });
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("dm:sidebar:collapsed", collapsed ? "1" : "0");
      localStorage.setItem("dm:sidebar:open", JSON.stringify(open));
    } catch {}
  }, [collapsed, open]);

  const rootClasses = useMemo(
    () =>
      "flex h-full flex-col text-white transition-all duration-200 " +
      (collapsed ? "w-14" : "w-64"),
    [collapsed]
  );

  return (
    <div className={rootClasses}>
      {/* header */}
      <div className="flex items-center justify-between border-b border-slate-700 bg-[#18212c] px-2 py-2">
        <span className={`text-sm font-semibold ${collapsed ? "sr-only" : ""}`}>Data Mining</span>
        <button
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((value) => !value)}
          className="rounded p-1 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-500/40"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="text-base leading-none">{collapsed ? "›" : "‹"}</span>
        </button>
      </div>

      {/* conteúdo */}
      <nav className="flex-1 overflow-auto bg-[#1e2a38] px-2 py-2 space-y-2">
        {reportTree.map((group) => {
          const isOpen = !!open[group.id];
          return (
            <div key={group.id} className="text-sm">
              {/* botão do grupo */}
              <button
                onClick={() => setOpen((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                className={
                  "flex w-full h-9 items-center rounded hover:bg-slate-800 " +
                  (collapsed ? "justify-center px-0" : "gap-2 px-2")
                }
                aria-expanded={isOpen}
                title={group.label}
              >
                <span className={`w-4 ${collapsed ? "hidden" : ""}`}>
                  {isOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                </span>
                <IconFor id={group.id} />
                <span className={"truncate " + (collapsed ? "sr-only" : "")}>{group.label}</span>
              </button>

              {/* itens */}
              {isOpen && group.children?.length ? (
                <ul className={"mt-1 " + (collapsed ? "ml-0 border-l-0" : "ml-5 border-l border-slate-700")}>
                  {group.children.map((child) => {
                    const active = selectedReport === child.id;
                    return (
                      <li key={child.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedReport(child.id)}
                          title={child.label}
                          className={
                            "flex w-full h-9 items-center text-left rounded-l-md hover:bg-slate-800 " +
                            (collapsed ? "justify-center px-0" : "gap-2 px-2") + " " +
                            (active && !collapsed ? "bg-yellow-600 text-black" : "text-slate-200")
                          }
                        >
                          <span className={`w-4 ${collapsed ? "hidden" : ""}`} />
                          <span className={collapsed ? (active ? "rounded bg-yellow-600 p-1.5 text-black" : "p-1.5") : ""}>
                            <IconFor id={child.id} />
                          </span>
                          <span className={collapsed ? "sr-only" : "truncate"}>{child.label}</span>
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
