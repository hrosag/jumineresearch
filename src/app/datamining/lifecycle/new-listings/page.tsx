"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
  LabelList,
} from "recharts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ---------------- tipos
type Row = {
  id: number;
  company: string | null;
  ticker: string | null;
  bulletin_date: string | null;
  canonical_type: string | null;
  composite_key: string | null;
  body_text: string | null;
  bulletin_type: string | null; // usado para detectar “mixed”
};
type RowWithTag = Row & { _mixed: boolean };

type ChartDatum = Row & {
  company: string;
  ticker: string;
  bulletin_date: string;
  date: number;
};

type TypeOption = {
  value: string;
  label: string;
  canonical: string;
  color: string;
};

const typeOptions: TypeOption[] = [
  { value: "NEW LISTING-IPO-SHARES",  label: "IPO",    canonical: "NEW LISTING-IPO-SHARES",  color: "#1f77b4" },
  { value: "NEW LISTING-CPC-SHARES",  label: "CPC",    canonical: "NEW LISTING-CPC-SHARES",  color: "#2ca02c" },
  { value: "NEW LISTING-SHARES",      label: "Shares", canonical: "NEW LISTING-SHARES",      color: "#ff7f0e" },
];

const defaultSelectedTypes = typeOptions.map(o => o.canonical);

// ---------------- sort helpers p/ tabela
type SortKey = "company" | "ticker" | "composite_key" | "bulletin_date" | "tag";
type SortDir = "asc" | "desc";
type DupMode = "all" | "dup" | "unique";

function valueForSort(r: RowWithTag, key: SortKey): string {
  switch (key) {
    case "company":       return r.company ?? "";
    case "ticker":        return r.ticker ?? "";
    case "composite_key": return r.composite_key ?? "";
    case "bulletin_date": return r.bulletin_date ?? "";
    case "tag":           return r._mixed ? "mixed" : "";
  }
}
function sortRows(rows: RowWithTag[], key: SortKey, dir: SortDir) {
  const mul = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = valueForSort(a, key);
    const bv = valueForSort(b, key);
    if (av < bv) return -1 * mul;
    if (av > bv) return  1 * mul;
    return 0;
  });
}

// ---------------- página
export default function NewListingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [listingStartDate, setListingStartDate] = useState("");
  const [listingEndDate,   setListingEndDate]   = useState("");
  const [globalMinDate,    setGlobalMinDate]    = useState("");
  const [globalMaxDate,    setGlobalMaxDate]    = useState("");

  const [selectedTypes, setSelectedTypes] = useState<string[]>(defaultSelectedTypes);
  const [selectedBody,  setSelectedBody]  = useState<string | null>(null);

  // filtros de tabela (linha de inputs abaixo do header)
  const [fCompany, setFCompany] = useState("");
  const [fTicker,  setFTicker]  = useState("");
  const [fCK,      setFCK]      = useState("");
  const [fDate,    setFDate]    = useState(""); // YYYY ou YYYY-MM
  const [fTag,     setFTag]     = useState(""); // digite “mixed” para apenas mixed
  const [dupMode,  setDupMode]  = useState<DupMode>("all"); // Todos | Duplicados | Únicos

  // sort da tabela
  const [sortKey, setSortKey] = useState<SortKey>("bulletin_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    setListingStartDate("");
    setListingEndDate("");
  }, [selectedTypes]);

  useEffect(() => {
    const fetchData = async () => {
      if (selectedTypes.length === 0) {
        setRows([]); setGlobalMinDate(""); setGlobalMaxDate("");
        setListingStartDate(""); setListingEndDate(""); setLoading(false);
        return;
      }
      setLoading(true);

      // canônicos + mistos na mesma consulta
      const inList = `canonical_type.in.(${selectedTypes.map(s => `"${s}"`).join(",")})`;
      const ilikes = selectedTypes.map(t => `bulletin_type.ilike.%${t}%`);
      const orExpr = [inList, ...ilikes].join(",");

      const { data, error } = await supabase
        .from("vw_bulletins_with_canonical")
        .select("id, company, ticker, bulletin_date, canonical_type, composite_key, body_text, bulletin_type")
        .or(orExpr)
        .order("bulletin_date", { ascending: true });

      if (error) {
        console.error("Erro Supabase:", error.message);
        setRows([]); setGlobalMinDate(""); setGlobalMaxDate("");
      } else {
        const fetched = (data || []) as Row[];
        setRows(fetched);
        const dates = fetched.map(r => r.bulletin_date).filter(Boolean) as string[];
        if (dates.length) {
          const minDate = dates.reduce((a, b) => (a < b ? a : b));
          const maxDate = dates.reduce((a, b) => (a > b ? a : b));
          setGlobalMinDate(minDate); setGlobalMaxDate(maxDate);
          setListingStartDate(p => p || minDate); setListingEndDate(p => p || maxDate);
        } else {
          setGlobalMinDate(""); setGlobalMaxDate("");
          setListingStartDate(""); setListingEndDate("");
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [selectedTypes]);

  // gráficos: apenas canônicos
  const chartData: ChartDatum[] = rows
    .filter(
      (r): r is Row & { bulletin_date: string } =>
        Boolean(r.bulletin_date) &&
        r.canonical_type !== null &&
        selectedTypes.includes(r.canonical_type),
    )
    .map((r) => ({
      ...r,
      ticker: r.ticker ?? "—",
      company: r.company ?? "—",
      bulletin_date: r.bulletin_date!,
      date: new Date(`${r.bulletin_date}T00:00:00`).getTime(),
    }));

  const filteredChartData = chartData.filter((r) => {
    const s = !listingStartDate || r.bulletin_date >= listingStartDate;
    const e = !listingEndDate   || r.bulletin_date <= listingEndDate;
    return s && e;
  });

  const typeCounts = filteredChartData.reduce<Record<string, number>>((acc, r) => {
    const t = r.canonical_type!;
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  const total = Object.values(typeCounts).reduce((a, v) => a + v, 0);

  const proportionData = [...typeOptions]
    .map((opt) => ({
      name: opt.label,
      value: typeCounts[opt.canonical] ?? 0,
      percent: total ? ((typeCounts[opt.canonical] ?? 0) / total) * 100 : 0,
      color: opt.color,
    }))
    .sort((a, b) => b.value - a.value);

  const scatterSeries = typeOptions.map((opt) => ({
    ...opt,
    data: filteredChartData.filter((r) => r.canonical_type === opt.canonical),
  }));

  const handleResetFilters = () => {
    setListingStartDate(globalMinDate);
    setListingEndDate(globalMaxDate);
  };

  // agrupamento para TABELA: canônicos + mixed
  const groupedByType = useMemo(() => {
    const map: Record<string, RowWithTag[]> = {};
    const sel = new Set(selectedTypes);

    for (const r of rows) {
      if (!r.bulletin_date) continue;
      if (listingStartDate && r.bulletin_date < listingStartDate) continue;
      if (listingEndDate   && r.bulletin_date > listingEndDate)   continue;

      const canonical = r.canonical_type ?? "";
      const btUpper = (r.bulletin_type || "").toUpperCase();

      if (canonical && sel.has(canonical)) {
        (map[canonical] ||= []).push({ ...r, _mixed: false });
        continue;
      }
      for (const t of selectedTypes) {
        if (btUpper.includes(t.toUpperCase())) {
          (map[t] ||= []).push({ ...r, _mixed: true });
          break;
        }
      }
    }
    return map;
  }, [rows, selectedTypes, listingStartDate, listingEndDate]);

  // ticks de início de ano (gráfico)
  const yearTicks: number[] = [];
  if (globalMinDate && globalMaxDate) {
    const y0 = new Date(globalMinDate).getFullYear();
    const y1 = new Date(globalMaxDate).getFullYear();
    for (let y = y0; y <= y1; y++) yearTicks.push(new Date(`${y}-01-01T00:00:00`).getTime());
  }

  const renderScatterChart = (data: ChartDatum[], color: string, height = 150) => (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
        <CartesianGrid />
        <XAxis
          type="number"
          dataKey="date"
          domain={[
            globalMinDate ? new Date(globalMinDate).getTime() : "auto",
            globalMaxDate ? new Date(globalMaxDate).getTime() : "auto",
          ]}
          tickFormatter={(ts) =>
            new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
          }
        />
        <YAxis type="category" dataKey="company" tick={false} axisLine={false} width={0} />
        {yearTicks.map((ts) => (
          <ReferenceLine key={ts} x={ts} stroke="#999" strokeDasharray="3 3" />
        ))}
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (active && payload && payload.length > 0) {
              const d = payload[0].payload as ChartDatum;
              return (
                <div className="bg-white p-2 border rounded shadow text-sm">
                  <div><strong>Data:</strong> {new Date(d.date).toLocaleDateString("pt-BR")}</div>
                  <div><strong>Empresa:</strong> {d.company}</div>
                  <div><strong>Ticker:</strong> {d.ticker}</div>
                  <div><strong>Tipo:</strong> {d.canonical_type ?? "—"}</div>
                </div>
              );
            }
            return null;
          }}
        />
        <Scatter data={data} fill={color} />
      </ScatterChart>
    </ResponsiveContainer>
  );

  // tabela: cabeçalho sortável
  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };
  const Th = ({ label, k }: { label: string; k: SortKey }) => {
    const active = sortKey === k;
    const arrow = !active ? "" : sortDir === "asc" ? " ▲" : " ▼";
    return (
      <th
        className="border px-2 py-1 text-left"
        style={{ cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" }}
        onClick={() => onSort(k)}
        title="Ordenar"
      >
        {label}{arrow}
      </th>
    );
  };

  // filtros por coluna
  const matchDateText = (d: string | null, q: string): boolean => {
    if (!q) return true;
    if (!d) return false;
    if (/^\d{4}$/.test(q))       return d.startsWith(q);     // YYYY
    if (/^\d{4}-\d{2}$/.test(q)) return d.startsWith(q);     // YYYY-MM
    return d.includes(q);
  };
  const matchesTableFilters = (r: RowWithTag, dupTickers: Set<string>): boolean => {
    if (fCompany && !(r.company || "").toUpperCase().includes(fCompany.toUpperCase())) return false;
    if (fTicker  && !(r.ticker  || "").toUpperCase().includes(fTicker.toUpperCase()))   return false;
    if (fCK      && !(r.composite_key || "").toUpperCase().includes(fCK.toUpperCase())) return false;
    if (fDate    && !matchDateText(r.bulletin_date, fDate))                              return false;
    if (fTag) {
      const tag = r._mixed ? "mixed" : "";
      if (!tag.toUpperCase().includes(fTag.toUpperCase())) return false;
    }
    const t = (r.ticker || "").toUpperCase();
    if (dupMode === "dup"    && !dupTickers.has(t)) return false;
    if (dupMode === "unique" &&  dupTickers.has(t)) return false;
    return true;
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">New Issuers (TSXV)</h2>

      {/* datas + tipos + gráfico proporção */}
      <div className="flex flex-wrap items-start gap-6 mb-4">
        <div className="flex items-end gap-2">
          <div className="flex flex-col">
            <label className="text-sm font-medium">Start</label>
            <input type="date" value={listingStartDate}
              onChange={(e) => setListingStartDate(e.target.value)}
              className="border rounded px-2 py-1" />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium">End</label>
            <input type="date" value={listingEndDate}
              onChange={(e) => setListingEndDate(e.target.value)}
              className="border rounded px-2 py-1" />
          </div>
          <button onClick={handleResetFilters}
            className="mb-1 px-3 py-1 bg-gray-200 text-black rounded hover:bg-gray-300"
            title="Resetar data">🔄</button>
        </div>

        <div className="flex gap-6 flex-1">
          <div>
            <label className="block text-sm font-medium mb-1">Tipos de Boletim</label>
            {typeOptions.map((opt) => (
              <div key={opt.value} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={opt.value}
                  checked={selectedTypes.includes(opt.canonical)}
                  onChange={() => {
                    const c = opt.canonical;
                    setSelectedTypes(prev =>
                      prev.includes(c) ? prev.filter(t => t !== c) : [...prev, c]
                    );
                  }}
                  className="h-4 w-4"
                />
                <label htmlFor={opt.value} className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: opt.color }} />
                  {opt.label} ({(filteredChartData.filter(r => r.canonical_type === opt.canonical)).length})
                </label>
              </div>
            ))}
            <div className="mt-2 font-semibold text-sm text-right border-t pt-1">Total: {filteredChartData.length}</div>
          </div>

          <div className="flex-1 min-w-[250px] h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={proportionData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 30 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={60} />
                <Tooltip formatter={(v: number | string) => typeof v === "number" ? `${v.toFixed(1)}%` : v} />
                <Bar dataKey="percent">
                  {proportionData.map((e, i) => (<Cell key={i} fill={e.color} />))}
                  <LabelList dataKey="percent" position="right"
                    formatter={(l: unknown) => typeof l === "number" ? `${l.toFixed(1)}%` : (typeof l === "string" ? l : "")} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {loading ? (
        <div>⏳ Carregando...</div>
      ) : (
        <>
          {/* scatter principal */}
          <div className="mb-2">
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid />
                <XAxis
                  type="number"
                  dataKey="date"
                  domain={[
                    globalMinDate ? new Date(globalMinDate).getTime() : "auto",
                    globalMaxDate ? new Date(globalMaxDate).getTime() : "auto",
                  ]}
                  tickFormatter={(ts) => new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                />
                <YAxis type="category" dataKey="company" tick={false} axisLine={false} width={0} />
                {yearTicks.map((ts) => (<ReferenceLine key={ts} x={ts} stroke="#999" strokeDasharray="3 3" />))}
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const d = payload[0].payload as ChartDatum;
                      return (
                        <div className="bg-white p-2 border rounded shadow text-sm">
                          <div><strong>Data:</strong> {new Date(d.date).toLocaleDateString("pt-BR")}</div>
                          <div><strong>Empresa:</strong> {d.company}</div>
                          <div><strong>Ticker:</strong> {d.ticker}</div>
                          <div><strong>Tipo:</strong> {d.canonical_type ?? "—"}</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {typeOptions.map((opt) =>
                  selectedTypes.includes(opt.canonical) ? (
                    <Scatter
                      key={opt.canonical}
                      data={scatterSeries.find((s) => s.canonical === opt.canonical)?.data || []}
                      fill={opt.color}
                    />
                  ) : null
                )}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* mini-scatter por tipo */}
          <div className="flex gap-4 mt-4">
            {typeOptions.map((opt) =>
              selectedTypes.includes(opt.canonical) ? (
                <div key={opt.value} className="w-1/3">
                  <h3 className="text-sm font-semibold mb-1 text-center flex items-center justify-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: opt.color }} />
                    {opt.label}
                  </h3>
                  {renderScatterChart(
                    scatterSeries.find((s) => s.canonical === opt.canonical)?.data || [],
                    opt.color
                  )}
                </div>
              ) : null
            )}
          </div>

          {/* tabela agrupada por tipo com “mixed” + filtros NOS HEADERS + filtro de duplicados */}
          <div className="mt-6 border rounded-lg p-4 bg-gray-50">
            <h2 className="text-lg font-semibold mb-2">Resultados</h2>

            {typeOptions
              .filter((opt) => (groupedByType[opt.canonical] || []).length > 0)
              .map((opt) => {
                const allRows = groupedByType[opt.canonical] || [];
                const totalGroup = allRows.length;
                const mixedCount  = allRows.filter(r => r._mixed).length;

                // set de tickers duplicados deste grupo
                const counts = new Map<string, number>();
                for (const r of allRows) {
                  const t = (r.ticker || "").toUpperCase();
                  if (!t) continue;
                  counts.set(t, (counts.get(t) || 0) + 1);
                }
                const dupTickers = new Set(
                  Array.from(counts.entries()).filter(([, c]) => c >= 2).map(([t]) => t)
                );

                const filtered = allRows.filter(r => matchesTableFilters(r, dupTickers));
                const sorted   = sortRows(filtered, sortKey, sortDir);

                return (
                  <details key={opt.canonical} className="mb-4 border rounded">
                    <summary className="cursor-pointer bg-gray-200 px-2 py-1 font-medium">
                      {opt.canonical} ({totalGroup})
                      {mixedCount ? (
                        <span className="ml-2 inline-flex items-center rounded border px-2 py-0.5 text-xs opacity-80">
                          mixed {mixedCount}
                        </span>
                      ) : null}
                    </summary>

                    <table className="w-full text-sm border table-fixed">
                      <thead>
                        <tr className="bg-gray-100">
                          <Th label="Empresa"       k="company" />
                          <Th label="Ticker"        k="ticker" />
                          <Th label="Composite Key" k="composite_key" />
                          <Th label="Data"          k="bulletin_date" />
                          <Th label="Tag"           k="tag" />
                        </tr>
                        <tr className="bg-white">
                          <th className="border px-2 py-1">
                            <input className="w-full border px-2 py-0.5" placeholder="Filtrar"
                              value={fCompany} onChange={(e) => setFCompany(e.target.value)} />
                          </th>
                          <th className="border px-2 py-1">
                            <div className="flex items-center gap-2">
                              <input className="flex-1 border px-2 py-0.5" placeholder="Filtrar"
                                value={fTicker} onChange={(e) => setFTicker(e.target.value)} />
                              <select
                                className="border px-1 py-0.5 text-xs"
                                value={dupMode}
                                onChange={(e) => setDupMode(e.target.value as DupMode)}
                                title="Duplicados"
                              >
                                <option value="all">Todos</option>
                                <option value="dup">Duplicados</option>
                                <option value="unique">Únicos</option>
                              </select>
                            </div>
                          </th>
                          <th className="border px-2 py-1">
                            <input className="w-full border px-2 py-0.5" placeholder="Filtrar"
                              value={fCK} onChange={(e) => setFCK(e.target.value)} />
                          </th>
                          <th className="border px-2 py-1">
                            <input className="w-full border px-2 py-0.5" placeholder="YYYY ou YYYY-MM"
                              value={fDate} onChange={(e) => setFDate(e.target.value)} />
                          </th>
                          <th className="border px-2 py-1">
                            <input className="w-full border px-2 py-0.5" placeholder="Filtrar"
                              value={fTag} onChange={(e) => setFTag(e.target.value)} />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((row) => (
                          <tr key={row.id} className="hover:bg-gray-50">
                            <td className="border px-2 py-1">{row.company}</td>
                            <td className="border px-2 py-1">{row.ticker}</td>
                            <td className="border px-2 py-1">
                              <button
                                type="button"
                                onClick={() => setSelectedBody(row.body_text)}
                                className="text-blue-600 hover:underline"
                              >
                                {row.composite_key ?? "—"}
                              </button>
                            </td>
                            <td className="border px-2 py-1">{row.bulletin_date ?? "—"}</td>
                            <td className="border px-2 py-1">
                              {row._mixed ? (
                                <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs opacity-80">
                                  mixed
                                </span>
                              ) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                );
              })}
          </div>

          {selectedBody && (
            <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30">
              <div className="relative bg-white rounded-lg shadow-lg max-w-2xl w-full max-height[80vh] overflow-y-auto p-6">
                <button
                  type="button"
                  className="absolute top-3 right-3 text-sm text-gray-600 hover:text-gray-800"
                  onClick={() => setSelectedBody(null)}
                >
                  Fechar
                </button>
                <div className="flex justify-between items-center mb-4 pr-12">
                  <h3 className="text-lg font-semibold">Boletim Completo</h3>
                </div>
                <pre className="whitespace-pre-wrap text-sm">{selectedBody}</pre>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
