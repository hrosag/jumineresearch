'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Row = {
  id: number
  company: string | null
  ticker: string | null
  bulletin_type: string | null
  bulletin_date: string | null
  body_text: string | null
}

export default function ReportsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('all_data')
        .select('id, company, ticker, bulletin_type, bulletin_date, body_text')
      if (error) console.error(error)
      else setRows(data as Row[])
      setLoading(false)
    }
    fetchData()
  }, [])

  // lista de empresas únicas ordenadas
  const companies = Array.from(
    new Set(rows.map(r => r.company).filter(Boolean))
  ).sort()

  // aplica filtro de empresa (ou mostra tudo se nenhuma selecionada)
  const filtered = rows.filter(r =>
    selectedCompanies.length === 0
      ? true
      : selectedCompanies.includes(r.company ?? '')
  )

  // prepara dados pro gráfico: data em timestamp para eixo X
  const chartData = filtered
    .filter(r => r.bulletin_date && r.company)
    .map(r => ({
      company: r.company!,
      date: new Date(r.bulletin_date + 'T00:00:00').getTime(),
      type: r.bulletin_type ?? '—'
    }))

  // eventos ordenados por data
  const events = [...filtered].sort((a, b) =>
    (a.bulletin_date ?? '').localeCompare(b.bulletin_date ?? '')
  )

  if (loading) return <p className="p-4">Carregando…</p>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">
          TSXV 2008 — Storytelling por Empresa
        </h1>

        {/* Botão Gerar Story: só aparece se exatamente 1 empresa estiver selecionada */}
        {selectedCompanies.length === 1 && (
          <a
            href={`/api/reports/story?company=${encodeURIComponent(
              selectedCompanies[0]
            )}`}
            className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600"
          >
            📄 Gerar Story
          </a>
        )}
      </div>

      {/* Filtro de empresas */}
      <label className="font-semibold">Filtrar por empresa(s)</label>
      <select
        multiple
        value={selectedCompanies}
        onChange={e =>
          setSelectedCompanies(
            Array.from(e.target.selectedOptions).map(o => o.value)
          )
        }
        className="border rounded w-full mb-6 h-32 p-2"
      >
        {companies.map(c => (
          <option key={c ?? ''} value={c ?? ''}>
            {c}
          </option>
        ))}
      </select>

      {/* Timeline */}
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <XAxis
            type="number"
            dataKey="date"
            name="Data"
            domain={['auto', 'auto']}
            tickFormatter={ts => new Date(ts).toLocaleDateString('pt-BR')}
          />
          <YAxis type="category" dataKey="company" name="Empresa" />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            formatter={(value, name) =>
              name === 'date'
                ? new Date(value as number).toLocaleDateString('pt-BR')
                : value
            }
          />
          <Legend />
          <Scatter name="Boletins" data={chartData} fill="#8884d8" />
        </ScatterChart>
      </ResponsiveContainer>

      {/* Lista de eventos ordenados */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-2">
          Eventos (ordenados por data)
        </h2>
        {events.map(ev => (
          <details key={ev.id} className="mb-2 border-b pb-1">
            <summary>
              {ev.bulletin_date
                ? new Date(ev.bulletin_date + 'T00:00:00').toLocaleDateString('pt-BR')
                : ''}{' '}
              — {ev.bulletin_type}
            </summary>
            <div className="pl-4 text-sm text-gray-700 whitespace-pre-wrap">
              {ev.body_text}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
