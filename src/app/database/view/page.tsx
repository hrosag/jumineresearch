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
  bulletin_date: string | null; // string vinda do Supabase: "YYYY-MM-DD"
  tier: string | null;
};

type SortColumn = keyof Row | null;
type SortDirection = 'asc' | 'desc';

export default function ViewAllData() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // filtros independentes
  const [filterDate, setFilterDate] = useState('');
  const [filterBlockId, setFilterBlockId] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterTicker, setFilterTicker] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterTier, setFilterTier] = useState('');

  // ordenação
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('all_data')
        .select('id, block_id, company, ticker, bulletin_type, bulletin_date, tier');

      if (error) {
        console.error(error);
      } else {
        setRows(data as Row[]);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  // helper para filtros (suporta "is:null")
  function check(val: string | number | null, filter: string) {
    if (!filter) return true;
    if (filter === 'is:null') return !val || String(val).trim() === '';
    return String(val ?? '').toLowerCase().includes(filter.toLowerCase());
  }

  // aplica filtros
  const filtered = rows.filter(r =>
    check(r.bulletin_date, filterDate) &&
    check(r.block_id, filterBlockId) &&
    check(r.company, filterCompany) &&
    check(r.ticker, filterTicker) &&
    check(r.bulletin_type, filterType) &&
    check(r.tier, filterTier)
  );

  // aplica ordenação
  const sorted = [...filtered].sort((a, b) => {
    if (!sortColumn) return 0;
    const valA = a[sortColumn];
    const valB = b[sortColumn];

    if (valA == null) return 1;
    if (valB == null) return -1;

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  if (loading) return <p className="p-4">Carregando…</p>;

  const sortIndicator = (col: SortColumn) => {
    if (sortColumn !== col) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div className="p-6 select-none">
      <h1 className="text-2xl font-bold mb-4">All Data (visualização)</h1>

      <table className="table-auto border-collapse w-full text-sm">
        <thead>
          <tr>
            {/* Date */}
            <th className="border px-4 py-2 cursor-pointer" onClick={() => handleSort('bulletin_date')}>
              <div className="flex flex-col">
                <span>Date{sortIndicator('bulletin_date')}</span>
                <input
                  className="mt-1 w-full p-1 border rounded text-sm"
                  placeholder="Filtrar"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </div>
            </th>

            {/* Block ID */}
            <th className="border px-4 py-2 cursor-pointer" onClick={() => handleSort('block_id')}>
              <div className="flex flex-col">
                <span>Block ID{sortIndicator('block_id')}</span>
                <input
                  className="mt-1 w-full p-1 border rounded text-sm"
                  placeholder="Filtrar"
                  value={filterBlockId}
                  onChange={(e) => setFilterBlockId(e.target.value)}
                />
              </div>
            </th>

            {/* Company */}
            <th className="border px-4 py-2 cursor-pointer" onClick={() => handleSort('company')}>
              <div className="flex flex-col">
                <span>Company{sortIndicator('company')}</span>
                <input
                  className="mt-1 w-full p-1 border rounded text-sm"
                  placeholder="Filtrar"
                  value={filterCompany}
                  onChange={(e) => setFilterCompany(e.target.value)}
                />
              </div>
            </th>

            {/* Ticker */}
            <th className="border px-4 py-2 cursor-pointer" onClick={() => handleSort('ticker')}>
              <div className="flex flex-col">
                <span>Ticker{sortIndicator('ticker')}</span>
                <input
                  className="mt-1 w-full p-1 border rounded text-sm"
                  placeholder="Filtrar"
                  value={filterTicker}
                  onChange={(e) => setFilterTicker(e.target.value)}
                />
              </div>
            </th>

            {/* Type */}
            <th className="border px-4 py-2 cursor-pointer" onClick={() => handleSort('bulletin_type')}>
              <div className="flex flex-col">
                <span>Type{sortIndicator('bulletin_type')}</span>
                <input
                  className="mt-1 w-full p-1 border rounded text-sm"
                  placeholder="Filtrar"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                />
              </div>
            </th>

            {/* Tier */}
            <th className="border px-4 py-2 cursor-pointer" onClick={() => handleSort('tier')}>
              <div className="flex flex-col">
                <span>Tier{sortIndicator('tier')}</span>
                <input
                  className="mt-1 w-full p-1 border rounded text-sm"
                  placeholder="Filtrar"
                  value={filterTier}
                  onChange={(e) => setFilterTier(e.target.value)}
                />
              </div>
            </th>
          </tr>
        </thead>

        <tbody>
          {sorted.map((r) => (
            <tr key={r.id}>
              <td className="border px-4 py-2">
                {r.bulletin_date
                  ? new Date(r.bulletin_date + 'T00:00:00').toLocaleDateString('pt-BR')
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
