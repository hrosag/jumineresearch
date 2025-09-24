'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
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
  source_file: string | null
  company: string | null
  ticker: string | null
  bulletin_type: string | null
  canonical_type: string | null
  bulletin_date: string | null
  body_text: string | null
}

type Option = { value: string; label: string }

export default function ReportsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [globalMin, setGlobalMin] = useState('')
  const [globalMax, setGlobalMax] = useState('')
  const [highlightSelect, setHighlightSelect] = useState(false)
  const [showEvents, setShowEvents] = useState(50)

  const router = useRouter()

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('vw_bulletins_with_canonical')
        .select('id, source_file, company, ticker, bulletin_type, canonical_type, bulletin_date, body_text')
        .throwOnError()

      if (!error && data) {
        setRows(data as Row[])
        const dates = data.map(r => r.bulletin_date).filter(Boolean) as string[]
        if (dates.length) {
          const minDate = dates.reduce((a, b) => (a < b ? a : b))
          const maxDate = dates.reduce((a, b) => (a > b ? a : b))
          setStartDate(minDate)
          setEndDate(maxDate)
          setGlobalMin(minDate)
          setGlobalMax(maxDate)
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const companies = Array.from(new Set(rows.map(r => r.company).filter(Boolean))).sort() as string[]

  const effectiveCompanies =
    selectedCompanies.includes('__ALL__') ? companies : selectedCompanies

  const typesForCompanies = Array.from(
    new Set(
      rows
        .filter(r => effectiveCompanies.includes(r.company ?? ''))
        .map(r => r.canonical_type)
        .filter(Boolean)
    )
  ).sort() as string[]

  const filtered = rows.filter(r => {
    const companyOk =
      effectiveCompanies.length === 0 ? true : effectiveCompanies.includes(r.company ?? '')
    const typeOk =
      selectedTypes.length === 0 ? true : selectedTypes.includes(r.canonical_type ?? '')
    const dateOk = r.bulletin_date
      ? (!startDate || r.bulletin_date >= startDate) &&
        (!endDate || r.bulletin_date <= endDate)
      : false
    return companyOk && typeOk && dateOk
  })

  const chartData = filtered
    .filter(r => r.bulletin_date && r.company)
    .map(r => ({
      company: r.company!,
      ticker: r.ticker ?? '—',
      bulletinType: r.canonical_type ?? '—',
      date: new Date(r.bulletin_date + 'T00:00:00').getTime()
    }))

  const events = [...filtered].sort((a, b) =>
    (a.bulletin_date ?? '').localeCompare(b.bulletin_date ?? '')
  )

  const macro = {
    boletins: filtered.length,
    empresas: new Set(filtered.map(r => r.company)).size,
    tipos: new Set(filtered.map(r => r.canonical_type)).size,
    avisosGerais: filtered.filter(r => !r.company).length,
    arquivos: new Set(filtered.map(r => r.source_file).filter(Boolean)).size
  }

  const handleDownload = async (type: 'zip' | 'txt') => {
    if (selectedCompanies.length === 0) {
      setHighlightSelect(true)
      setTimeout(() => setHighlightSelect(false), 2500)
      return
    }

    const selected =
      selectedCompanies.includes('__ALL__') ? companies : selectedCompanies

    if (type === 'zip') {
      const url =
        selected.length === 1
          ? `/api/reports/story?company=${encodeURIComponent(selected[0])}`
          : `/api/reports/story?multi=${encodeURIComponent(selected.join(','))}`
      window.open(url, '_blank')
    }

    if (type === 'txt') {
      const resp = await fetch('/api/reports/storyAll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companies: selected,
          startDate,
          endDate
        })
      })
      if (!resp.ok) {
        alert('Erro ao gerar stories consolidados')
        return
      }
      const blob = await resp.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `stories_consolidado_${startDate.replaceAll('-', '')}_${endDate.replaceAll('-', '')}.txt`
      a.click()
      window.URL.revokeObjectURL(url)
    }
  }

  const openDatabaseView = () => {
    router.push(`/database/view?start=${startDate}&end=${endDate}`)
  }

  const resetFilters = () => {
    setSelectedCompanies([])
    setSelectedTypes([])
    setStartDate(globalMin)
    setEndDate(globalMax)
    setShowEvents(50)
  }

  if (loading) return <p className="p-4">Carregando…</p>

  return (
    <div className="p-6">
      {/* Topo com export */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <h1 className="text-2xl font-bold">TSXV 2008 — Storytelling por Empresa</h1>
        <div className="flex gap-2">
          <button
            onClick={() => handleDownload('zip')}
            className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600"
          >
            📄 Gerar Story (ZIP)
          </button>
          <button
            onClick={() => handleDownload('txt')}
            className="px-4 py-2 bg-green-500 text-black rounded hover:bg-green-600"
          >
            📜 Gerar Stories Consolidado
          </button>
          <button
            onClick={openDatabaseView}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            🔍 Visualizar Banco de Dados
          </button>
        </div>
      </div>

      {/* Painel macro */}
      <div className="flex gap-8 text-center mb-6">
        <div><div className="text-xl font-bold">{macro.boletins}</div><div className="text-xs text-gray-600">Boletins no filtro</div></div>
        <div><div className="text-xl font-bold">{macro.empresas}</div><div className="text-xs text-gray-600">Empresas distintas</div></div>
        <div><div className="text-xl font-bold">{macro.tipos}</div><div className="text-xs text-gray-600">Tipos de boletim distintos</div></div>
        <div><div className="text-xl font-bold">{macro.avisosGerais}</div><div className="text-xs text-gray-600">Avisos Gerais</div></div>
        <div><div className="text-xl font-bold">{macro.arquivos}</div><div className="text-xs text-gray-600">Arquivos no período</div></div>
      </div>

      {/* Filtros principais */}
      <div className="flex gap-6 mb-6">
        <div className="w-1/3">
          <label className="font-semibold block mb-2">Selecionar empresa(s)</label>
          <Select<Option, true>
            isMulti
            options={[
              { value: '__ALL__', label: '🌎 Todas as empresas' },
              ...companies.map(c => ({ value: c, label: c }))
            ]}
            value={
              selectedCompanies.includes('__ALL__')
                ? [{ value: '__ALL__', label: '🌎 Todas as empresas' }]
                : selectedCompanies.map(c => ({ value: c, label: c }))
            }
            onChange={(selected: MultiValue<Option>) => {
              const vals = (selected ?? []).map(s => s.value)
              if (vals.includes('__ALL__')) {
                setSelectedCompanies(['__ALL__'])
              } else {
                setSelectedCompanies(vals)
              }
            }}
            placeholder="Escolha as empresas…"
            className={`text-black ${highlightSelect ? 'border-2 border-red-500 animate-pulse' : ''}`}
          />
        </div>

        <div className="flex gap-4 items-end">
          <div>
            <label className="font-semibold block mb-2">Data inicial</label>
            <input type="date" className="border px-2 py-1 rounded text-black"
              value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="font-semibold block mb-2">Data final</label>
            <div className="flex gap-2">
              <input type="date" className="border px-2 py-1 rounded text-black"
                value={endDate} onChange={e => setEndDate(e.target.value)} />
              <button
                onClick={resetFilters}
                className="px-3 py-1 bg-gray-200 text-black rounded hover:bg-gray-300"
              >
                🔄 Resetar filtros
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ccc" horizontal={false} vertical={true} />
          <XAxis type="number" dataKey="date" name="Data" domain={['auto', 'auto']}
            tickFormatter={(ts: number, index: number) => {
              const d = new Date(ts)
              const dayMonth = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
              const year = d.getFullYear()
              const prevYear = index > 0 && chartData[index - 1]
                ? new Date(chartData[index - 1].date).getFullYear()
                : null
              if (index === 0 || prevYear !== year) return `${dayMonth}/${String(year).slice(2)}`
              return dayMonth
            }}
          />
          <YAxis type="category" dataKey="company" tick={false} axisLine={false} />
          <Tooltip content={({ active, payload }) => {
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
          }} />
          <Legend />
          <Scatter name="Boletins" data={chartData} fill="#8884d8" />
        </ScatterChart>
      </ResponsiveContainer>

      {/* Filtro por tipo - abaixo do gráfico */}
      <div className="w-1/3 my-6">
        <label className="font-semibold block mb-2">Filtrar por tipo</label>
        <Select<Option, true>
          isMulti
          options={typesForCompanies.map(t => ({ value: t, label: t }))}
          value={selectedTypes.map(t => ({ value: t, label: t }))}
          onChange={(selected: MultiValue<Option>) => {
            const vals = (selected ?? []).map(s => s.value)
            setSelectedTypes(vals)
          }}
          placeholder="Escolha tipos…"
          isDisabled={effectiveCompanies.length === 0}
          className="text-black"
        />
      </div>

      {/* Lista de eventos com paginação */}
      <div className="mt-8 space-y-4">
        <h2 className="text-xl font-bold mb-2">
          Eventos (ordenados por data) — Mostrando {Math.min(events.length, showEvents)} de {events.length}
        </h2>
        {events.slice(0, showEvents).map(ev => (
          <details key={ev.id} className="border-b pb-1 max-w-4xl">
            <summary className="cursor-pointer font-medium">
              {ev.bulletin_date
                ? new Date(ev.bulletin_date + 'T00:00:00').toLocaleDateString('pt-BR')
                : ''} — {ev.canonical_type}
            </summary>
            <div className="w-full text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {ev.body_text}
            </div>
          </details>
        ))}
        {showEvents < events.length && (
          <button
            onClick={() => setShowEvents(prev => prev + 50)}
            className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Carregar mais
          </button>
        )}
      </div>
    </div>
  )
}
