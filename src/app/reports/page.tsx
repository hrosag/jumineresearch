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
  bulletin_date: string | null
  body_text: string | null
}

type CompanyOption = { value: string; label: string }

export default function ReportsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [highlightSelect, setHighlightSelect] = useState(false)

  const router = useRouter()

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('all_data')
        .select('id, source_file, company, ticker, bulletin_type, bulletin_date, body_text')
        .throwOnError()

      if (!error && data) {
        setRows(data as Row[])
        const dates = data.map(r => r.bulletin_date).filter(Boolean) as string[]
        if (dates.length) {
          const minDate = dates.reduce((a, b) => (a < b ? a : b))
          const maxDate = dates.reduce((a, b) => (a > b ? a : b))
          setStartDate(minDate)
          setEndDate(maxDate)
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const companies = Array.from(new Set(rows.map(r => r.company).filter(Boolean))).sort() as string[]

  const filtered = rows.filter(r => {
    const companyOk =
      selectedCompanies.length === 0
        ? true
        : selectedCompanies.includes(r.company ?? '')
    const dateOk = r.bulletin_date
      ? (!startDate || r.bulletin_date >= startDate) &&
        (!endDate || r.bulletin_date <= endDate)
      : false
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
    avisosGerais: filtered.filter(r => !r.company).length,
    arquivos: new Set(filtered.map(r => r.source_file).filter(Boolean)).size
  }

  const handleDownload = async (type: 'zip' | 'txt') => {
    if (selectedCompanies.length === 0) {
      setHighlightSelect(true)
      setTimeout(() => setHighlightSelect(false), 2500)
      return
    }

    if (type === 'zip') {
      const url =
        selectedCompanies.length === 1
          ? `/api/reports/story?company=${encodeURIComponent(selectedCompanies[0])}`
          : `/api/reports/story?multi=${encodeURIComponent(selectedCompanies.join(','))}`
      window.open(url, '_blank')
    }

    if (type === 'txt') {
      const resp = await fetch('/api/reports/storyAll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companies: selectedCompanies,
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

  if (loading) return <p className="p-4">Carregando…</p>

  return (
    <div className="p-6">
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

      {/* Filtros */}
      <div className="flex gap-6 mb-6">
        <div className="w-1/2">
          <label className="font-semibold block mb-2">Selecionar empresa(s)</label>
          <Select<CompanyOption, true>
            isMulti
            options={companies.map(c => ({ value: c, label: c }))}
            value={selectedCompanies.map(c => ({ value: c, label: c }))}
            onChange={(selected: MultiValue<CompanyOption>) => {
              const vals = (selected ?? []).map(s => s.value)
              setSelectedCompanies(vals)
            }}
            placeholder="Escolha as empresas…"
            className={`text-black ${highlightSelect ? 'border-2 border-red-500 animate-pulse' : ''}`}
          />
          {highlightSelect && (
            <p className="text-red-600 font-semibold animate-pulse mt-2">
              💡 Selecione ao menos uma empresa antes de fazer download.
            </p>
          )}
        </div>

        <div className="flex gap-4 items-end">
          <div>
            <label className="font-semibold block mb-2">Data inicial</label>
            <input type="date" className="border px-2 py-1 rounded text-black"
              value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="font-semibold block mb-2">Data final</label>
            <input type="date" className="border px-2 py-1 rounded text-black"
              value={endDate} onChange={e => setEndDate(e.target.value)} />
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

      {/* Lista de eventos */}
      <div className="mt-8 space-y-4">
        <h2 className="text-xl font-bold mb-2">Eventos (ordenados por data)</h2>
        {events.map(ev => (
          <details key={ev.id} className="border-b pb-1 max-w-4xl">
            <summary className="cursor-pointer font-medium">
              {ev.bulletin_date
                ? new Date(ev.bulletin_date + 'T00:00:00').toLocaleDateString('pt-BR')
                : ''} — {ev.bulletin_type}
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
