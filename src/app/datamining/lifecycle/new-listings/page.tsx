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
  const [listingStartDate, setListingStartDate] = useState("");
  const [listingEndDate, setListingEndDate] = useState("");
  const [globalMinDate, setGlobalMinDate] = useState("");
  const [globalMaxDate, setGlobalMaxDate] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    "NEW LISTING - IPO - SHARES",
    "NEW LISTING - CPC - SHARES",
    "NEW LISTING - SHARES",
  ]);

  const typeOptions: { value: string; label: string }[] = [
    { value: "NEW LISTING-IPO-SHARES", label: "IPO" },
    { value: "NEW LISTING-CPC-SHARES", label: "CPC" },
    { value: "NEW LISTING-SHARES", label: "Shares" },
  ];

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

  const filteredRows = rows.filter((row) => {
    if (!row.bulletin_date) return false;
    const withinStart =
      !listingStartDate || row.bulletin_date >= listingStartDate;
    const withinEnd = !listingEndDate || row.bulletin_date <= listingEndDate;
    return withinStart && withinEnd;
  });

  const handleResetFilters = () => {
    setListingStartDate(globalMinDate);
    setListingEndDate(globalMaxDate);
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">New Listings (TSXV)</h2>

      {/* Filtros */}
      <div className="flex flex-wrap gap-6 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input
            type="date"
            value={listingStartDate}
            onChange={(e) => setListingStartDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input
            type="date"
            value={listingEndDate}
            onChange={(e) => setListingEndDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <div className="flex items-end">
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
        <>
          <ResponsiveContainer width="100%" height={500}>
            <ScatterChart>
              <CartesianGrid />
              <XAxis dataKey="bulletin_date" name="Data" />
              <YAxis dataKey="company" name="Empresa" type="category" />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              <Legend />
              <Scatter name="Nova Listagem" data={filteredRows} fill="#d4af37" />
            </ScatterChart>
          </ResponsiveContainer>

          {/* Tabela de resultados */}
          <div className="mt-6 border rounded-lg p-4 bg-gray-50">
            <h2 className="text-lg font-semibold mb-2">Resultados</h2>
            {filteredRows.length === 0 ? (
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
                  {filteredRows.map((row) => (
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
