'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Listbox } from '@headlessui/react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Row = {
  company: string | null;
  bulletin_date: string | null;   // vem ISO YYYY-MM-DD
  bulletin_type: string | null;
};

export default function ReportsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState<string[]>([]);

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('all_data')
        .select('company, bulletin_date, bulletin_type');
      if (error) console.error(error);
      else setRows(data as Row[]);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) return <p className="p-6">Carregando…</p>;

  // lista de empresas distintas (filtra null)
  const companies = Array.from(
    new Set(rows.map(r => r.company).filter((c): c is string => !!c))
  ).sort();

  // aplica filtro: se não escolher nada, mostra todas
  const filtered = rows
    .filter(r =>
      companyFilter.length === 0 ||
      companyFilter.includes(r.company ?? '')
    )
    // converte para timestamp p/ eixo temporal
    .map(r => ({
      ...r,
      date_ts: r.bulletin_date ? new Date(r.bulletin_date).getTime() : null
    }))
    .filter(r => r.date_ts !== null);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        TSXV 2008 — Storytelling por Empresa
      </h1>

      {/* --- Filtro por empresa --- */}
      <div className="mb-6">
        <label className="block font-semibold mb-1">Filtrar por empresa(s)</label>
        <Listbox
          multiple
          value={companyFilter}
          onChange={setCompanyFilter}
        >
          <Listbox.Button className="w-full p-2 border rounded">
            {companyFilter.length === 0 ? 'Todas' : companyFilter.join(', ')}
          </Listbox.Button>
          <Listbox.Options className="border rounded mt-1 max-h-64 overflow-auto bg-white text-black">
            {companies.map(c => (
              <Listbox.Option
                key={c}
                value={c}
                className="cursor-pointer hover:bg-gray-200 p-1"
              >
                {c}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Listbox>
      </div>

      {/* --- Gráfico Empresa x Tempo --- */}
      <div style={{ width: '100%', height: 500 }}>
        <ResponsiveContainer>
          <ScatterChart>
            <CartesianGrid />
            <XAxis
              dataKey="date_ts"
              name="Data"
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
              tickFormatter={(v) =>
                new Date(v).toLocaleDateString('pt-BR')
              }
            />
            <YAxis
              dataKey="company"
              name="Empresa"
              type="category"
              width={200}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(_, __, p) => [
                p.payload.bulletin_type,
                new Date(p.payload.date_ts).toLocaleDateString('pt-BR')
              ]}
              labelFormatter={() => ''}
            />
            <Scatter data={filtered} fill="#8884d8" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
