'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Select from 'react-select'
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  Tooltip,
  Legend
} from 'recharts'

// --- Supabase client --------------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// --- Tipos ------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // Carrega dados do Supabase
  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('all_data')
        .select('id, company, ticker, bulletin_type, bulletin_date, body_text')
      if (error) {
        console.error(error)
      } else {
        setRows(data as Row[])
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  // Empresas únicas (ordenadas)
  const companies = Array.from(
    new Set(rows.map(r => r.company).filter(Boolean))
  ).sort() as string[]

  // Aplica filtro (ou mostra tudo se nada selecionado)
  const filtered = rows.filter(r =>
    selectedCompanies.length === 0
      ? true
      : selectedCompanies.includes(r.company ?? '')
  )

  // Dados do gráfico: converte data para timestamp p/ eixo X
  const chartData = filtered
    .filter(r => r.bulletin_date && r.company)
    .map(r => ({
      company: r.company!,
      date: new Date(r.bulletin_date + 'T00:00:00').getTime(),
      type: r.bulletin_type ?? '—'
    }))

  // Eventos em ordem cronológica
  const events = [...filtered].sort((a, b) =>
    (a.bulletin_date ?? '').localeCompare(b.bulletin_date ?? '')
  )

  // Estatísticas “macro”
  const macro = {
    boletins: filtered.length,
    empresas: new Set(filtered.map(r => r.company)).size,
    tipos: new Set(filtered.map(r => r.bulletin_type)).size,
    avisosGerais: filtered.filter(r => !r.company).length
  }

  if (loading) return <p className="p-4">Carregando…</p>

  // --------------------------------------------------------------------------
  return (
    <div className="p-6">
      {/* Cabeçalho + botão Gerar Story */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">TSXV 2008 — Storytelling por Empresa</h1>

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

      {/* Painel de estatísticas macro */}
      <div className="grid grid-cols-4 gap-4 text-center mb-6">
        <div>
          <div className="text-3xl font-bold">{macro.boletins}</div>
          <div className="text-sm">Boletins no filtro</div>
        </div>
        <div>
          <div className="text-3xl font-bold">{macro.empresas}</div>
          <div className="text-sm">Empresas distintas</div>
        </div>
        <div>
          <div className="text-3xl font-bold">{macro.tipos}</div>
          <div className="text-sm">Tipos de boletim distintos</div>
        </div>
        <div>
          <div className="text-3xl font-bold">{macro.avisosGerais}</div>
          <div className="text-sm">Avisos gerais (no filtro)</div>
        </div>
      </div>

      {/* --- Dropdown de seleção (react-select) ----------------------------- */}
      <div className="mb-6">
        <label className="font-semibold block mb-2">Selecionar empresa(s)</label>
        <Select
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
          onChange={(selected) => {
            const vals = (selected ?? []).map((s: any) => s.value)
            if (vals.includes('*ALL*')) {
              setSelectedCompanies(companies)
            } else {
              setSelectedCompanies(vals)
            }
          }}
          placeholder="Escolha as empresas…"
          className="text-black"
        />
      </div>

      {/* ---- Timeline (sem YAxis de empresa) ---- */}
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <XAxis
            type="number"
            dataKey="date"
            name="Data"
            domain={['auto', 'auto']}
            tickFormatter={ts => new Date(ts).toLocaleDateString('pt-BR')}
          />
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

      {/* Lista de eventos */}
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
            <div className="pl-4 text-sm text-gray-700 whitespace-pre-wrap">
              {ev.body_text}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
