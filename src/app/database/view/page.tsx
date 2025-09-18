'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Row = {
  id: number;
  block_id: number;
  company: string | null;
  ticker: string | null;
  bulletin_type: string | null;
  bulletin_date: string | null; // já vem como DD/MM/AAAA do Python
  tier: string | null;
};

export default function ViewAllData() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');  // <<< ADIÇÃO >>> filtro simples

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('all_data')
        // <<< MUDANÇA >>> removido source_file
        .select('id, block_id, company, ticker, bulletin_type, bulletin_date, tier')
        .order('bulletin_date', { ascending: false }); // <<< MUDANÇA >>> ordena Z-A

      if (error) console.error(error);
      else setRows(data as Row[]);
      setLoading(false);
    }
    fetchData();
  }, []);

  // <<< ADIÇÃO >>> aplica filtro em memória
  const filtered = rows.filter(r =>
    (r.company ?? '').toLowerCase().includes(filter.toLowerCase()) ||
    (r.ticker ?? '').toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) return <p className="p-4">Carregando…</p>;

  return (
    <div className="p-6 select-none"> {/* <<< MUDANÇA >>> evita seleção/cópia */}
      <h1 className="text-2xl font-bold mb-4">All Data (visualização)</h1>

      {/* <<< ADIÇÃO >>> campo de filtro */}
      <input
        className="mb-4 p-2 border rounded"
        placeholder="Filtrar por Company ou Ticker…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <table className="table-auto border-collapse w-full">
        <thead>
          <tr>
            {/* <<< MUDANÇA >>> nova ordem das colunas */}
            <th className="border px-4 py-2">Date</th>
            <th className="border px-4 py-2">Block ID</th>
            <th className="border px-4 py-2">Company</th>
            <th className="border px-4 py-2">Ticker</th>
            <th className="border px-4 py-2">Type</th>
            <th className="border px-4 py-2">Tier</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <td className="border px-4 py-2">{r.bulletin_date}</td>
              <td className="border px-4 py-2">{r.block_id}</td>
              <td className="border px-4 py-2">{r.company}</td>
              <td className="border px-4 py-2">{r.ticker}</td>
              <td className="border px-4 py-2">{r.bulletin_type}</td>
              <td className="border px-4 py-2">{r.tier}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
