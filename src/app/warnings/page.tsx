'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ResizableBox, ResizeCallbackData } from 'react-resizable';
import 'react-resizable/css/styles.css';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Row = {
  id: number;
  block_id: number;
  composite_key: string;
  company: string | null;
  ticker: string | null;
  bulletin_type: string | null;
  canonical_type: string | null;
  bulletin_date: string | null;
  tier: string | null;
};

type RowKey = keyof Row;

type SortConfig = {
  key: RowKey | 'comment';
  direction: 'asc' | 'desc';
};

export default function WarningsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    composite_key: 180,
    bulletin_date: 120,
    block_id: 80,
    company: 200,
    ticker: 120,
    bulletin_type: 250,
    canonical_type: 250,
    tier: 120,
    comment: 200,
  });
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [authorized, setAuthorized] = useState(false);

  // Carrega comentários do Supabase
  useEffect(() => {
    async function loadComments() {
      const { data, error } = await supabase
        .from('warnings_comments')
        .select('composite_key, comment');

      if (!error && data) {
        const map: Record<string, string> = {};
        data.forEach((c) => {
          map[c.composite_key] = c.comment;
        });
        setComments(map);
      }
    }
    loadComments();
  }, []);

  // Busca dados
  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('vw_bulletins_with_canonical')
        .select(
          'id, block_id, composite_key, company, ticker, bulletin_type, canonical_type, bulletin_date, tier'
        );

      if (error) {
        console.error(error);
      } else {
        const warnings = (data as Row[]).filter(
          (r) =>
            !r.company?.trim() ||
            !r.ticker?.trim() ||
            !r.bulletin_type?.trim() ||
            !r.canonical_type?.trim() ||
            !r.bulletin_date?.trim() ||
            !r.tier?.trim()
        );
        setRows(warnings);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) return <p className="p-4">Carregando avisos…</p>;

  // Ordenação tipada
  const sortedRows = [...rows].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;

    let valA: string | number | null;
    let valB: string | number | null;

    if (key === 'comment') {
      valA = comments[a.composite_key] || '';
      valB = comments[b.composite_key] || '';
    } else {
      valA = a[key as RowKey] ?? '';
      valB = b[key as RowKey] ?? '';
    }

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Header redimensionável + ordenação
  const ResizableHeader = ({ columnKey, label }: { columnKey: string; label: string }) => {
    const isSorted = sortConfig?.key === columnKey;
    const arrow = isSorted ? (sortConfig?.direction === 'asc' ? '▲' : '▼') : '';

    return (
      <th className="border px-0 py-2 cursor-pointer select-none">
        <ResizableBox
          width={colWidths[columnKey]}
          height={30}
          axis="x"
          resizeHandles={['e']}
          onResizeStop={(_event: unknown, data: ResizeCallbackData) => {
            setColWidths((prev) => ({ ...prev, [columnKey]: data.size.width }));
          }}
        >
          <div
            className="px-2 whitespace-nowrap font-semibold flex items-center"
            onClick={() => {
              setSortConfig((prev) =>
                prev?.key === columnKey
                  ? { key: columnKey as SortConfig['key'], direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                  : { key: columnKey as SortConfig['key'], direction: 'asc' }
              );
            }}
          >
            {label} {arrow}
          </div>
        </ResizableBox>
      </th>
    );
  };

  // Senha admin
  function askPassword() {
    const pwd = prompt('Digite a senha de administrador para habilitar edição:');
    if (pwd === process.env.NEXT_PUBLIC_DBADMIN_PASSWORD) {
      setAuthorized(true);
    } else {
      alert('Senha incorreta ❌');
    }
  }

  return (
    <div className="p-6">
      {/* Header com botão alinhado à direita */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">⚠️ Avisos</h1>
        <div>
          {!authorized ? (
            <button
              onClick={askPassword}
              className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm"
            >
              🔒 Digite a senha para habilitar edição
            </button>
          ) : (
            <p className="text-green-600 font-semibold">✅ Edição habilitada (admin)</p>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-green-600">Nenhum aviso encontrado 🎉</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-auto border-collapse text-sm">
            <thead>
              <tr>
                <ResizableHeader columnKey="composite_key" label="Composite Key" />
                <ResizableHeader columnKey="bulletin_date" label="Date" />
                <ResizableHeader columnKey="block_id" label="Block ID" />
                <ResizableHeader columnKey="company" label="Company" />
                <ResizableHeader columnKey="ticker" label="Ticker" />
                <ResizableHeader columnKey="bulletin_type" label="Type (Original)" />
                <ResizableHeader columnKey="canonical_type" label="Type (Canonical)" />
                <ResizableHeader columnKey="tier" label="Tier" />
                <ResizableHeader columnKey="comment" label="Comentário" />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr key={r.id} className="bg-red-50">
                  <td className="border px-2 py-2 font-mono text-xs text-gray-600" style={{ minWidth: colWidths.composite_key }}>
                    {r.composite_key}
                  </td>
                  <td className="border px-2 py-2" style={{ minWidth: colWidths.bulletin_date }}>
                    {r.bulletin_date
                      ? new Date(r.bulletin_date + 'T00:00:00').toLocaleDateString('pt-BR')
                      : <span className="text-red-600">[vazio]</span>}
                  </td>
                  <td className="border px-2 py-2" style={{ minWidth: colWidths.block_id }}>
                    {r.block_id}
                  </td>
                  <td className="border px-2 py-2" style={{ minWidth: colWidths.company }}>
                    {r.company || <span className="text-red-600">[vazio]</span>}
                  </td>
                  <td className="border px-2 py-2" style={{ minWidth: colWidths.ticker }}>
                    {r.ticker || <span className="text-red-600">[vazio]</span>}
                  </td>
                  <td className="border px-2 py-2" style={{ minWidth: colWidths.bulletin_type }}>
                    {r.bulletin_type || <span className="text-red-600">[vazio]</span>}
                  </td>
                  <td className="border px-2 py-2 text-gray-700 font-semibold" style={{ minWidth: colWidths.canonical_type }}>
                    {r.canonical_type || <span className="text-red-600">[vazio]</span>}
                  </td>
                  <td className="border px-2 py-2" style={{ minWidth: colWidths.tier }}>
                    {r.tier || <span className="text-red-600">[vazio]</span>}
                  </td>
                  <td className="border px-2 py-2" style={{ minWidth: colWidths.comment }}>
                    <input
                      type="text"
                      disabled={!authorized}
                      aria-label={`Comentário para linha ${r.composite_key}`}
                      value={comments[r.composite_key] || ''}
                      onChange={async (e) => {
                        if (!authorized) return;
                        const newComment = e.target.value;
                        setComments({ ...comments, [r.composite_key]: newComment });

                        const { error } = await supabase
                          .from('warnings_comments')
                          .upsert({
                            composite_key: r.composite_key,
                            comment: newComment,
                          });

                        if (error) {
                          console.error('Erro ao salvar comentário:', error.message);
                          alert('⚠️ Não foi possível salvar no banco.');
                        }
                      }}
                      placeholder={
                        authorized
                          ? 'Adicionar comentário...'
                          : '🔒 Apenas administrador pode comentar'
                      }
                      className={`w-full p-1 border rounded text-xs ${
                        !authorized ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                      }`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
