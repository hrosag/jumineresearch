"use client";

import { reportTree, type ReportNode } from "../dataTree";

type SidebarProps = {
  selectedReport: string | null;
  setSelectedReport: (report: string) => void;
};

type NodeProps = {
  node: ReportNode;
  selectedReport: string | null;
  setSelectedReport: (id: string) => void;
};

function TreeNode({ node, selectedReport, setSelectedReport }: NodeProps) {
  const hasChildren = !!(node.children && node.children.length > 0);
  const isSelected = selectedReport === node.id;

  const handleClick = () => {
    if (!hasChildren) {
      setSelectedReport(node.id);
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className={`w-full rounded px-2 py-1 text-left transition-colors ${
          isSelected ? "bg-[#d4af37] text-black" : "text-white hover:bg-[#2e3b4a]"
        }`}
      >
        {node.label}
      </button>
      {hasChildren && (
        <ul className="ml-4 space-y-1 border-l border-gray-700 pl-2">
          {node.children!.map((child) => (
            <TreeNode
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
      <div className="flex-1 overflow-y-auto px-2">
        <ul className="space-y-1">
          {reportTree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              selectedReport={selectedReport}
              setSelectedReport={setSelectedReport}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
