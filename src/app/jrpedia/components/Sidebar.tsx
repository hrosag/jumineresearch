"use client";
import { useEffect, useState } from "react";
import { GlossaryRow, GlossaryNode, Lang } from "../types";

type SidebarProps = {
  tree: GlossaryNode[];
  selectedTerm: GlossaryRow | null;
  setSelectedTerm: (t: GlossaryRow) => void;
  selectedLang: Lang;
};

export default function Sidebar({
  tree,
  selectedTerm,
  setSelectedTerm,
  selectedLang,
}: SidebarProps) {
  function TreeNode({
    node,
    activeTerm,
  }: {
    node: GlossaryNode
    activeTerm: GlossaryRow | null
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

    return (
      <div className="ml-2">
        <button
          onClick={() => {
            if (node.children.length > 0) {
              setCollapsed(!collapsed);
            } else {
              setSelectedTerm(node);
            }
          }}
          className={`block w-full text-left px-2 py-1 rounded ${
            isSelected
              ? "bg-[#d4af37] text-black font-bold"
              : "hover:bg-[#2e3b4a]"
          }`}
        >
          {node[selectedLang] || node.term}
        </button>

        {!collapsed && node.children.length > 0 && (
          <div className="ml-4 border-l border-gray-600 pl-2">
            {node.children.map((child) => (
              <TreeNode key={child.id} node={child} activeTerm={activeTerm} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="w-64 bg-[#1e2a38] text-white flex flex-col p-3 overflow-y-auto">
      <h3 className="font-bold text-[#d4af37] mb-2">JRpedia</h3>
      {tree.map((node) => (
        <TreeNode key={node.id} node={node} activeTerm={selectedTerm} />
      ))}
    </aside>
  );
}
