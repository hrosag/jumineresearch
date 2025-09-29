"use client";

import { useState } from "react";
import { reportTree, ReportNode } from "../dataTree";

type SidebarProps = {
  selectedReport: string | null;
  setSelectedReport: (report: string) => void;
};

// Nó recursivo da árvore, inspirado no JRpedia
// Controla seleção e expand/collapse
function Node({
  node,
  selectedReport,
  setSelectedReport,
}: {
  node: ReportNode;
  selectedReport: string | null;
  setSelectedReport: (report: string) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const [isOpen, setIsOpen] = useState(hasChildren ? node.defaultExpanded ?? false : false);
  const isSelected = selectedReport === node.id;

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen((prev) => !prev);
    } else {
      setSelectedReport(node.id);
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left transition-colors ${
          isSelected ? "bg-[#d4af37] text-black" : "hover:bg-[#2e3b4a] text-white"
        } ${hasChildren ? "font-semibold" : ""}`}
      >
        {hasChildren && <span className="text-xs">{isOpen ? "▾" : "▸"}</span>}
        <span>{node.label}</span>
      </button>
      {hasChildren && isOpen && (
        <ul className="ml-4 space-y-1 border-l border-gray-700 pl-2">
          {node.children!.map((child) => (
            <Node
              key={child.id}
              node={child}
              selectedReport={selectedReport}
              setSelectedReport={setSelectedReport}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function Sidebar({ selectedReport, setSelectedReport }: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-4 px-3 text-lg font-bold">Data Mining</h2>
      <ul className="flex-1 space-y-2 px-2">
        {reportTree.map((node) => (
          <Node
            key={node.id}
            node={node}
            selectedReport={selectedReport}
            setSelectedReport={setSelectedReport}
          />
        ))}
      </ul>
    </div>
  );
}
