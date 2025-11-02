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
  composite_key: string | null;
  body_text: string | null;
};

type ChartDatum = Row & {
  company: string;
  dateNum: number;
};

const CPC_CANONICAL = "NEW LISTING-CPC-SHARES";

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedBody, setSelectedBody] = useState<string | null>(null);

  const [globalMinDate, setGlobalMinDate] = useState<string>("");
  const [globalMaxDate, setGlobalMaxDate] = useState<string>("");

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  async function load() {
    setLoading(true);
    const query = supabase
      .from("vw_bulletins_with_canonical")
      .select(
        "id, company, ticker, bulletin_date, canonical_type, composite_key, body_text",
      )
      .eq("canonical_type", CPC_CANONICAL)
      .order("bulletin_date", { ascending: true });

    if (startDate) query.gte("bulletin_date", startDate);
    if (endDate) query.lte("bulletin_date", endDate);

    const { data, error } = await query;
    if (error) {
      console.error("Erro Supabase:", error.message);
      setRows([]);
      setGlobalMinDate("");
      setGlobalMaxDate("");
    } else {
      const fetched = (data || []) as Row[];
      setRows(fetched);
      const dates = fetched.map((r) => r.bulletin_date).filter(Boolean) as string[];
      if (dates.length) {
        const min = dates.reduce((a, b) => (a < b ? a : b));
        const max = dates.reduce((a, b) => (a > b ? a : b));
        setGlobalMinDate(min);
        setGlobalMaxDate(max);
        if (!startDate) setStartDate(min);
        if (!endDate) setEndDate(max);
      } else {
        setGlobalMinDate("");
        setGlobalMaxDate("");
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const filtered = rows.filter((r) => {
    if (!r.bulletin_date) return false;
    if (startDate && r.bulletin_date < startDate) return false;
    if (endDate && r.bulletin_date > endDate) return false;
    return true;
  });

  const chartData: ChartDatum[] = filtered.map((r) => ({
    ...r,
    company: r.company ?? "",
    dateNum: r.bulletin_date ? Date.parse(r.bulletin_date) : 0,
  }));

  const handleReset = () => {
    setStartDate(globalMinDate);
    setEndDate(globalMaxDate);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">CPC (TSXV)</h1>

      <div className="flex items-end gap-4">
        <div>
          <label className="block text-sm">Start</label>
          <input
            type="date"
            className="border rounded px-2 py-1"
            value={startDate}
            min={globalMinDate || undefined}
            max={endDate || undefined}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm">End</label>
          <input
            type="date"
            className="border rounded px-2 py-1"
            value={endDate}
            min={startDate || undefined}
            max={globalMaxDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <button
          className="border rounded px-3 py-1"
          title="Reset filters"
          onClick={handleReset}
        >
          🔄
        </button>

        <div className="ml-auto text-sm">
          {loading ? "Carregando..." : `${filtered.length} boletins`}
        </div>
      </div>

      <div className="w-full h-72 border rounded p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid />
            <XAxis
              dataKey="dateNum"
              name="Date"
              type="number"
              domain={["auto", "auto"]}
              tickFormatter={(v) => new Date(v).toISOString().slice(0, 10)}
            />
            <YAxis dataKey="company" type="category" name="Company" />
            <Tooltip
              formatter={(value: number | string, name: string) => {
                if (name === "dateNum") {
                  const timestamp =
                    typeof value === "number" ? value : Number(value);
                  const formatted = Number.isFinite(timestamp)
                    ? new Date(timestamp).toISOString().slice(0, 10)
                    : "";
                  return [formatted, "Date"];
                }
                return [value, name];
              }}
              labelFormatter={() => ""}
            />
            <Scatter data={chartData} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Resultados</h2>
        <div className="border rounded">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">Date</th>
                <th className="p-2">Company</th>
                <th className="p-2">Ticker</th>
                <th className="p-2">Composite_Key</th>
                <th className="p-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.bulletin_date}</td>
                  <td className="p-2">{row.company}</td>
                  <td className="p-2">{row.ticker}</td>
                  <td className="p-2">{row.composite_key}</td>
                  <td className="p-2">
                    <button
                      className="underline"
                      onClick={() => setSelectedBody(row.body_text || "")}
                    >
                      Ver boletim
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedBody !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-4 rounded shadow-lg max-w-3xl w-full max-h-[80vh] overflow-auto relative">
            <button
              className="absolute right-2 top-2 border rounded px-2 py-1"
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
    </div>
  );
}

