"use client";

import { useEffect, useState } from "react";
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

type Row = {
  id: number;
  company: string | null;
  ticker: string | null;
  bulletin_date: string | null;
  canonical_type: string | null;
};

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
  {
    value: "NEW LISTING-IPO-SHARES",
    label: "IPO",
    canonical: "NEW LISTING-IPO-SHARES",
    color: "#1f77b4",
  },
  {
    value: "NEW LISTING-CPC-SHARES",
    label: "CPC",
    canonical: "NEW LISTING-CPC-SHARES",
    color: "#2ca02c",
  },
  {
    value: "NEW LISTING-SHARES",
    label: "Shares",
    canonical: "NEW LISTING-SHARES",
    color: "#ff7f0e",
  },
];

const defaultSelectedTypes = typeOptions.map((opt) => opt.canonical);

export default function NewListingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingStartDate, setListingStartDate] = useState("");
  const [listingEndDate, setListingEndDate] = useState("");
  const [globalMinDate, setGlobalMinDate] = useState("");
  const [globalMaxDate, setGlobalMaxDate] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    defaultSelectedTypes,
  );

  useEffect(() => {
    setListingStartDate("");
    setListingEndDate("");
  }, [selectedTypes]);

  useEffect(() => {
    const fetchData = async () => {
      if (selectedTypes.length === 0) {
        setRows([]);
        setGlobalMinDate("");
        setGlobalMaxDate("");
        setListingStartDate("");
        setListingEndDate("");
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("vw_bulletins_with_canonical")
        .select("id, company, ticker, bulletin_date, canonical_type")
        .in("canonical_type", selectedTypes)
        .order("bulletin_date", { ascending: true });

      if (error) {
        console.error("Erro Supabase:", error.message);
        setRows([]);
        setGlobalMinDate("");
        setGlobalMaxDate("");
      } else {
        const fetchedRows = (data || []) as Row[];
        setRows(fetchedRows);
        const dates = fetchedRows
          .map((r) => r.bulletin_date)
          .filter(Boolean) as string[];

        if (dates.length > 0) {
          const minDate = dates.reduce((a, b) => (a < b ? a : b));
          const maxDate = dates.reduce((a, b) => (a > b ? a : b));
          setGlobalMinDate(minDate);
          setGlobalMaxDate(maxDate);
          setListingStartDate((prev) => prev || minDate);
          setListingEndDate((prev) => prev || maxDate);
        } else {
          setGlobalMinDate("");
          setGlobalMaxDate("");
          setListingStartDate("");
          setListingEndDate("");
        }
      }
      setLoading(false);
    };

    fetchData();
  }, [selectedTypes]);

  const chartData: ChartDatum[] = rows
    .filter(
      (row): row is Row & { bulletin_date: string } => Boolean(row.bulletin_date),
    )
    .map((row) => ({
      ...row,
      ticker: row.ticker ?? "—",
      company: row.company ?? "—",
      bulletin_date: row.bulletin_date,
      date: new Date(`${row.bulletin_date}T00:00:00`).getTime(),
    }));

  const filteredChartData = chartData.filter((row) => {
    const withinStart =
      !listingStartDate || row.bulletin_date >= listingStartDate;
    const withinEnd = !listingEndDate || row.bulletin_date <= listingEndDate;
    return withinStart && withinEnd;
  });

  const typeCounts = filteredChartData.reduce<Record<string, number>>(
    (acc, row) => {
      const type = row.canonical_type;
      if (!type) return acc;
      acc[type] = (acc[type] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const total = Object.values(typeCounts).reduce(
    (acc, val) => acc + (val ?? 0),
    0,
  );

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
    data: filteredChartData.filter((row) => row.canonical_type === opt.canonical),
  }));

  const handleResetFilters = () => {
    setListingStartDate(globalMinDate);
    setListingEndDate(globalMaxDate);
  };

  // agrupar dinamicamente por tipo
  const groupedByType = filteredChartData.reduce<
    Record<string, ChartDatum[]>
  >((acc, row) => {
    if (!row.canonical_type) return acc;
    acc[row.canonical_type] = acc[row.canonical_type] || [];
    acc[row.canonical_type].push(row);
    return acc;
  }, {});

  // ticks de início de ano
  const yearTicks: number[] = [];
  if (globalMinDate && globalMaxDate) {
    const startYear = new Date(globalMinDate).getFullYear();
    const endYear = new Date(globalMaxDate).getFullYear();
    for (let y = startYear; y <= endYear; y++) {
      yearTicks.push(new Date(`${y}-01-01T00:00:00`).getTime());
    }
  }

  const renderScatterChart = (
    data: ChartDatum[],
    color: string,
    height = 150,
  ) => (
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
            new Date(ts).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })
          }
        />
        <YAxis
          type="category"
          dataKey="company"
          tick={false}
          axisLine={false}
          width={0}
        />
        {yearTicks.map((ts) => (
          <ReferenceLine
            key={ts}
            x={ts}
            stroke="#999"
            strokeDasharray="3 3"
            label={{
              value: new Date(ts).getFullYear().toString(),
              position: "top",
              angle: -75,
              style: { fill: "#444", fontSize: 12 },
            }}
          />
        ))}
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (active && payload && payload.length > 0) {
              const datum = payload[0].payload as ChartDatum;
              return (
                <div className="bg-white p-2 border rounded shadow text-sm">
                  <div>
                    <strong>Data:</strong>{" "}
                    {new Date(datum.date).toLocaleDateString("pt-BR")}
                  </div>
                  <div>
                    <strong>Empresa:</strong> {datum.company}
                  </div>
                  <div>
                    <strong>Ticker:</strong> {datum.ticker}
                  </div>
                  <div>
                    <strong>Tipo:</strong> {datum.canonical_type ?? "—"}
                  </div>
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

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">New Issuers (TSXV)</h2>

      {/* filtros + tipos + gráfico lado a lado */}
      <div className="flex flex-wrap items-start gap-6 mb-4">
        {/* filtros compactos */}
        <div className="flex items-end gap-2">
          <div className="flex flex-col">
            <label className="text-sm font-medium">Start</label>
            <input
              type="date"
              value={listingStartDate}
              onChange={(e) => setListingStartDate(e.target.value)}
              className="border rounded px-2 py-1"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium">End</label>
            <input
              type="date"
              value={listingEndDate}
              onChange={(e) => setListingEndDate(e.target.value)}
              className="border rounded px-2 py-1"
            />
          </div>
          <button
            onClick={handleResetFilters}
            className="mb-1 px-3 py-1 bg-gray-200 text-black rounded hover:bg-gray-300"
          >
            🔄
          </button>
        </div>

        {/* tipos + gráfico */}
        <div className="flex gap-6 flex-1">
          <div>
            <label className="block text-sm font-medium mb-1">
              Tipos de Boletim
            </label>
            {typeOptions.map((opt) => (
              <div key={opt.value} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={opt.value}
                  checked={selectedTypes.includes(opt.canonical)}
                  onChange={() => {
                    const canonical = opt.canonical;
                    setSelectedTypes((prev) =>
                      prev.includes(canonical)
                        ? prev.filter((t) => t !== canonical)
                        : [...prev, canonical]
                    );
                  }}
                  className="h-4 w-4"
                />
                <label htmlFor={opt.value} className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: opt.color }}
                  />
                  {opt.label} ({typeCounts[opt.canonical] ?? 0})
                </label>
              </div>
            ))}
            <div className="mt-2 font-semibold text-sm text-right border-t pt-1">
              Total: {total}
            </div>
          </div>

          {/* gráfico proporção */}
          <div className="flex-1 min-w-[250px] h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={proportionData}
                layout="vertical"
                margin={{ top: 5, right: 20, bottom: 5, left: 30 }}
              >
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={60} />
                <Tooltip
                  formatter={(value: number | string) =>
                    typeof value === "number" ? `${value.toFixed(1)}%` : value
                  }
                />
                <Bar dataKey="percent">
                  {proportionData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="percent"
                    position="right"
                    formatter={(label: any) =>
                      typeof label === "number" ? `${label.toFixed(1)}%` : label
                    }
                  />
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
                  tickFormatter={(ts) =>
                    new Date(ts).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })
                  }
                />
                <YAxis
                  type="category"
                  dataKey="company"
                  tick={false}
                  axisLine={false}
                  width={0}
                />
                {yearTicks.map((ts) => (
                  <ReferenceLine
                    key={ts}
                    x={ts}
                    stroke="#999"
                    strokeDasharray="3 3"
                  />
                ))}
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const datum = payload[0].payload as ChartDatum;
                      return (
                        <div className="bg-white p-2 border rounded shadow text-sm">
                          <div>
                            <strong>Data:</strong>{" "}
                            {new Date(datum.date).toLocaleDateString("pt-BR")}
                          </div>
                          <div>
                            <strong>Empresa:</strong> {datum.company}
                          </div>
                          <div>
                            <strong>Ticker:</strong> {datum.ticker}
                          </div>
                          <div>
                            <strong>Tipo:</strong> {datum.canonical_type ?? "—"}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {scatterSeries.map((series) => (
                  <Scatter
                    key={series.canonical}
                    data={series.data}
                    fill={series.color}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* mini-scatter por tipo */}
          <div className="flex gap-4 mt-4">
            {typeOptions.map((opt) =>
              selectedTypes.includes(opt.canonical) ? (
                <div key={opt.value} className="w-1/3">
                  <h3 className="text-sm font-semibold mb-1 text-center flex items-center justify-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ backgroundColor: opt.color }}
                    />
                    {opt.label}
                  </h3>
                  {renderScatterChart(
                    scatterSeries.find((s) => s.canonical === opt.canonical)
                      ?.data || [],
                    opt.color,
                  )}
                </div>
              ) : null,
            )}
          </div>

          {/* tabela agrupada por tipo */}
          <div className="mt-6 border rounded-lg p-4 bg-gray-50">
            <h2 className="text-lg font-semibold mb-2">Resultados</h2>
            {Object.keys(groupedByType).length === 0 ? (
              <p className="text-gray-400">Nenhuma empresa encontrada.</p>
            ) : (
              Object.entries(groupedByType).map(([type, rows]) => (
                <details key={type} className="mb-4 border rounded">
                  <summary className="cursor-pointer bg-gray-200 px-2 py-1 font-medium">
                    {type} ({rows.length})
                  </summary>
                  <table className="w-full text-sm border">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-2 py-1 text-left">Empresa</th>
                        <th className="border px-2 py-1 text-left">Ticker</th>
                        <th className="border px-2 py-1 text-left">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="border px-2 py-1">{row.company}</td>
                          <td className="border px-2 py-1">{row.ticker}</td>
                          <td className="border px-2 py-1">{row.bulletin_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

