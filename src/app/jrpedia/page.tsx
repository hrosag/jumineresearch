"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

import CrudModals from "./components/CrudModals";
import Sidebar from "./components/Sidebar";
import TermView from "./components/TermView";
import PasswordModal from "../dbadmin/components/PasswordModal";

import { GlossaryNode, GlossaryRow, Lang } from "./types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const pathSegmentPattern = /\./;

function parsePathSegments(path: string): (number | string)[] {
  return path
    .split(pathSegmentPattern)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const numeric = Number(segment);
      return Number.isNaN(numeric) ? segment : numeric;
    });
}

function comparePaths(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const segmentsA = parsePathSegments(a);
  const segmentsB = parsePathSegments(b);
  const length = Math.max(segmentsA.length, segmentsB.length);

  for (let index = 0; index < length; index += 1) {
    const segA = segmentsA[index];
    const segB = segmentsB[index];

    if (segA === undefined) return -1;
    if (segB === undefined) return 1;

    if (typeof segA === "number" && typeof segB === "number") {
      if (segA !== segB) return segA - segB;
      continue;
    }

    const stringA = String(segA).toLowerCase();
    const stringB = String(segB).toLowerCase();
    if (stringA !== stringB) return stringA.localeCompare(stringB);
  }

  return 0;
}

function buildTree(rows: GlossaryRow[]): GlossaryNode[] {
  const nodesByPath = new Map<string, GlossaryNode>();
  const looseNodes: GlossaryNode[] = [];

  rows.forEach((row) => {
    const node: GlossaryNode = { ...row, children: [] };
    if (row.path) {
      nodesByPath.set(row.path, node);
    } else {
      looseNodes.push(node);
    }
  });

  const roots: GlossaryNode[] = [...looseNodes];

  nodesByPath.forEach((node) => {
    const parentPath = node.parent_path ?? null;
    if (parentPath && nodesByPath.has(parentPath)) {
      nodesByPath.get(parentPath)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (items: GlossaryNode[], level = 0): GlossaryNode[] =>
    items
      .map((item) => ({
        ...item,
        children: sortNodes(item.children, level + 1),
      }))
      .sort((a, b) => {
        // níveis 0 e 1 (TSXV, Regulatory Framework, Bulletin) → segue path
        if (level < 2) {
          const byPath = comparePaths(a.path ?? null, b.path ?? null);
          if (byPath !== 0) return byPath;
        }
  
        // níveis 2+ → alfabético por termo
        const labelA = (a.term || "").toLowerCase();
        const labelB = (b.term || "").toLowerCase();
        return labelA.localeCompare(labelB);
      });

    return sortNodes(roots);
  }

export default function JRpediaPage() {
  const [entries, setEntries] = useState<GlossaryRow[]>([]);
  const [selectedLang, setSelectedLang] = useState<Lang>("pt");
  const [selectedTerm, setSelectedTerm] = useState<GlossaryRow | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [shouldOpenCreateAfterLogin, setShouldOpenCreateAfterLogin] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newTermParentPath, setNewTermParentPath] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from("glossary")
      .select("*")
      .order("path");

    if (error) {
      console.error("Erro ao carregar termos:", error.message);
      return;
    }

    const normalized = (data ?? []).map((row) => ({
      ...row,
      fonte:
        typeof row.fonte === "string"
          ? row.fonte
          : row.fonte != null
          ? String(row.fonte)
          : "",
    })) as GlossaryRow[];

    setEntries(normalized);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSetShowNewModal = (value: boolean) => {
    setShowNewModal(value);
    if (!value) {
      setNewTermParentPath(null);
      setShouldOpenCreateAfterLogin(false);
    }
  };

  const handleAddTerm = () => {
    setNewTermParentPath(selectedTerm?.path ?? null);

    if (!isAdmin) {
      setShouldOpenCreateAfterLogin(true);
      setShowPasswordModal(true);
      return;
    }

    setShouldOpenCreateAfterLogin(false);
    handleSetShowNewModal(true);
  };

  const handleExitAdmin = () => {
    setIsAdmin(false);
    handleSetShowNewModal(false);
  };

  const filteredEntries = useMemo(
    () =>
      entries.filter((row) => {
        if (!searchTerm) return true;
        const normalizedQuery = searchTerm.toLowerCase();
        const tokens: string[] = [
          row.term,
          row.pt ?? "",
          row.en ?? "",
          row.fr ?? "",
          row.path ?? "",
          ...(row.tags ?? []),
        ].filter((token) => token.length > 0);
        return tokens.some((token) => token.toLowerCase().includes(normalizedQuery));
      }),
    [entries, searchTerm],
  );

  const tree = useMemo(() => buildTree(filteredEntries), [filteredEntries]);

  return (
    <div className="flex h-screen bg-[#fdf8f0]">
      <Sidebar
        tree={tree}
        selectedTerm={selectedTerm}
        setSelectedTerm={setSelectedTerm}
        selectedLang={selectedLang}
        onAddTerm={handleAddTerm}
      />

      <main className="flex-1 ml-2 rounded-md border border-gray-300 shadow-sm bg-white px-6 py-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">JRpedia</h1>

          <div className="flex items-center space-x-3">
            <input
              type="text"
              placeholder="Pesquisar termos..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="border rounded px-3 py-1 text-sm"
            />

            <div className="flex space-x-2">
              {(["pt", "en", "fr"] as Lang[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLang(lang)}
                  className={`px-2 py-1 rounded ${
                    selectedLang === lang
                      ? "bg-[#d4af37] text-black font-bold"
                      : "bg-gray-200 hover:bg-gray-300"
                  }`}
                  type="button"
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                if (isAdmin) {
                  handleExitAdmin();
                  return;
                }

                setNewTermParentPath(null);
                setShouldOpenCreateAfterLogin(false);
                setShowPasswordModal(true);
              }}
              className={`flex h-9 w-9 items-center justify-center rounded text-lg font-medium transition ${
                isAdmin
                  ? "bg-red-100 text-red-600 hover:bg-red-200"
                  : "bg-green-100 text-green-600 hover:bg-green-200"
              }`}
              aria-label={isAdmin ? "Sair do modo admin" : "Entrar como admin"}
            >
              🔑
            </button>
          </div>
        </div>

        {!selectedTerm ? (
          <p className="text-gray-500">Selecione um termo na barra lateral para visualizar.</p>
        ) : (
          <TermView
            selectedTerm={selectedTerm}
            selectedLang={selectedLang}
            isAdmin={isAdmin}
            onEditTerm={() => setShowEditModal(true)}
            onDeleteSuccess={() => {
              setSelectedTerm(null);
              fetchEntries();
            }}
          />
        )}
      </main>

      {isAdmin && (
        <CrudModals
          showNewModal={showNewModal}
          setShowNewModal={handleSetShowNewModal}
          newParentPath={newTermParentPath}
          showEditModal={showEditModal}
          setShowEditModal={setShowEditModal}
          selectedTerm={selectedTerm}
          fetchEntries={fetchEntries}
        />
      )}

      {showPasswordModal && (
        <PasswordModal
          onSuccess={() => {
            setIsAdmin(true);
            setShowPasswordModal(false);
            if (shouldOpenCreateAfterLogin) {
              handleSetShowNewModal(true);
            }
            setShouldOpenCreateAfterLogin(false);
          }}
          onClose={() => {
            setShowPasswordModal(false);
            setShouldOpenCreateAfterLogin(false);
            setNewTermParentPath(null);
          }}
        />
      )}
    </div>
  );
}
