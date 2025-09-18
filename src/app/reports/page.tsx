'use client'

import { useEffect, useState, useMemo } from 'react'
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
  bulletin_date: string | null   // formato ISO (YYYY-MM-DD) vindo do Supabase
}

export default function ReportsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('all_data')
        .select('id, company, ticker, bulletin_type, bulletin_date')
      if (error) console.error(error)
      else setRows(data as Row[])
      setLoading(false)
    }
    fetchData()
  }, [])

  // lista de empresas únicas (ordenadas)
  const companies = useMemo(
    () =>
      Array.from(
        new Set(rows.map(r => r.company).filter((c): c is string => Boolean(c)))
      ).sort(),
    [rows]
  )

  // filtro por empresa (se nada selecionado mostra tudo)
  const filtered = useMemo(
    () =>
      rows.filter(r =>
        selectedCompanies.length === 0
          ? true
          : selectedCompanies.includes(r.company ?? '')
      ),
    [rows, selectedCompanies]
  )

  // prepara dados pro gráfico: converte data em timestamp (com T00:00:00 para fuso local)
  const chartData = useMemo(
    () =>
      filtered
        .filter(r => r.company && r.bulletin_date)
        .map(r => ({
          company: r.company ?? '',
          date: new Date(r.bulletin_date + 'T00:00:00').getTime(),
          type: r.bulletin_type ?? '—'
        })),
    [filtered]
  )

  // eventos ordenados por data real
  const events = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          new Date(a.bulletin_date ?? 0).getTime() -
          new Date(b.bulletin_date ?? 0).getTime()
      ),
    [filtered]
  )

  if (loading) return <p className="p-4">Carregando…</p>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        TSXV 2008 — Storytelling por Empresa
      </h1>

      {/* Filtro por empresa(s) */}
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
          <option key={c} value={c}>
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
            tickFormatter={(ts) => new Date(ts).toLocaleDateString('pt-BR')}
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
        <h2 className="text-xl font-bold mb-2">Eventos (ordenados por data)</h2>
        {events.map(ev => (
          <details key={ev.id} className="mb-2 border-b pb-1">
            <summary>
              {ev.bulletin_date
                ? new Date(ev.bulletin_date + 'T00:00:00').toLocaleDateString('pt-BR')
                : ''}{' '}
              — {ev.bulletin_type}
            </summary>
            <div className="pl-4 text-sm text-gray-700">
              {ev.company} ({ev.ticker})
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
