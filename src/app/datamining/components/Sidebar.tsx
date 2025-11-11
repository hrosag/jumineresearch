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

function IconFor({ id, className = "h-5 w-5 shrink-0" }: { id: string; className?: string }) {
  switch (id) {
    case "bulletins":
      return <NewspaperIcon className={className} />;
    case "lifecycle":
      return <ArrowsRightLeftIcon className={className} />;
    case "notices":
      return <BellAlertIcon className={className} />;
    case "canonical-map":
      return <MapIcon className={className} />;
    case "new-listings":
      return <SparklesIcon className={className} />;
    case "cpc":
      return <DocumentTextIcon className={className} />;
    default:
      return <span className={`inline-block ${className}`} />;
  }
}

export default function Sidebar({ selectedReport, setSelectedReport }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // estado persistente
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
      for (const n of reportTree) {
        if (next[n.id] === undefined) next[n.id] = !!n.defaultExpanded;
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
    [collapsed],
  );

  return (
    <div className={rootClasses}>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-slate-700 bg-[#18212c]">
        <span className={`text-sm font-semibold truncate ${collapsed ? "sr-only" : ""}`}>
          Data Mining
        </span>
        <button
          title={collapsed ? "Expandir" : "Recolher"}
          onClick={() => setCollapsed((v) => !v)}
          className="p-1 rounded hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-500/40"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="text-base leading-none">{collapsed ? "›" : "‹"}</span>
        </button>
      </div>

      {/* Conteúdo */}
      <nav className="px-2 py-2 bg-[#1e2a38] flex-1 overflow-auto space-y-2">
        {reportTree.map((group) => {
          const isOpen = !!open[group.id];

          return (
            <div key={group.id} className="text-sm">
              {/* Botão do grupo */}
              <button
                onClick={() => setOpen((o) => ({ ...o, [group.id]: !o[group.id] }))}
                className="w-full h-9 flex items-center gap-2 px-2 rounded hover:bg-slate-800"
                aria-expanded={isOpen}
                title={group.label}
              >
                {/* Esconde chevron no modo colapsado para não “poluir” */}
                <span className={`w-4 ${collapsed ? "invisible" : ""}`}>
                  {isOpen ? (
                    <ChevronDownIcon className="h-4 w-4" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4" />
                  )}
                </span>
                <IconFor id={group.id} />
                <span className={"truncate " + (collapsed ? "sr-only" : "")}>{group.label}</span>
              </button>

              {/* Itens */}
              {isOpen ? (
                <ul
                  className={
                    "mt-1 " + (collapsed ? "ml-0 border-l-0" : "ml-5 border-l border-slate-700")
                  }
                >
                  {group.children?.map((child) => {
                    const active = selectedReport === child.id;
                    return (
                      <li key={child.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedReport(child.id)}
                          title={child.label}
                          className={
                            "w-full h-9 flex items-center gap-2 text-left px-2 rounded-l-md hover:bg-slate-800 " +
                            (active ? "bg-yellow-600 text-black" : "text-slate-200")
                          }
                        >
                          {/* No colapso, sem indent e sem “linha” lateral */}
                          <span className={`w-4 ${collapsed ? "hidden" : ""}`} />
                          <IconFor id={child.id} />
                          <span className={collapsed ? "sr-only" : "truncate"}>{child.label}</span>
                        </button>

                        {/* Indicador do ativo quando colapsado: pill atrás do ícone */}
                        {collapsed && active ? (
                          <div className="relative -mt-9 h-9">
                            <div className="absolute inset-y-0 left-1 right-1 rounded bg-yellow-600/25 pointer-events-none" />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {/* Divisor visual limpo no colapso */}
              <div className="mt-2">
                <div className={collapsed ? "mx-2 h-px bg-slate-700/50" : "mx-5 h-px bg-slate-700/50"} />
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
