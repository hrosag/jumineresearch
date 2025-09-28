"use client";
import { useEffect, useState } from "react";
import { GlossaryRow, GlossaryNode, SidebarProps } from "../types";

export default function Sidebar({
  tree,
  selectedTerm,
  setSelectedTerm,
  selectedLang,
  onAddTerm,
}: SidebarProps) {
  function TreeNode({
    node,
    activeTerm,
    level = 0,
  }: {
    node: GlossaryNode;
    activeTerm: GlossaryRow | null;
    level?: number;
  }) {
    const [collapsed, setCollapsed] = useState(true);
    const isSelected = activeTerm?.id === node.id;

    // 🔑 Mantém caminho expandido até o termo selecionado
    useEffect(() => {
      if (!activeTerm) return;
      const expandPath = (n: GlossaryNode): boolean =>
        n.id === activeTerm.id || n.children.some(expandPath);

      if (expandPath(node)) setCollapsed(false);
    }, [activeTerm, node]);

    const fontSize =
      level === 0
        ? "text-lg font-semibold" // ~18px
        : level === 1
        ? "text-base font-medium" // ~16px
        : level === 2
        ? "text-sm" // ~14px
        : "text-xs text-gray-300"; // ~12px

    return (
      <div className="ml-1">
        <button
          onClick={() => {
            if (node.children.length > 0) {
              setCollapsed(!collapsed);
              setSelectedTerm(node);
            } else {
              setSelectedTerm(node);
            }
          }}
          className={`block w-full text-left px-2 py-1 rounded ${fontSize} ${
            isSelected ? "bg-[#d4af37] text-black" : "hover:bg-[#2e3b4a]"
          }`}
        >
          {node[selectedLang] || node.term}
        </button>

        {!collapsed && node.children.length > 0 && (
          <div className="ml-2 border-l border-gray-600 pl-1">
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                activeTerm={activeTerm}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="flex w-64 min-w-[220px] max-w-[400px] resize-x flex-col overflow-hidden rounded-md border border-gray-700 bg-[#1e2a38] text-white shadow-sm">
      <div className="flex items-center justify-between px-3 pt-4 pb-2">
        <h3 className="text-lg font-bold text-[#d4af37]">JRpedia</h3>
        <button
          type="button"
          onClick={onAddTerm}
          className="flex h-7 w-7 items-center justify-center rounded bg-[#d4af37] font-bold text-black hover:bg-[#f0c75e]"
          aria-label="Adicionar novo termo"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-hidden pb-3">
        <div className="h-full border-r border-gray-600 bg-[#1c2833] pt-2">
          <div className="h-full space-y-1 overflow-y-auto pr-1 text-sm scrollbar-hide">
            {tree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                activeTerm={selectedTerm}
                level={0}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
