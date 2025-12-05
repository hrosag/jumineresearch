"use client";

import { useEffect, useMemo, useState } from "react";
import { dataMartTree } from "../dataMartTree";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";

type SidebarProps = {
  selectedReport: string;
  setSelectedReport: (id: string) => void;
};

export default function DataMartSidebar({
  selectedReport,
  setSelectedReport,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  function IconFor({ id }: { id: string }) {
    const cls = "h-5 w-5 shrink-0";
    switch (id) {
      case "capital-pool":
        return <Squares2X2Icon className={cls} />;
      default:
        return <span className="inline-block h-5 w-5" />;
    }
  }

  useEffect(() => {
    try {
      const c = localStorage.getItem("dmart:sidebar:collapsed");
      const o = localStorage.getItem("dmart:sidebar:open");
      if (c) setCollapsed(c === "1");
      if (o) setOpen(JSON.parse(o));
    } catch {}
  }, []);

  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      for (const node of dataMartTree) {
        if (next[node.id] === undefined) next[node.id] = !!node.defaultExpanded;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("dmart:sidebar:collapsed", collapsed ? "1" : "0");
      localStorage.setItem("dmart:sidebar:open", JSON.stringify(open));
    } catch {}
  }, [collapsed, open]);

  const rootClasses = useMemo(
    () =>
      "flex h-full flex-col text-white transition-all duration-200 " +
      (collapsed ? "w-14" : "w-64"),
    [collapsed],
  );

  return (
    <div className={rootClasses}>
      <div className="flex items-center justify-between border-b border-slate-700 bg-[#18212c] px-2 py-2">
        <span className={`text-sm font-semibold ${collapsed ? "sr-only" : ""}`}>
          Data Mart
        </span>
        <button
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((value) => !value)}
          className="rounded p-1 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-500/40"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="text-base leading-none">
            {collapsed ? "›" : "‹"}
          </span>
        </button>
      </div>

      <nav className="flex-1 space-y-2 overflow-auto bg-[#1e2a38] px-2 py-2">
        {dataMartTree.map((group) => {
          const isOpen = !!open[group.id];
          return (
            <div key={group.id} className="text-sm">
              <button
                onClick={() =>
                  setOpen((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                }
                className={
                  "flex h-9 w-full items-center rounded hover:bg-slate-800 " +
                  (collapsed ? "justify-center px-0" : "gap-2 px-2")
                }
                aria-expanded={isOpen}
                title={group.label}
              >
                <span className={`w-4 ${collapsed ? "hidden" : ""}`}>
                  {isOpen ? (
                    <ChevronDownIcon className="h-4 w-4" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4" />
                  )}
                </span>
                <IconFor id={group.id} />
                <span className={"truncate " + (collapsed ? "sr-only" : "")}>
                  {group.label}
                </span>
              </button>

              {isOpen && group.children && group.children.length > 0 ? (
                <ul
                  className={
                    "mt-1 space-y-1 " + (collapsed ? "text-center" : "pl-6")
                  }
                >
                  {group.children.map((child) => {
                    const isSelected = selectedReport === child.id;
                    return (
                      <li key={child.id}>
                        <button
                          onClick={() => setSelectedReport(child.id)}
                          className={
                            "flex h-8 w-full items-center rounded text-xs " +
                            (collapsed
                              ? "justify-center px-0"
                              : "justify-start px-2") +
                            " " +
                            (isSelected
                              ? "bg-yellow-500 text-black"
                              : "text-slate-200 hover:bg-slate-800")
                          }
                        >
                          <span
                            className={
                              collapsed ? "sr-only" : "truncate"
                            }
                          >
                            {child.label}
                          </span>
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
