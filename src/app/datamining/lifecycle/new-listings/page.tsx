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
  source_file: string | null;
  company: string | null;
  ticker: string | null;
  listing_date: string | null;
  body_text: string | null;
  canonical_type: string | null;
};

type Option = { value: string; label: string };

export default function NewListingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    "NEW LISTING-IPO-SHARES",
    "NEW LISTING-CPC-SHARES",
    "NEW LISTING-SHARES",
  ]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [globalMin, setGlobalMin] = useState("");
  const [globalMax, setGlobalMax] = useState("");

  const typeOptions: Option[] = [
    { value: "NEW LISTING-IPO-SHARES", label: "IPO" },
    { value: "NEW LISTING-CPC-SHARES", label: "CPC" },
    { value: "NEW LISTING-SHARES", label: "Shares" },
  ];

  useEffect(() => {
    async function fetchData() {
      try {
        const { data } = await supabase
          .from("vw_new_listings")
          .select(
            "id, source_file, company, ticker, listing_date, body_text, canonical_type",
          )
          .throwOnError();

        if (data) {
          setRows(data as Row[]);
          const dates = data.map((r) => r.listing_date).filter(Boolean) as string[];
          if (dates.length) {
            const minDate = dates.reduce((a, b) => (a < b ? a : b));
            const maxDate = dates.reduce((a, b) => (a > b ? a : b));
            setStartDate(minDate);
            setEndDate(maxDate);
            setGlobalMin(minDate);
            setGlobalMax(maxDate);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar novas listagens:", error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredRows = rows.filter((r) => {
    const companyOk =
      selectedCompanies.length === 0 ? true : selectedCompanies.includes(r.company ?? "");
    const typeOk =
      selectedTypes.length === 0 ? true : selectedTypes.includes(r.canonical_type ?? "");
    const dateOk = r.listing_date
      ? (!startDate || r.listing_date >= startDate) && (!endDate || r.listing_date <= endDate)
      : false;
    return companyOk && typeOk && dateOk;
  });

  const companyOptions: Option[] = Array.from(
    new Set(rows.map((r) => r.company).filter(Boolean)),
  ).map((c) => ({ value: c!, label: c! }));

  function handleCompanyChange(selected: MultiValue<Option>) {
    setSelectedCompanies(selected.map((s) => s.value));
  }

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
            min={globalMin}
            max={endDate || globalMax}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            min={startDate || globalMin}
            max={globalMax}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <div className="min-w-[240px] flex-1">
          <label className="block text-sm font-medium">Companies</label>
          <Select
            isMulti
            options={companyOptions}
            value={companyOptions.filter((option) => selectedCompanies.includes(option.value))}
            onChange={handleCompanyChange}
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
                      : [...prev, opt.value],
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
              <XAxis dataKey="listing_date" name="Date" type="category" />
              <YAxis dataKey="ticker" name="Ticker" type="category" />
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
                      <td className="border px-2 py-1">{row.listing_date}</td>
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
