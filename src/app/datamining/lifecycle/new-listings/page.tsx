"use client";

import { useEffect, useMemo, useState } from "react";
import Select, { MultiValue } from "react-select";
import { createClient } from "@supabase/supabase-js";
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type Row = {
  id: number;
  source_file: string | null;
  company: string | null;
  ticker: string | null;
  listing_date: string | null;
  body_text: string | null;
};

type Option = { value: string; label: string };

export default function NewListingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [globalMin, setGlobalMin] = useState("");
  const [globalMax, setGlobalMax] = useState("");

  useEffect(() => {
    async function fetchData() {
      if (!supabase) {
        console.warn("Supabase client not configured. Skipping fetch.");
        setRows([]);
        setGlobalMin("");
        setGlobalMax("");
        setStartDate("");
        setEndDate("");
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("vw_new_listings")
        .select("id, source_file, company, ticker, listing_date, body_text")
        .throwOnError();

      if (error) {
        console.error("Supabase error:", error.message);
        setRows([]);
        setGlobalMin("");
        setGlobalMax("");
        setStartDate("");
        setEndDate("");
      } else if (data) {
        setRows(data as Row[]);
        const dates = (data
          .map((item) => item.listing_date)
          .filter(Boolean) as string[]).sort();
        if (dates.length) {
          const minDate = dates[0];
          const maxDate = dates[dates.length - 1];
          setGlobalMin(minDate);
          setGlobalMax(maxDate);
          setStartDate(minDate);
          setEndDate(maxDate);
        }
      }
      setLoading(false);
    }

    fetchData();
  }, []);

  const companyOptions: Option[] = useMemo(() => {
    const uniqueCompanies = new Set(
      rows.map((row) => row.company).filter(Boolean) as string[],
    );
    return Array.from(uniqueCompanies)
      .sort((a, b) => a.localeCompare(b))
      .map((company) => ({ value: company, label: company }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const companyOk =
        selectedCompanies.length === 0
          ? true
          : selectedCompanies.includes(row.company ?? "");
      const dateOk = row.listing_date
        ? (!startDate || row.listing_date >= startDate) &&
          (!endDate || row.listing_date <= endDate)
        : false;
      return companyOk && dateOk;
    });
  }, [rows, selectedCompanies, startDate, endDate]);

  function handleCompanyChange(selected: MultiValue<Option>) {
    setSelectedCompanies(selected.map((option) => option.value));
  }

  const selectedOptions = useMemo(
    () =>
      companyOptions.filter((option) =>
        selectedCompanies.includes(option.value),
      ),
    [companyOptions, selectedCompanies],
  );

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">New Listings</h1>
        <p className="text-sm text-gray-500">
          Explore new listings and filter by date range or company.
        </p>
      </header>

      <section className="flex flex-wrap gap-4">
        <label className="flex flex-col text-sm font-medium">
          Start Date
          <input
            type="date"
            value={startDate}
            min={globalMin}
            max={endDate || globalMax}
            onChange={(event) => setStartDate(event.target.value)}
            className="mt-1 rounded border px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm font-medium">
          End Date
          <input
            type="date"
            value={endDate}
            min={startDate || globalMin}
            max={globalMax}
            onChange={(event) => setEndDate(event.target.value)}
            className="mt-1 rounded border px-2 py-1"
          />
        </label>
        <div className="min-w-[240px] flex-1">
          <label className="block text-sm font-medium">Companies</label>
          <Select
            isMulti
            options={companyOptions}
            value={selectedOptions}
            onChange={handleCompanyChange}
            className="mt-1"
            placeholder="Select companies"
          />
        </div>
      </section>

      <section className="min-h-[400px]">
        {loading ? (
          <div className="flex h-full items-center justify-center text-gray-500">
            Loading new listings…
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-500">
            No listings match the selected filters.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="listing_date" name="Date" />
              <YAxis dataKey="company" name="Company" type="category" />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              <Legend />
              <Scatter data={filteredRows} fill="#8884d8" name="New Listings" />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
