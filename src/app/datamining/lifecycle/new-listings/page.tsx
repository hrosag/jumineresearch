"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Select, { MultiValue } from "react-select";
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

type Option = { value: string; label: string };

export default function NewListingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    "NEW LISTING - IPO - SHARES",
    "NEW LISTING - CPC - SHARES",
    "NEW LISTING - SHARES",
  ]);

  const typeOptions: Option[] = [
    { value: "NEW LISTING - IPO - SHARES", label: "IPO" },
    { value: "NEW LISTING - CPC - SHARES", label: "CPC" },
    { value: "NEW LISTING - SHARES", label: "Shares" },
  ];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("bulletins")
        .select("id, company, ticker, bulletin_date, canonical_type")
        .in("canonical_type", selectedTypes)
        .order("bulletin_date", { ascending: true });

      if (error) console.error(error);
      else setRows(data || []);
      setLoading(false);
    };

    fetchData();
  }, [selectedTypes]);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">New Listings (TSXV)</h2>

      {/* Filtro de tipos */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Filtrar por tipo</label>
        <Select
          isMulti
          options={typeOptions}
          value={typeOptions.filter(opt => selectedTypes.includes(opt.value))}
          onChange={(vals: MultiValue<Option>) =>
            setSelectedTypes(vals.map(v => v.value))
          }
        />
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
