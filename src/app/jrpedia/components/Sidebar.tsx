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

    // 🔑 Mantém o caminho expandido se o termo selecionado estiver neste branch
    useEffect(() => {
      if (!activeTerm) return;

      const expandPath = (n: GlossaryNode): boolean => {
        if (n.id === activeTerm.id) return true;
        return n.children.some(expandPath);
      };

      if (expandPath(node)) setCollapsed(false);
    }, [activeTerm, node]);

    const fontSize =
      level === 0 ? "text-base font-bold" : level === 1 ? "text-sm" : "text-xs text-gray-300";

    return (
      <div className="ml-2">
        <button
          onClick={() => {
            if (node.children.length > 0) {
              setCollapsed(!collapsed);
              setSelectedTerm(node); // 🔧 garante seleção mesmo em nós com filhos
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
          <div className="ml-4 border-l border-gray-600 pl-2">
            {node.children.map((child) => (
              <TreeNode key={child.id} node={child} activeTerm={activeTerm} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside
      className="ml-1 w-64 min-w-[220px] max-w-[400px] resize-x overflow-y-auto rounded-md border border-gray-700 bg-[#1e2a38] p-3 text-white shadow-sm scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#d4af37]">JRpedia</h3>
        <button
          type="button"
          onClick={onAddTerm}
          className="flex h-7 w-7 items-center justify-center rounded bg-[#d4af37] text-black font-bold hover:bg-[#f0c75e]"
          aria-label="Adicionar novo termo"
        >
          +
        </button>
      </div>
      {tree.map((node) => (
        <TreeNode key={node.id} node={node} activeTerm={selectedTerm} level={0} />
      ))}
    </aside>
  );
}
