"use client";

import { useEffect, useState } from "react";
import { GlossaryNode, GlossaryRow, SidebarProps } from "../types";

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

    const isSamePath =
      activeTerm?.path && node.path
        ? activeTerm.path === node.path
        : activeTerm?.id === node.id;
    const isSelected = Boolean(isSamePath);

    // expande apenas o ramo ativo, sem recolher outros
    useEffect(() => {
      if (!activeTerm) return;
      const isInBranch = (current: GlossaryNode): boolean =>
        current.id === activeTerm.id ||
        (current.children?.some(isInBranch) ?? false);

      if (isInBranch(node) && collapsed) {
        setCollapsed(false);
      }
    }, [activeTerm]);

    const fontSize =
      level === 0
        ? "text-lg font-semibold"
        : level === 1
        ? "text-base font-medium"
        : level === 2
        ? "text-sm"
        : "text-xs text-gray-300";

    return (
      <div className="ml-1 transition-all duration-150 ease-in-out">
        <button
          onClick={() => {
            const isAncestor =
              activeTerm &&
              node.children.some(function check(child) {
                return (
                  child.id === activeTerm.id || child.children?.some(check)
                );
              });

            // alterna visual imediatamente
            if (isAncestor || activeTerm?.id === node.id) {
              setCollapsed((prev) => !prev);
            } else if (node.children.length > 0 && collapsed) {
              setCollapsed(false);
            }

            setSelectedTerm(node);
          }}
          className={`block w-full text-left px-2 py-1 rounded ${fontSize} transition-all duration-150 ease-in-out ${
            isSelected
              ? "bg-[#d4af37] text-black"
              : "hover:bg-[#2e3b4a] text-white"
          }`}
          type="button"
        >
          <div className="flex items-center space-x-2">
            <span>{node[selectedLang] || node.term}</span>
          </div>
        </button>

        <div
          className={`ml-2 border-l border-gray-600 pl-1 overflow-hidden transition-all duration-150 ease-in-out ${
            collapsed ? "max-h-0 opacity-0" : "max-h-[999px] opacity-100"
          }`}
        >
          {node.children.length > 0 &&
            node.children.map((child) => (
              <TreeNode
                key={child.path ?? `node-${child.id}`}
                node={child}
                activeTerm={activeTerm}
                level={level + 1}
              />
            ))}
        </div>
      </div>
    );
  }

  return (
    <aside className="ml-2 flex w-64 min-w-[220px] max-w-[400px] resize-x flex-col overflow-hidden rounded-md border border-gray-700 bg-[#1e2a38] text-white shadow-sm transition-all duration-150 ease-in-out">
      <div className="flex items-center justify-between px-3 pt-4 pb-2">
        <h3 className="text-lg font-bold text-[#d4af37]">JRpedia</h3>
        <button
          type="button"
          onClick={onAddTerm}
          className="flex h-7 w-7 items-center justify-center rounded bg-[#d4af37] font-bold text-black hover:bg-[#f0c75e] transition-all duration-150 ease-in-out"
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
                key={node.path ?? `node-${node.id}`}
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
