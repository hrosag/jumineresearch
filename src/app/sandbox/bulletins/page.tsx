"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Legend,
} from "recharts";

// -----------------------------------------------------------------------------
// Conexão Supabase
// -----------------------------------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Row = {
  bulletin_date: string;
  canonical_type: string;
};

type DataItem = {
  type: string;
  count: number;
  percent: number;
};

export default function BulletinsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [chartData, setChartData] = useState<DataItem[]>([]);
  const [paretoData, setParetoData] = useState<(DataItem & { cumPercent: number })[]>([]);
  const [tableData, setTableData] = useState<DataItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  async function fetchData() {
    const { data, error } = await supabase
      .from("vw_bulletins_with_canonical")
      .select("bulletin_date, canonical_type")
      .not("canonical_type", "is", null);

    if (error) {
      console.error("Erro Supabase:", error.message);
      return;
    }
    if (!data) return;

    // Filtro por data
    let filtered = data as Row[];
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter((d) => new Date(d.bulletin_date) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      filtered = filtered.filter((d) => new Date(d.bulletin_date) <= end);
    }

    // Contagem por tipo
    const counts: Record<string, number> = {};
    filtered.forEach((d) => {
      counts[d.canonical_type] = (counts[d.canonical_type] || 0) + 1;
    });

    const total = Object.values(counts).reduce((sum, v) => sum + v, 0);
    setTotalCount(total);

    // Tabela base
    let tableResult: DataItem[] = Object.entries(counts).map(([type, count]) => ({
      type,
      count,
      percent: (count / total) * 100,
    }));
    tableResult.sort((a, b) => b.percent - a.percent);
    setTableData(tableResult);

    // -------------------------------
    // Regra do "Others": somar a cauda até 10% (ordenando de baixo p/ cima)
    // -------------------------------
    const ascending = [...tableResult].sort((a, b) => a.percent - b.percent);
    const grouped: DataItem[] = [];
    const others: { count: number; percent: number } = { count: 0, percent: 0 };

    for (const item of ascending) {
      if (others.percent + item.percent <= 10) {
        others.count += item.count;
        others.percent += item.percent;
      } else {
        grouped.push(item);
      }
    }

    if (others.count > 0) {
      grouped.push({
        type: "Others",
        count: others.count,
        percent: others.percent,
      });
    }

    // Ordena p/ exibir “TOP → Others” no final
    grouped.sort((a, b) => {
      if (a.type === "Others") return 1;
      if (b.type === "Others") return -1;
      return b.percent - a.percent;
    });

    setChartData(grouped);

    // -------------------------------
    // Dados do PARETO (mesma base do gráfico, com % acumulado)
    // -------------------------------
    const paretoSorted = [...grouped].filter(d => d.type !== "Others")
      .concat(grouped.find(d => d.type === "Others") || [])
      // garante que "Others" fique por último mesmo se não existir
      .filter(Boolean) as DataItem[];

    let acc = 0;
    const pareto = paretoSorted.map((d) => {
      acc += d.percent;
      return { ...d, cumPercent: Math.min(acc, 100) };
    });
    setParetoData(pareto);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Bulletins</h1>
      <p className="text-gray-500 mb-6">
        Distribuição de tipos de boletim (Canonical) — Scatter + Pareto
      </p>

      {/* Filtros */}
      <div className="flex gap-4 items-end mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <button
          onClick={fetchData}
          className="bg-yellow-400 text-black px-4 py-2 rounded hover:bg-yellow-500"
        >
          Buscar
        </button>
      </div>

      {/* Contador */}
      {totalCount > 0 && (
        <div className="mb-6">
          <p className="text-lg font-semibold">
            Total de boletins no período:{" "}
            <span className="text-yellow-600">{totalCount}</span>
          </p>
          <p className="text-sm text-gray-500">Tipos distintos: {tableData.length}</p>
        </div>
      )}

      {/* Charts lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Scatter (50% largura dentro da coluna → fica mais compacto) */}
        {chartData.length > 0 && (
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid />
                <XAxis
                  type="category"
                  dataKey="type"
                  tick={false}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="count"
                  name="Count"
                  label={{ value: "Count", angle: -90, position: "insideLeft" }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null;
                    const item = payload[0].payload;
                    return (
                      <div className="bg-white p-2 border rounded shadow text-sm">
                        <div><strong>{item.type}</strong></div>
                        <div>Count: {item.count}</div>
                        <div>{item.percent.toFixed(1)}%</div>
                      </div>
                    );
                  }}
                />
                <Scatter
                  name="Tipos de Boletim"
                  data={chartData.map((d, idx) => ({ ...d, x: idx }))}
                  fill="#facc15"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pareto (Bar + Line) */}
        {paretoData.length > 0 && (
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={paretoData}
                margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="type"
                  tick={false}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  dataKey="count"
                  label={{ value: "Count", angle: -90, position: "insideLeft" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  label={{ value: "Cumulativo (%)", angle: 90, position: "insideRight" }}
                />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null;
                    const p = payload[0].payload as (DataItem & { cumPercent: number });
                    return (
                      <div className="bg-white p-2 border rounded shadow text-sm">
                        <div><strong>{p.type}</strong></div>
                        <div>Count: {p.count}</div>
                        <div>{p.percent.toFixed(1)}%</div>
                        <div>Acumulado: {p.cumPercent.toFixed(1)}%</div>
                      </div>
                    );
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="count" name="Count" />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumPercent"
                  name="Cumulativo %"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h2 className="text-lg font-semibold mb-2">Tipos de Boletim</h2>
        {tableData.length === 0 ? (
          <p className="text-gray-400">Nenhum resultado encontrado</p>
        ) : (
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-gray-200">
                <th className="border px-2 py-1 text-left">Bulletin Type</th>
                <th className="border px-2 py-1 text-right">Count</th>
                <th className="border px-2 py-1 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, i) => (
                <tr key={i} className="hover:bg-gray-100">
                  <td className="border px-2 py-1">{row.type}</td>
                  <td className="border px-2 py-1 text-right">{row.count}</td>
                  <td className="border px-2 py-1 text-right">
                    {row.percent.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
