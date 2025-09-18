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
  body_text: string | null        // <<< NOVO campo para texto completo
}

export default function ReportsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCompany, setSelectedCompany] = useState<string>('')

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

  if (loading) return <p className="p-4">Carregando…</p>

  // lista de empresas únicas (ordenadas)
  const companies = Array.from(new Set(rows.map(r => r.company).filter(Boolean))).sort()

  // filtro
  const filtered = rows.filter(r =>
    selectedCompany ? r.company === selectedCompany : true
  )

  // macro-dados (mesmo modelo do Streamlit)
  const boletins = filtered.length
  const empresas = new Set(filtered.map(r => r.company)).size
  const tipos = new Set(filtered.map(r => r.bulletin_type)).size
  const avisos = filtered.filter(r => !r.company).length

  // dados para o gráfico: X = tempo, Y = empresa (fixa)
  const chartData = filtered
    .filter(r => r.bulletin_date)
    .map(r => ({
      company: selectedCompany || r.company || '',
      date: new Date(r.bulletin_date + 'T00:00:00').getTime(),
      type: r.bulletin_type ?? '—'
    }))

  // eventos ordenados por data
  const events = [...filtered].sort((a, b) =>
    (a.bulletin_date ?? '').localeCompare(b.bulletin_date ?? '')
  )

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">TSXV 2008 — Storytelling por Empresa</h1>

      {/* --- Painel macro --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center font-semibold">
        <div>
          <div className="text-3xl">{boletins}</div>
          <div className="text-sm text-gray-600">Boletins no filtro</div>
        </div>
        <div>
          <div className="text-3xl">{empresas}</div>
          <div className="text-sm text-gray-600">Empresas distintas</div>
        </div>
        <div>
          <div className="text-3xl">{tipos}</div>
          <div className="text-sm text-gray-600">Tipos de boletim distintos</div>
        </div>
        <div>
          <div className="text-3xl">{avisos}</div>
          <div className="text-sm text-gray-600">Avisos gerais (no filtro)</div>
        </div>
      </div>

      {/* --- Filtro de empresa --- */}
      <div>
        <label className="block font-semibold mb-1">Selecionar empresa</label>
        <select
          value={selectedCompany}
          onChange={(e) => setSelectedCompany(e.target.value)}
          className="border rounded p-2 w-full max-w-xl"
        >
          <option value="">Todas</option>
          {companies.map(c => (
            <option key={c ?? ''} value={c ?? ''}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* --- Timeline --- */}
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <XAxis
            type="number"
            dataKey="date"
            name="Data"
            domain={['auto', 'auto']}
            tickFormatter={(ts) => new Date(ts).toLocaleDateString('pt-BR')}
          />
          {/* Y sem labels de empresa */}
          <YAxis type="category" dataKey="company" hide />
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

      {/* --- Lista de eventos --- */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-2">Eventos (ordenados por data)</h2>
        {events.map(ev => (
          <details key={ev.id} className="mb-2 border-b pb-1">
            <summary className="cursor-pointer">
              {ev.bulletin_date
                ? new Date(ev.bulletin_date + 'T00:00:00').toLocaleDateString('pt-BR')
                : ''} — {ev.bulletin_type}
            </summary>
            <div className="pl-4 text-sm text-gray-700 whitespace-pre-wrap">
              <p className="font-semibold">{ev.company} ({ev.ticker})</p>
              {/* corpo completo do boletim */}
              {ev.body_text ?? '(sem texto)'}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
