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

interface Row {
  id: number;
  company: string | null;
  ticker: string | null;
  bulletin_date: string | null;
  canonical_type: string | null;
}

export default function NewListingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("bulletins")
        .select("id, company, ticker, bulletin_date, canonical_type")
        .in("canonical_type", [
          "NEW LISTING - IPO - SHARES",
          "NEW LISTING - CPC - SHARES",
        ])
        .order("bulletin_date", { ascending: true });

      if (error) console.error(error);
      else setRows(data || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) return <div>⏳ Carregando...</div>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Novas Empresas (TSXV)</h2>
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
    </div>
  );
}
