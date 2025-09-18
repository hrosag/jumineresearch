'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Disclosure } from '@headlessui/react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip } from 'recharts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Row = {
  id: number;
  company: string | null;
  ticker: string | null;
  bulletin_type: string | null;
  bulletin_date: string | null; // formato YYYY-MM-DD
  tier: string | null;
  body_text: string | null;
};

export default function ReportsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('all_data')
        .select('id, company, ticker, bulletin_type, bulletin_date, tier, body_text')
        .order('bulletin_date', { ascending: true });

      if (error) console.error(error);
      else setRows(data as Row[]);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) return <p className="p-4">Carregando…</p>;

  // estatísticas simples
  const boletins = rows.length;
  const empresas = new Set(rows.map(r => r.company)).size;
  const tipos = new Set(rows.map(r => r.bulletin_type)).size;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">TSXV 2008 — Storytelling por Empresa</h1>

      <p>Boletins: {boletins}</p>
      <p>Empresas distintas: {empresas}</p>
      <p>Tipos de boletim distintos: {tipos}</p>

      <ScatterChart width={900} height={300} className="my-6">
        <XAxis dataKey="bulletin_date" />
        <YAxis dataKey="company" type="category" />
        <Tooltip />
        <Scatter
          data={rows.map(r => ({
            ...r,
            bulletin_date: r.bulletin_date, // eixo X
          }))}
          fill="#8884d8"
        />
      </ScatterChart>

      <div className="mt-6">
        {rows.map((r) => (
          <Disclosure key={r.id}>
            {({ open }) => (
              <>
                <Disclosure.Button className="w-full text-left py-2 border-b">
                  {new Date(r.bulletin_date ?? '').toLocaleDateString('pt-BR')} — {r.bulletin_type}
                </Disclosure.Button>
                <Disclosure.Panel className="p-2 text-sm">
                  {r.body_text}
                </Disclosure.Panel>
              </>
            )}
          </Disclosure>
        ))}
      </div>
    </div>
  );
}
