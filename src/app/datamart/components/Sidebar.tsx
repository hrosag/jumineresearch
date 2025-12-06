"use client";

import { useState } from "react";

type SidebarProps = {
  selectedReport: string;
  setSelectedReport: (id: string) => void;
};

export default function DataMartSidebar({
  selectedReport,
  setSelectedReport,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={
        "flex h-full flex-col text-white transition-all duration-200 " +
        (collapsed ? "w-14" : "w-64")
      }
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-slate-700 bg-[#18212c] px-2 py-2">
        <span className={`text-sm font-semibold ${collapsed ? "sr-only" : ""}`}>
          Data Mart
        </span>

        <button
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed(!collapsed)}
          className="rounded p-1 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-500/40"
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {/* Único item: Capital Pool Company */}
      <nav className="flex-1 space-y-2 overflow-auto bg-[#1e2a38] px-2 py-2">
        <button
          onClick={() => setSelectedReport("cpc-universe")}
          className={
            "w-full rounded px-2 py-2 text-left text-sm transition " +
            (selectedReport === "cpc-universe"
              ? "bg-yellow-500 text-black"
              : "text-slate-200 hover:bg-slate-800")
          }
          title="Capital Pool Company"
        >
          {/* Texto resumido quando colapsado */}
          {collapsed ? "CPC" : "Capital Pool Company"}
        </button>
      </nav>
    </div>
  );
}
