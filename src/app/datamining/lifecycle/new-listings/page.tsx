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

export default function NewListingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    "NEW LISTING - IPO - SHARES",
    "NEW LISTING - CPC - SHARES",
    "NEW LISTING - SHARES",
  ]);

  const typeOptions: { value: string; label: string }[] = [
    { value: "NEW LISTING - IPO - SHARES", label: "IPO" },
    { value: "NEW LISTING - CPC - SHARES", label: "CPC" },
    { value: "NEW LISTING - SHARES", label: "Shares" },
  ];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let query = supabase
        .from("vw_bulletins_with_canonical")
        .select("id, company, ticker, bulletin_date, canonical_type")
        .in("canonical_type", selectedTypes);

      if (startDate) query = query.gte("bulletin_date", startDate);
      if (endDate) query = query.lte("bulletin_date", endDate);

      const { data, error } = await query.order("bulletin_date", { ascending: true });

      if (error) {
        console.error("Erro Supabase:", error.message);
        setRows([]);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    };

    fetchData();
  }, [selectedTypes, startDate, endDate]);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">New Listings (TSXV)</h2>

      {/* Filtros */}
      <div className="flex flex-wrap gap-6 mb-4">
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
        <div>
          <label className="block text-sm font-medium mb-1">Tipos de Boletim</label>
          {typeOptions.map((opt) => (
            <div key={opt.value} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={opt.value}
                checked={selectedTypes.includes(opt.value)}
                onChange={() => {
                  setSelectedTypes((prev) =>
                    prev.includes(opt.value)
                      ? prev.filter((t) => t !== opt.value)
                      : [...prev, opt.value]
                  );
                }}
                className="h-4 w-4"
              />
              <label htmlFor={opt.value}>{opt.label}</label>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div>⏳ Carregando...</div>
      ) : (
        <ResponsiveContainer width="100%" height={500}>
          <ScatterChart>
            <CartesianGrid />
            <XAxis dataKey="bulletin_date" name="Data" />
            <YAxis dataKey="company" name="Empresa" type="category" />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Legend />
            <Scatter name="Nova Listagem" data={rows} fill="#d4af37" />
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
