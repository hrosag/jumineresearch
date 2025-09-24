"use client";
import { useCallback, useEffect, useState } from "react";
import { GlossaryRow, GlossaryNode, SidebarProps } from "../types";

export default function Sidebar({
  tree,
  selectedTerm,
  setSelectedTerm,
  selectedLang,
  onAddTerm,
}: SidebarProps) {
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<number>>(
    () => new Set(),
  );

  const findPathToNode = useCallback(
    (nodes: GlossaryNode[], targetId: number): GlossaryNode[] | null => {
      for (const node of nodes) {
        if (node.id === targetId) {
          return [node];
        }

        if (node.children.length > 0) {
          const childPath = findPathToNode(node.children, targetId);
          if (childPath) {
            return [node, ...childPath];
          }
        }
      }

      return null;
    },
    [],
  );

  useEffect(() => {
    if (!selectedTerm) return;

    const pathNodes = findPathToNode(tree, selectedTerm.id);
    if (!pathNodes) return;

    setExpandedNodeIds((prev) => {
      let shouldUpdate = false;
      const next = new Set(prev);

      pathNodes.forEach((pathNode) => {
        if (pathNode.children.length > 0 && !next.has(pathNode.id)) {
          next.add(pathNode.id);
          shouldUpdate = true;
        }
      });

      return shouldUpdate ? next : prev;
    });
  }, [findPathToNode, selectedTerm, tree]);

  function TreeNode({
    node,
    activeTerm,
  }: {
    node: GlossaryNode
    activeTerm: GlossaryRow | null
  }) {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodeIds.has(node.id);
    const isSelected = activeTerm?.id === node.id;
    const label = node[selectedLang] || node.term;
    const normalizedLabel = label?.trim();
    const isTsxvNode =
      node.term.toUpperCase() === "TSXV" ||
      normalizedLabel?.toUpperCase() === "TSXV";

    const handleClick = () => {
      if (isTsxvNode) {
        setExpandedNodeIds(new Set());
        return;
      }

      if (hasChildren) {
        setExpandedNodeIds((prev) => {
          const next = new Set(prev);
          if (next.has(node.id)) {
            next.delete(node.id);
          } else {
            next.add(node.id);
          }
          return next;
        });
        return;
      }

      setSelectedTerm(node);
    };

    return (
      <div className="ml-2">
        <button
          onClick={handleClick}
          className={`block w-full text-left px-2 py-1 rounded ${
            isSelected
              ? "bg-[#d4af37] text-black font-bold"
              : "hover:bg-[#2e3b4a]"
          }`}
        >
          {normalizedLabel || node.term}
        </button>

        {hasChildren && isExpanded && (
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
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-bold text-[#d4af37]">JRpedia</h3>
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
        <TreeNode key={node.id} node={node} activeTerm={selectedTerm} />
      ))}
    </aside>
  );
}
