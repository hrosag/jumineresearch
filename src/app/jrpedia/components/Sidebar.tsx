"use client";

import { useState } from "react";
import { GlossaryNode, GlossaryRow, SidebarProps } from "../../jrpedia/types";

export default function Sidebar({
  tree,
  selectedTerm,
  setSelectedTerm,
  selectedLang,
  onAddTerm,
}: SidebarProps) {
  const [expanded, setExpanded] = useState<Record<string | number, boolean>>({});

  const isExpanded = (id: string | number) => !!expanded[id];

  const collapseBranch = (node: GlossaryNode, map: Record<string | number, boolean>) => {
    delete map[node.id];
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => collapseBranch(child, map));
    }
  };

  const toggleExpanded = (node: GlossaryNode) => {
    setExpanded((prev) => {
      const newMap = { ...prev };
      const current = !!prev[node.id];
      if (current) {
        // se for colapsar, apaga também os descendentes
        collapseBranch(node, newMap);
      } else {
        newMap[node.id] = true;
      }
      return newMap;
    });
  };

  function TreeNode({
    node,
    activeTerm,
    level = 0,
  }: {
    node: GlossaryNode;
    activeTerm: GlossaryRow | null;
    level?: number;
  }) {
    const expandedHere = isExpanded(node.id);
    const isSamePath =
      activeTerm?.path && node.path
        ? activeTerm.path === node.path
        : activeTerm?.id === node.id;
    const isSelected = Boolean(isSamePath);

    const fontSize =
      level === 0
        ? "text-lg font-semibold"
        : level === 1
        ? "text-base font-medium"
        : level === 2
        ? "text-sm"
        : "text-xs text-gray-300";

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();

      if (isSelected && node.children.length > 0) {
        toggleExpanded(node); // colapsa/expande, recursivo no colapso
      } else {
        setSelectedTerm(node);
      }
    };

    return (
      <div className="ml-1">
        <button
          onClick={handleClick}
          className={`block w-full text-left px-2 py-1 rounded ${fontSize} transition-colors duration-100 ease-in-out ${
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

        {expandedHere && node.children.length > 0 && (
          <div className="ml-2 border-l border-gray-600 pl-1">
            {node.children.map((child) => (
              <TreeNode
                key={child.path ?? `node-${child.id}`}
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
    <aside className="ml-2 flex w-64 min-w-[220px] max-w-[400px] resize-x flex-col overflow-hidden rounded-md border border-gray-700 bg-[#1e2a38] text-white shadow-sm">
      <div className="flex items-center justify-between px-3 pt-4 pb-2">
        <h3 className="text-lg font-bold text-[#d4af37]">JRpedia</h3>
        <button
          type="button"
          onClick={onAddTerm}
          className="flex h-7 w-7 items-center justify-center rounded bg-[#d4af37] font-bold text-black hover:bg-[#f0c75e] transition-colors duration-100 ease-in-out"
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
