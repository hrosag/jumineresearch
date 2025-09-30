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
  Legend,
  CartesianGrid,
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

type ChartDatum = Omit<Row, "company" | "ticker" | "bulletin_date"> & {
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

  // Filtro de datas deve usar bulletin_date (string ISO), como em /Notices
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

  const scatterSeries = typeOptions.map((opt) => ({
    ...opt,
    data: filteredChartData.filter((row) => row.canonical_type === opt.canonical),
  }));

  const handleResetFilters = () => {
    setListingStartDate(globalMinDate);
    setListingEndDate(globalMaxDate);
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">New Issuers (TSXV)</h2>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-6 mb-4">
        <div className="flex flex-col">
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input
            type="date"
            value={listingStartDate}
            onChange={(e) => setListingStartDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <div className="flex flex-col">
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input
            type="date"
            value={listingEndDate}
            onChange={(e) => setListingEndDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <div className="flex items-end self-end">
          <button
            onClick={handleResetFilters}
            className="px-3 py-1 bg-gray-200 text-black rounded hover:bg-gray-300"
          >
            🔄 Resetar filtros
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tipos de Boletim</label>
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
              <label htmlFor={opt.value}>
                {opt.label} ({typeCounts[opt.canonical] ?? 0})
              </label>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div>⏳ Carregando...</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={500}>
            <ScatterChart
              margin={{ top: 20, right: 160, bottom: 20, left: 20 }}
            >
              <CartesianGrid />
              <XAxis
                type="number"
                dataKey="date"
                name="Data"
                domain={["auto", "auto"]}
                tickFormatter={(ts: number, index: number) => {
                  const d = new Date(ts);
                  const dayMonth = d.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  });
                  const year = d.getFullYear();
                  const prevYear =
                    index > 0 && filteredChartData[index - 1]
                      ? new Date(filteredChartData[index - 1].date).getFullYear()
                      : null;
                  if (index === 0 || prevYear !== year)
                    return `${dayMonth}/${String(year).slice(2)}`;
                  return dayMonth;
                }}
              />
              {/* Alinhar ao padrão do /Notices: eixo Y oculto (empresa) */}
              <YAxis
                type="category"
                dataKey="company"
                tick={false}
                axisLine={false}
              />
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
              <Legend
                layout="vertical"
                verticalAlign="top"
                align="right"
                wrapperStyle={{
                  paddingLeft: 8,
                  fontSize: 12,
                  lineHeight: "20px",
                }}
              />
              {scatterSeries.map((series) => (
                <Scatter
                  key={series.canonical}
                  name={series.label}
                  data={series.data}
                  fill={series.color}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>

          {/* Tabela de resultados */}
          <div className="mt-6 border rounded-lg p-4 bg-gray-50">
            <h2 className="text-lg font-semibold mb-2">Resultados</h2>
            {filteredChartData.length === 0 ? (
              <p className="text-gray-400">Nenhuma empresa encontrada no filtro.</p>
            ) : (
              <table className="w-full text-sm border">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border px-2 py-1 text-left">Empresa</th>
                    <th className="border px-2 py-1 text-left">Ticker</th>
                    <th className="border px-2 py-1 text-left">Data</th>
                    <th className="border px-2 py-1 text-left">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChartData.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-100">
                      <td className="border px-2 py-1">{row.company}</td>
                      <td className="border px-2 py-1">{row.ticker}</td>
                      <td className="border px-2 py-1">{row.bulletin_date}</td>
                      <td className="border px-2 py-1">{row.canonical_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
