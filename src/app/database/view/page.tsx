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
  bulletin_date: string | null;
  tier: string | null;
};

export default function ViewAllData() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // filtros independentes por coluna
  const [filterCompany, setFilterCompany] = useState('');
  const [filterTicker, setFilterTicker] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterTier, setFilterTier] = useState('');

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('all_data')
        .select('id, block_id, company, ticker, bulletin_type, bulletin_date, tier')
        .order('bulletin_date', { ascending: false });

      if (error) console.error(error);
      else setRows(data as Row[]);
      setLoading(false);
    }
    fetchData();
  }, []);

  const filtered = rows.filter(r =>
    (r.company ?? '').toLowerCase().includes(filterCompany.toLowerCase()) &&
    (r.ticker ?? '').toLowerCase().includes(filterTicker.toLowerCase()) &&
    (r.bulletin_type ?? '').toLowerCase().includes(filterType.toLowerCase()) &&
    (r.tier ?? '').toLowerCase().includes(filterTier.toLowerCase())
  );

  if (loading) return <p className="p-4">Carregando…</p>;

  return (
    <div className="p-6 select-none">
      <h1 className="text-2xl font-bold mb-4">All Data (visualização)</h1>

      <table className="table-auto border-collapse w-full">
        <thead>
          <tr>
            <th className="border px-4 py-2">Date</th>
            <th className="border px-4 py-2">Block ID</th>
            <th className="border px-4 py-2">
              Company
              <input
                className="mt-1 w-full p-1 border rounded text-sm"
                placeholder="Filtro"
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
              />
            </th>
            <th className="border px-4 py-2">
              Ticker
              <input
                className="mt-1 w-full p-1 border rounded text-sm"
                placeholder="Filtro"
                value={filterTicker}
                onChange={(e) => setFilterTicker(e.target.value)}
              />
            </th>
            <th className="border px-4 py-2">
              Type
              <input
                className="mt-1 w-full p-1 border rounded text-sm"
                placeholder="Filtro"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              />
            </th>
            <th className="border px-4 py-2">
              Tier
              <input
                className="mt-1 w-full p-1 border rounded text-sm"
                placeholder="Filtro"
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <td className="border px-4 py-2">
                {r.bulletin_date
                  ? new Date(r.bulletin_date).toLocaleDateString('pt-BR')
                  : ''}
              </td>
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
