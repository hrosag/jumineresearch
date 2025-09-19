'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Select, { MultiValue } from 'react-select'
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
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

type CompanyOption = { value: string; label: string }

export default function ReportsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [startDate, setStartDate] = useState<string>('') // sempre string
  const [endDate, setEndDate] = useState<string>('')     // sempre string

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('all_data')
        .select('id, company, ticker, bulletin_type, bulletin_date, body_text')
      if (error) console.error(error)
      else {
        setRows(data as Row[])

        // calcula datas min/max
        const dates = (data ?? [])
          .map(r => r.bulletin_date)
          .filter(Boolean) as string[]

        if (dates.length > 0) {
          const minDate = dates.reduce((a, b) => (a < b ? a : b))
          const maxDate = dates.reduce((a, b) => (a > b ? a : b))
          setStartDate(minDate || '')
          setEndDate(maxDate || '')
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const companies = Array.from(
    new Set(rows.map(r => r.company).filter(Boolean))
  ).sort() as string[]

  // filtro combinado: empresas + intervalo de datas
  const filtered = rows.filter(r => {
    const companyOk =
      selectedCompanies.length === 0
        ? true
        : selectedCompanies.includes(r.company ?? '')

    const dateOk =
      !r.bulletin_date
        ? false
        : (!startDate || r.bulletin_date >= startDate) &&
          (!endDate || r.bulletin_date <= endDate)

    return companyOk && dateOk
  })

  const chartData = filtered
    .filter(r => r.bulletin_date && r.company)
    .map(r => ({
      company: r.company!,
      ticker: r.ticker ?? '—',
      bulletinType: r.bulletin_type ?? '—',
      date: new Date(r.bulletin_date + 'T00:00:00').getTime()
    }))

  const events = [...filtered].sort((a, b) =>
    (a.bulletin_date ?? '').localeCompare(b.bulletin_date ?? '')
  )

  const macro = {
    boletins: filtered.length,
    empresas: new Set(filtered.map(r => r.company)).size,
    tipos: new Set(filtered.map(r => r.bulletin_type)).size,
    avisosGerais: filtered.filter(r => !r.company).length
  }

  if (loading) return <p className="p-4">Carregando…</p>

  return (
    <div className="p-6">
      {/* Cabeçalho + botão Gerar Story */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">TSXV 2008 — Storytelling por Empresa</h1>

        {selectedCompanies.length > 0 && (
          <a
            href={
              selectedCompanies.length === 1
                ? `/api/reports/story?company=${encodeURIComponent(selectedCompanies[0])}`
                : `/api/reports/story?multi=${encodeURIComponent(selectedCompanies.join(','))}`
            }
            className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600"
          >
            📄 Gerar Story
          </a>
        )}
      </div>

      {/* Painel macro compacto à esquerda */}
      <div className="flex gap-8 text-center mb-6">
        <div>
          <div className="text-xl font-bold">{macro.boletins}</div>
          <div className="text-xs text-gray-600">Boletins no filtro</div>
        </div>
        <div>
          <div className="text-xl font-bold">{macro.empresas}</div>
          <div className="text-xs text-gray-600">Empresas distintas</div>
        </div>
        <div>
          <div className="text-xl font-bold">{macro.tipos}</div>
          <div className="text-xs text-gray-600">Tipos de boletim distintos</div>
        </div>
        <div>
          <div className="text-xl font-bold">{macro.avisosGerais}</div>
          <div className="text-xs text-gray-600">Avisos gerais (no filtro)</div>
        </div>
      </div>

      {/* Filtros: empresa + intervalo de datas */}
      <div className="flex gap-6 mb-6">
        {/* seletor de empresas */}
        <div className="w-1/2">
          <label className="font-semibold block mb-2">Selecionar empresa(s)</label>
          <Select<CompanyOption, true>
            isMulti
            options={[
              { value: '*ALL*', label: 'Selecionar todas' },
              ...companies.map(c => ({ value: c, label: c }))
            ]}
            value={
              selectedCompanies.length === companies.length
                ? [{ value: '*ALL*', label: 'Selecionar todas' }]
                : selectedCompanies.map(c => ({ value: c, label: c }))
            }
            onChange={(selected: MultiValue<CompanyOption>) => {
              const vals = (selected ?? []).map(s => s.value)
              if (vals.includes('*ALL*')) setSelectedCompanies(companies)
              else setSelectedCompanies(vals)
            }}
            placeholder="Escolha as empresas…"
            className="text-black"
          />
        </div>

        {/* intervalo de datas */}
        <div className="flex gap-4 items-end">
          <div>
            <label className="font-semibold block mb-2">Data inicial</label>
            <input
              type="date"
              className="border px-2 py-1 rounded text-black"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="font-semibold block mb-2">Data final</label>
            <input
              type="date"
              className="border px-2 py-1 rounded text-black"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Timeline com grid vertical (dias) */}
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#ccc"
            horizontal={false}
            vertical={true}
          />
          <XAxis
            type="number"
            dataKey="date"
            name="Data"
            domain={['auto', 'auto']}
            tickFormatter={(ts: number, index: number) => {
              const d = new Date(ts)
              const dayMonth = d.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit'
              })
              const year = d.getFullYear()

              // pega tick anterior
              const prevYear =
                index > 0 && chartData[index - 1]
                  ? new Date(chartData[index - 1].date).getFullYear()
                  : null

              if (index === 0 || prevYear !== year) {
                return `${dayMonth}/${String(year).slice(2)}`
              }
              return dayMonth
            }}
          />
          <YAxis
            type="category"
            dataKey="company"
            tick={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length > 0) {
                const d = payload[0].payload
                return (
                  <div className="bg-white p-2 border rounded shadow text-sm">
                    <div><strong>Data:</strong> {new Date(d.date).toLocaleDateString('pt-BR')}</div>
                    <div><strong>Empresa:</strong> {d.company}</div>
                    <div><strong>Ticker:</strong> {d.ticker}</div>
                    <div><strong>Tipo:</strong> {d.bulletinType}</div>
                  </div>
                )
              }
              return null
            }}
          />
          <Legend />
          <Scatter name="Boletins" data={chartData} fill="#8884d8" />
        </ScatterChart>
      </ResponsiveContainer>

      {/* Lista de eventos */}
      <div className="mt-8 space-y-4">
        <h2 className="text-xl font-bold mb-2">Eventos (ordenados por data)</h2>
        {events.map(ev => (
          <details key={ev.id} className="border-b pb-1 max-w-4xl">
            <summary className="cursor-pointer font-medium">
              <span className="block w-full">
                {ev.bulletin_date
                  ? new Date(ev.bulletin_date + 'T00:00:00').toLocaleDateString('pt-BR')
                  : ''}{' '}
                — {ev.bulletin_type}
              </span>
            </summary>
            <div className="w-full text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {ev.body_text}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
