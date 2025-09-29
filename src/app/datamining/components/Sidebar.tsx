"use client";

import { useState } from "react";
import { reportTree, ReportNode } from "../dataTree";

type SidebarProps = {
  selectedReport: string | null;
  setSelectedReport: (report: string) => void;
};

function Node({
  node,
  selectedReport,
  setSelectedReport,
}: {
  node: ReportNode;
  selectedReport: string | null;
  setSelectedReport: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const hasChildren = node.children && node.children.length > 0;

  return (
    <li>
      <div
        className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer ${
          selectedReport === node.id
            ? "bg-[#d4af37] text-black"
            : "hover:bg-[#2e3b4a] text-white"
        }`}
        onClick={() => {
          if (!hasChildren) setSelectedReport(node.id);
          else setExpanded(!expanded);
        }}
      >
        <span>{node.name}</span>
        {hasChildren && <span>{expanded ? "▾" : "▸"}</span>}
      </div>
      {hasChildren && expanded && (
        <ul className="ml-4 space-y-1">
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
