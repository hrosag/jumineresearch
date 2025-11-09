'use client'

import { useEffect, useMemo, useRef, useState, startTransition } from 'react'
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
  dateMs?: number
}

type Option = { value: string; label: string }

type ChartPoint = {
  company: string
  ticker: string
  bulletinType: string
  date: number
}

type TooltipDatum = { payload: ChartPoint }
type TooltipProps = { active?: boolean; payload?: TooltipDatum[] }

const toUtcMs = (iso: string) =>
  Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))

const lowerBound = (arr: number[], x: number) => {
  let l = 0, r = arr.length
  while (l < r) {
    const m = (l + r) >> 1
    if (arr[m] < x) l = m + 1
    else r = m
  }
  return l
}

const upperBound = (arr: number[], x: number) => {
  let l = 0, r = arr.length
  while (l < r) {
    const m = (l + r) >> 1
    if (arr[m] <= x) l = m + 1
    else r = m
  }
  return l
}

function useElementWidth(ref: React.RefObject<HTMLElement>, fallback = 900) {
  const [w, setW] = useState(fallback)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) =>
      setW(Math.round(e.contentRect.width))
    )
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref])
  return w
}

export default function NoticesPage() {
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
  const chartWrapRef = useRef<HTMLDivElement>(null)
  const chartWidth = useElementWidth(chartWrapRef)

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('vw_bulletins_with_canonical')
          .select(
            'id, source_file, company, ticker, bulletin_type, canonical_type, bulletin_date, body_text'
          )
          .throwOnError()

        const norm: Row[] = (data ?? [])
          .filter((r): r is Row => Boolean(r.bulletin_date))
          .map(r => ({
            ...r,
            dateMs: toUtcMs(r.bulletin_date as string)
          }))
          .sort((a, b) => (a.dateMs! - b.dateMs!))

        setRows(norm)

        if (norm.length) {
          const minIso = new Date(norm[0].dateMs!).toISOString().slice(0, 10)
          const maxIso = new Date(norm[norm.length - 1].dateMs!).toISOString().slice(0, 10)
          setStartDate(minIso)
          setEndDate(maxIso)
          setGlobalMin(minIso)
          setGlobalMax(maxIso)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const companies = useMemo(
    () =>
      Array.from(new Set(rows.map(r => r.company).filter(Boolean))).sort() as string[],
    [rows]
  )

  const effectiveCompanies =
    selectedCompanies.includes('__ALL__') ? companies : selectedCompanies

  const baseRows = useMemo(() => {
    if (!rows.length) return []
    const dates = rows.map(r => r.dateMs!) // ordenado
    const sMs = startDate ? toUtcMs(startDate) : dates[0]
    const eMs = endDate ? toUtcMs(endDate) : dates[dates.length - 1]
    const i0 = lowerBound(dates, sMs)
    const i1 = upperBound(dates, eMs)
    const sliced = rows.slice(i0, i1)
    if (!effectiveCompanies.length) return sliced
    const setC = new Set(effectiveCompanies)
    return sliced.filter(r => setC.has(r.company ?? ''))
  }, [rows, startDate, endDate, effectiveCompanies])

  const filtered = useMemo(() => {
    if (!selectedTypes.length) return baseRows
    const setT = new Set(selectedTypes)
    return baseRows.filter(r => setT.has(r.canonical_type ?? ''))
  }, [baseRows, selectedTypes])

  const typesForCompanies = useMemo(() => {
    const src = effectiveCompanies.length ? baseRows : rows
    return Array.from(
      new Set(src.map(r => r.canonical_type).filter(Boolean))
    ).sort() as string[]
  }, [baseRows, rows, effectiveCompanies])

  const events = useMemo(
    () => [...filtered].sort((a, b) => (a.dateMs! - b.dateMs!)),
    [filtered]
  )

  const macro = useMemo(() => ({
    boletins: filtered.length,
    empresas: new Set(filtered.map(r => r.company).filter(Boolean)).size,
    tipos: new Set(filtered.map(r => r.canonical_type).filter(Boolean)).size,
    avisosGerais: filtered.filter(r => !r.company).length,
    arquivos: new Set(filtered.map(r => r.source_file).filter(Boolean)).size
  }), [filtered])

  const chartData: ChartPoint[] = useMemo(() => {
    if (!filtered.length) return []
    const min = filtered[0].dateMs!, max = filtered[filtered.length - 1].dateMs!
    const width = Math.max(1, chartWidth - 1)
    const buckets = new Map<number, ChartPoint>()
    for (const r of filtered) {
      const col = min === max ? 0 : Math.floor((r.dateMs! - min) / (max - min) * width)
      if (!buckets.has(col)) {
        buckets.set(col, {
          company: r.company ?? '—',
          ticker: r.ticker ?? '—',
          bulletinType: r.canonical_type ?? '—',
          date: r.dateMs!
        })
      }
    }
    return Array.from(buckets.values()).sort((a, b) => a.date - b.date)
  }, [filtered, chartWidth])

  const xTicks = useMemo(() => {
    if (!filtered.length) return []
    const out: number[] = []
    const d0 = new Date(filtered[0].dateMs!)
    const d1 = new Date(filtered[filtered.length - 1].dateMs!)
    const cur = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 1))
    while (cur <= d1) {
      out.push(cur.getTime())
      cur.setUTCMonth(cur.getUTCMonth() + 1)
    }
    return out
  }, [filtered])

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
      const w = window.open(url, '_blank', 'noopener,noreferrer')
      if (w) w.opener = null
    }

    if (type === 'txt') {
      const resp = await fetch('/api/reports/storyAll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: selected, startDate, endDate })
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
        <h1 className="text-2xl font-bold">Notices — TSXV 2008</h1>
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
          <label htmlFor="sel-emp" className="font-semibold block mb-2">Selecionar empresa(s)</label>
          <Select<Option, true>
            inputId="sel-emp"
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
              startTransition(() => {
                if (vals.includes('__ALL__')) setSelectedCompanies(['__ALL__'])
                else setSelectedCompanies(vals)
              })
            }}
            placeholder="Escolha as empresas…"
            className={`text-black ${highlightSelect ? 'border-2 border-red-500 animate-pulse' : ''}`}
          />
        </div>

        <div className="flex gap-4 items-end">
          <div>
            <label htmlFor="dt-inicio" className="font-semibold block mb-2">Data inicial</label>
            <input
              id="dt-inicio"
              type="date"
              className="border px-2 py-1 rounded text-black"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="dt-fim" className="font-semibold block mb-2">Data final</label>
            <div className="flex gap-2">
              <input
                id="dt-fim"
                type="date"
                className="border px-2 py-1 rounded text-black"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
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
      <div ref={chartWrapRef}>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              dataKey="date"
              domain={['dataMin', 'dataMax']}
              ticks={xTicks}
              tickFormatter={(ts: number) =>
                new Date(ts).toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' })
              }
            />
            <YAxis type="category" dataKey="company" tick={false} axisLine={false} />
            {filtered.length <= 1200 ? (
              <Tooltip
                isAnimationActive={false}
                content={({ active, payload }: TooltipProps) => {
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
            ) : null}
            <Scatter data={chartData} isAnimationActive={false} shape={<circle r={2} />} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Filtro por tipo - abaixo do gráfico */}
      <div className="w-1/3 my-6">
        <label htmlFor="sel-tipos" className="font-semibold block mb-2">Filtrar por tipo</label>
        <Select<Option, true>
          inputId="sel-tipos"
          isMulti
          options={typesForCompanies.map(t => ({ value: t, label: t }))}
          value={selectedTypes.map(t => ({ value: t, label: t }))}
          onChange={(selected: MultiValue<Option>) => {
            const vals = (selected ?? []).map(s => s.value)
            startTransition(() => setSelectedTypes(vals))
          }}
          placeholder="Escolha tipos…"
          isDisabled={effectiveCompanies.length === 0 && typesForCompanies.length === 0}
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
              {ev.dateMs ? new Date(ev.dateMs).toLocaleDateString('pt-BR') : ''} — {ev.canonical_type ?? '—'}
            </summary>
            <LazyBody text={ev.body_text} />
          </details>
        ))}
        {showEvents < events.length && (
          <button
            onClick={() => setShowEvents(prev => prev + 100)}
            className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Carregar mais
          </button>
        )}
      </div>
    </div>
  )
}

function LazyBody({ text }: { text?: string | null }) {
  const [open, setOpen] = useState(false)
  return (
    <div onFocusCapture={() => setOpen(true)} onMouseOver={() => setOpen(true)}>
      {open ? (
        <div className="w-full text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {text}
        </div>
      ) : null}
    </div>
  )
}
