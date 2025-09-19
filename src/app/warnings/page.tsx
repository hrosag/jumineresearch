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
  bulletin_date: string | null;
  tier: string | null;
};

type SortConfig = {
  key: keyof Row | 'comment';
  direction: 'asc' | 'desc';
};

export default function WarningsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    composite_key: 180,
    date: 120,
    block_id: 80,
    company: 200,
    ticker: 120,
    type: 250,
    tier: 120,
    comment: 200,
  });
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Carrega comentários e widths
  useEffect(() => {
    const stored = localStorage.getItem('warnings-comments');
    if (stored) setComments(JSON.parse(stored));

    const storedWidths = localStorage.getItem('warnings-colwidths');
    if (storedWidths) setColWidths(JSON.parse(storedWidths));
  }, []);

  // Salva comentários
  useEffect(() => {
    localStorage.setItem('warnings-comments', JSON.stringify(comments));
  }, [comments]);

  // Salva widths
  useEffect(() => {
    localStorage.setItem('warnings-colwidths', JSON.stringify(colWidths));
  }, [colWidths]);

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('all_data')
        .select(
          'id, block_id, composite_key, company, ticker, bulletin_type, bulletin_date, tier'
        );

      if (error) {
        console.error(error);
      } else {
        const warnings = (data as Row[]).filter(
          (r) =>
            !r.company?.trim() ||
            !r.ticker?.trim() ||
            !r.bulletin_type?.trim() ||
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

  // Ordenação manual
  const sortedRows = [...rows].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;

    let valA: any, valB: any;
    if (key === 'comment') {
      valA = comments[a.id] || '';
      valB = comments[b.id] || '';
    } else {
      valA = a[key] || '';
      valB = b[key] || '';
    }

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Header redimensionável + clique para ordenar
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
                  ? { key: columnKey as any, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                  : { key: columnKey as any, direction: 'asc' }
              );
            }}
          >
            {label} {arrow}
          </div>
        </ResizableBox>
      </th>
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">⚠️ Avisos Internos</h1>

      {rows.length === 0 ? (
        <p className="text-green-600">Nenhum aviso encontrado 🎉</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-auto border-collapse text-sm">
            <thead>
              <tr>
                <ResizableHeader columnKey="composite_key" label="Composite Key" />
                <ResizableHeader columnKey="date" label="Date" />
                <ResizableHeader columnKey="block_id" label="Block ID" />
                <ResizableHeader columnKey="company" label="Company" />
                <ResizableHeader columnKey="ticker" label="Ticker" />
                <ResizableHeader columnKey="type" label="Type" />
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
                  <td className="border px-2 py-2" style={{ minWidth: colWidths.date }}>
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
                  <td className="border px-2 py-2" style={{ minWidth: colWidths.type }}>
                    {r.bulletin_type || <span className="text-red-600">[vazio]</span>}
                  </td>
                  <td className="border px-2 py-2" style={{ minWidth: colWidths.tier }}>
                    {r.tier || <span className="text-red-600">[vazio]</span>}
                  </td>
                  <td className="border px-2 py-2" style={{ minWidth: colWidths.comment }}>
                    <input
                      type="text"
                      aria-label={`Comentário para linha ${r.composite_key}`}
                      value={comments[r.id] || ''}
                      onChange={(e) => setComments({ ...comments, [r.id]: e.target.value })}
                      placeholder="Adicionar comentário..."
                      className="w-full p-1 border rounded text-xs"
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
