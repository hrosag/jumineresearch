'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Row = {
  id: number
  block_id: number
  company: string | null
  ticker: string | null
  bulletin_type: string | null
  bulletin_date: string | null // YYYY-MM-DD
  tier: string | null
}

type HiddenCols = {
  body_text: string | null
  composite_key: string | null
}

type FullRow = Row & HiddenCols
type SortColumn = keyof Row | null
type SortDirection = 'asc' | 'desc'

export default function ViewAllData() {
  const [rows, setRows] = useState<Row[]>([])
  const [hiddenCols, setHiddenCols] = useState<HiddenCols[]>([])
  const [loading, setLoading] = useState(true)

  // filtros de texto
  const [filterBlockId, setFilterBlockId] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [filterTicker, setFilterTicker] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterTier, setFilterTier] = useState('')

  // intervalo de datas
  const [minDate, setMinDate] = useState('')
  const [maxDate, setMaxDate] = useState('')

  // ordenação
  const [sortColumn, setSortColumn] = useState<SortColumn>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // 🔑 controle de senha para habilitar exportação
  const [authorized, setAuthorized] = useState(false)

  const searchParams = useSearchParams()

  // pré-preenche filtros de data da URL
  useEffect(() => {
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    if (start) setMinDate(start)
    if (end) setMaxDate(end)
  }, [searchParams])

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('all_data')
        .select(
          'id, block_id, company, ticker, bulletin_type, bulletin_date, tier, body_text, composite_key'
        )
        .range(0, Number.MAX_SAFE_INTEGER)

      if (error) {
        console.error(error)
      } else {
        const fullData = data as FullRow[]
        setRows(fullData.map(({ body_text, composite_key, ...visible }) => visible))
        setHiddenCols(
          fullData.map(({ body_text, composite_key }) => ({
            body_text,
            composite_key,
          }))
        )
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  function check(val: string | number | null, filter: string) {
    if (!filter) return true
    if (filter === 'is:null') return !val || String(val).trim() === ''
    return String(val ?? '').toLowerCase().includes(filter.toLowerCase())
  }

  const filtered = rows.filter((r) => {
    const textOk =
      check(r.block_id, filterBlockId) &&
      check(r.company, filterCompany) &&
      check(r.ticker, filterTicker) &&
      check(r.bulletin_type, filterType) &&
      check(r.tier, filterTier)

    const dateOk = r.bulletin_date
      ? (!minDate || new Date(r.bulletin_date) >= new Date(minDate)) &&
        (!maxDate || new Date(r.bulletin_date) <= new Date(maxDate))
      : false

    return textOk && dateOk
  })

  const sorted = [...filtered].sort((a, b) => {
    if (!sortColumn) return 0
    const valA = a[sortColumn]
    const valB = b[sortColumn]
    if (valA == null) return 1
    if (valB == null) return -1
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  function sanitizeCell(text: string | null) {
    if (!text) return ''
    return text.replace(/(\r\n|\n|\r)/g, ' ')
  }

  function exportTxt() {
    if (filtered.length === 0) {
      alert('Nenhum registro para exportar')
      return
    }

    const header = [
      'Date',
      'Block_ID',
      'Company',
      'Ticker',
      'Type',
      'Tier',
      'Body_Text',
      'Composite_Key',
    ].join(' | ')

    const lines = filtered.map((r, idx) => {
      const hidden = hiddenCols[idx] || { body_text: '', composite_key: '' }
      const date = r.bulletin_date
        ? new Date(r.bulletin_date + 'T00:00:00').toLocaleDateString('pt-BR')
        : ''
      return [
        date,
        r.block_id ?? '',
        r.company ?? '',
        r.ticker ?? '',
        r.bulletin_type ?? '',
        r.tier ?? '',
        sanitizeCell(hidden.body_text),
        sanitizeCell(hidden.composite_key),
      ].join(' | ')
    })

    const content = [header, ...lines].join('\n')

    const fmt = (d: string) => d.replaceAll('-', '')
    const startStr = minDate ? fmt(minDate) : 'inicio'
    const endStr = maxDate ? fmt(maxDate) : 'fim'
    const filename = `all_data_export_TSXV_${startStr}_${endStr}.txt`

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function askPassword() {
    const pwd = prompt('Digite a senha de administrador para exportar:')
    if (pwd === process.env.NEXT_PUBLIC_DBADMIN_PASSWORD) {
      setAuthorized(true)
    } else {
      alert('Senha incorreta.')
    }
  }

  if (loading) return <p className="p-4">Carregando…</p>

  const sortIndicator = (col: SortColumn) => {
    if (sortColumn !== col) return ''
    return sortDirection === 'asc' ? ' ▲' : ' ▼'
  }

  return (
    <div className="p-6 select-none">
      <h1 className="text-2xl font-bold mb-4">All Data (visualização)</h1>

      {authorized ? (
        <button
          onClick={exportTxt}
          className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          📥 Exportar TXT
        </button>
      ) : (
        <button
          onClick={askPassword}
          className="mb-4 px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
        >
          🔒 Digite a senha para habilitar exportação
        </button>
      )}

      <div className="flex gap-4 mb-4 items-end">
        <div>
          <label className="block text-sm font-semibold">Data mínima</label>
          <input
            type="date"
            className="border rounded p-1 text-sm"
            value={minDate}
            onChange={(e) => setMinDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold">
            Data máxima
            <span className="ml-2 text-gray-600 text-xs">
              ({filtered.length} registros)
            </span>
          </label>
          <input
            type="date"
            className="border rounded p-1 text-sm"
            value={maxDate}
            onChange={(e) => setMaxDate(e.target.value)}
          />
        </div>
      </div>

      <table className="table-auto border-collapse w-full text-sm">
        <thead>
          <tr>
            <th
              className="border px-4 py-2 cursor-pointer"
              onClick={() => handleSort('bulletin_date')}
            >
              Date{sortIndicator('bulletin_date')}
            </th>
            <th
              className="border px-4 py-2 cursor-pointer"
              onClick={() => handleSort('block_id')}
            >
              Block ID{sortIndicator('block_id')}
              <input
                className="mt-1 w-full p-1 border rounded text-sm"
                placeholder="Filtrar"
                value={filterBlockId}
                onChange={(e) => setFilterBlockId(e.target.value)}
              />
            </th>
            <th
              className="border px-4 py-2 cursor-pointer"
              onClick={() => handleSort('company')}
            >
              Company{sortIndicator('company')}
              <input
                className="mt-1 w-full p-1 border rounded text-sm"
                placeholder="Filtrar"
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
              />
            </th>
            <th
              className="border px-4 py-2 cursor-pointer"
              onClick={() => handleSort('ticker')}
            >
              Ticker{sortIndicator('ticker')}
              <input
                className="mt-1 w-full p-1 border rounded text-sm"
                placeholder="Filtrar"
                value={filterTicker}
                onChange={(e) => setFilterTicker(e.target.value)}
              />
            </th>
            <th
              className="border px-4 py-2 cursor-pointer"
              onClick={() => handleSort('bulletin_type')}
            >
              Type{sortIndicator('bulletin_type')}
              <input
                className="mt-1 w-full p-1 border rounded text-sm"
                placeholder="Filtrar"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              />
            </th>
            <th
              className="border px-4 py-2 cursor-pointer"
              onClick={() => handleSort('tier')}
            >
              Tier{sortIndicator('tier')}
              <input
                className="mt-1 w-full p-1 border rounded text-sm"
                placeholder="Filtrar"
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
              />
            </th>
          </tr>
        </thead>

        <tbody>
          {sorted.map((r) => (
            <tr key={r.id}>
              <td className="border px-4 py-2">
                {r.bulletin_date
                  ? new Date(r.bulletin_date + 'T00:00:00').toLocaleDateString('pt-BR')
                  : ''}
              </td>
              <td className="border px-4 py-2">{r.block_id}</td>
              <td className="border px-4 py-2">{r.company}</td>
              <td className="border px-4 py-2">{r.ticker}</td>
              <td className="border px-4 py-2">{r.bulletin_type}</td>
              <td className="border px-4 py-2">{r.tier}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
