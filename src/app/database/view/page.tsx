'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Row = {
  id: number;
  source_file: string;
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

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('all_data')
        .select('id, source_file, block_id, company, ticker, bulletin_type, bulletin_date, tier')
        .order('bulletin_date', { ascending: false })
        .limit(100);

      if (error) {
        console.error(error);
      } else {
        setRows(data as Row[]);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) return <p>Carregando…</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1 className="text-2xl font-bold mb-4">All Data (visualização)</h1>
      <table className="min-w-full border-collapse border border-gray-400">
        <thead>
          <tr>
            <th className="border border-gray-400 p-2">Source File</th>
            <th className="border border-gray-400 p-2">Block ID</th>
            <th className="border border-gray-400 p-2">Company</th>
            <th className="border border-gray-400 p-2">Ticker</th>
            <th className="border border-gray-400 p-2">Type</th>
            <th className="border border-gray-400 p-2">Date</th>
            <th className="border border-gray-400 p-2">Tier</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td className="border border-gray-400 p-2">{r.source_file}</td>
              <td className="border border-gray-400 p-2">{r.block_id}</td>
              <td className="border border-gray-400 p-2">{r.company}</td>
              <td className="border border-gray-400 p-2">{r.ticker}</td>
              <td className="border border-gray-400 p-2">{r.bulletin_type}</td>
              <td className="border border-gray-400 p-2">{r.bulletin_date}</td>
              <td className="border border-gray-400 p-2">{r.tier}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
