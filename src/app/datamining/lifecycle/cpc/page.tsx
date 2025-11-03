"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Select, { MultiValue } from "react-select";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { TooltipProps } from "recharts";
import type {
  ValueType,
  NameType,
} from "recharts/types/component/DefaultTooltipContent";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type Row = {
  id: number;
  source_file?: string | null;
  company: string | null;
  ticker: string | null;
  bulletin_type: string | null;
  canonical_type: string | null;
  bulletin_date: string | null;
  composite_key?: string | null;
  body_text: string | null;
};

type ScatterDatum = {
  company: string;
  ticker: string;
  dateNum: number;
  canonical_type: string;
};

type Opt = { value: string; label: string };

const CPC_CANONICAL = "NEW LISTING-CPC-SHARES";

export default function Page() {
  const [loading, setLoading] = useState(true);

  // dataset completo da timeline CPC
  const [rows, setRows] = useState<Row[]>([]);

  // âncoras globais de data
  const [globalMinDate, setGlobalMinDate] = useState<string>("");
  const [globalMaxDate, setGlobalMaxDate] = useState<string>("");

  // filtros
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [companyOpts, setCompanyOpts] = useState<Opt[]>([]);
  const [tickerOpts, setTickerOpts] = useState<Opt[]>([]);

  const [selCompanies, setSelCompanies] = useState<Opt[]>([]);
  const [selTickers, setSelTickers] = useState<Opt[]>([]);

  const [selectedBody, setSelectedBody] = useState<string | null>(null);

  async function load() {
    setLoading(true);

    // 1) Coorte CPC
    const { data: cohort, error: e1 } = await supabase
      .from("vw_bulletins_with_canonical")
      .select("company, ticker, bulletin_date, canonical_type")
      .eq("canonical_type", CPC_CANONICAL);

    if (e1) {
      console.error(e1.message);
      setRows([]);
      setLoading(false);
      return;
    }

    // Mapa empresa|ticker -> first_cpc_date
    const anchors = new Map<string, string>(); // key: company|ticker -> first CPC date
    const companies = new Set<string>();
    for (const r of cohort || []) {
      const key = `${r.company ?? ""}|${r.ticker ?? ""}`;
      const d = r.bulletin_date!;
      if (!anchors.has(key)) anchors.set(key, d);
      else if (d < anchors.get(key)!) anchors.set(key, d);
      if (r.company) companies.add(r.company);
    }

    const compArr = Array.from(companies).sort();

    // 2) Timeline para a coorte. Baixa desde a menor âncora global e filtra por âncora por empresa.
    const globalAnchor = [...anchors.values()].sort()[0] || null;

    const { data: timeline, error: e2 } = await supabase
      .from("vw_bulletins_with_canonical")
      .select(
        "id, source_file, company, ticker, bulletin_type, canonical_type, bulletin_date, composite_key, body_text",
      )
      .in("company", compArr.length ? compArr : ["__none__"])
      .gte("bulletin_date", globalAnchor ?? "1900-01-01")
      .order("bulletin_date", { ascending: true });

    if (e2) {
      console.error(e2.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const r = (timeline || []) as Row[];

    // Filtrar por âncora por empresa|ticker para evitar eventos pré-CPC
    const filteredByAnchor = r.filter((row) => {
      const key = `${row.company ?? ""}|${row.ticker ?? ""}`;
      const anchor = anchors.get(key);
      if (!anchor) return false; // só coorte CPC
      if (!row.bulletin_date) return false;
      return row.bulletin_date >= anchor;
    });

    setRows(filteredByAnchor);

    // opções de filtros
    const uniq = <T extends string | null>(arr: T[]) =>
      Array.from(new Set(arr.filter(Boolean) as string[])).sort();

    setCompanyOpts(uniq(filteredByAnchor.map((x) => x.company)).map((v) => ({ value: v, label: v })));
    setTickerOpts(uniq(filteredByAnchor.map((x) => x.ticker)).map((v) => ({ value: v, label: v })));

    // datas globais
    const ds = filteredByAnchor.map((x) => x.bulletin_date).filter(Boolean) as string[];
    if (ds.length) {
      const min = ds.reduce((a, b) => (a < b ? a : b));
      const max = ds.reduce((a, b) => (a > b ? a : b));
      setGlobalMinDate(min);
      setGlobalMaxDate(max);
      setStartDate(min);
      setEndDate(max);
    } else {
      setGlobalMinDate("");
      setGlobalMaxDate("");
      setStartDate("");
      setEndDate("");
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const cset = new Set(selCompanies.map((o) => o.value));
    const tset = new Set(selTickers.map((o) => o.value));

    return rows.filter((r) => {
      if (!r.bulletin_date) return false;
      if (startDate && r.bulletin_date < startDate) return false;
      if (endDate && r.bulletin_date > endDate) return false;
      if (cset.size && (!r.company || !cset.has(r.company))) return false;
      if (tset.size && (!r.ticker || !tset.has(r.ticker))) return false;
      return true;
    });
  }, [rows, startDate, endDate, selCompanies, selTickers]);

  const filteredSorted = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        (a.bulletin_date ?? "").localeCompare(b.bulletin_date ?? ""),
      ),
    [filtered],
  );

  const chartData: ScatterDatum[] = useMemo(
    () =>
      filteredSorted.map((r) => ({
        company: r.company ?? "",
        ticker: r.ticker ?? "",
        dateNum: r.bulletin_date ? Date.parse(r.bulletin_date) : 0,
        canonical_type: r.canonical_type ?? "",
      })),
    [filteredSorted],
  );

  const CustomTooltip = ({
    active,
    payload,
  }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload || payload.length === 0) return null;
    const item = payload[0];
    const point = item && item.payload ? (item.payload as ScatterDatum) : undefined;
    if (!point) return null;
    const date =
      Number.isFinite(point.dateNum) && point.dateNum
        ? new Date(point.dateNum).toISOString().slice(0, 10)
        : "";
    return (
      <div className="bg-white rounded border shadow p-2 text-sm">
        <div>
          <b>Date</b>: {date || "—"}
        </div>
        <div>
          <b>Ticker</b>: {point.ticker || "—"}
        </div>
        <div>
          <b>Company</b>: {point.company || "—"}
        </div>
        <div>
          <b>Canonical</b>: {point.canonical_type || "—"}
        </div>
      </div>
    );
  };

  const handleReset = () => {
    setSelCompanies([]);
    setSelTickers([]);
    setStartDate(globalMinDate);
    setEndDate(globalMaxDate);
  };

  const hasFiltered = filteredSorted.length > 0;

  const handleExportZip = async () => {
    if (!hasFiltered) {
      alert("Nenhum boletim no filtro atual.");
      return;
    }
    const grouped = new Map<string, Row[]>();
    for (const row of filteredSorted) {
      if (!row.company) continue;
      if (!grouped.has(row.company)) grouped.set(row.company, []);
      grouped.get(row.company)!.push(row);
    }
    if (!grouped.size) {
      alert("Nenhuma empresa válida para exportar.");
      return;
    }
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const [company, rowsForCompany] of grouped) {
      const sorted = [...rowsForCompany].sort((a, b) =>
        (a.bulletin_date ?? "").localeCompare(b.bulletin_date ?? ""),
      );
      const story = sorted
        .map(
          (r) =>
            `${r.bulletin_date ?? ""} — ${r.bulletin_type ?? ""}\n${r.body_text ?? ""}\n`,
        )
        .join("\n--------------------------------\n");
      const safe = company.replace(/[^a-z0-9]/gi, "_");
      const lastDate = sorted[sorted.length - 1].bulletin_date ?? "unknown";
      zip.file(`${safe}__cpc_notices_until_${lastDate}.txt`, story);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cpc_notices.zip";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportTxt = async () => {
    if (!hasFiltered) {
      alert("Nenhum boletim no filtro atual.");
      return;
    }
    const grouped = new Map<string, Row[]>();
    for (const row of filteredSorted) {
      if (!row.company) continue;
      if (!grouped.has(row.company)) grouped.set(row.company, []);
      grouped.get(row.company)!.push(row);
    }
    if (!grouped.size) {
      alert("Nenhuma empresa válida para exportar.");
      return;
    }
    const sections: string[] = [];
    for (const [company, rowsForCompany] of grouped) {
      const sorted = [...rowsForCompany].sort((a, b) =>
        (a.bulletin_date ?? "").localeCompare(b.bulletin_date ?? ""),
      );
      const story = sorted
        .map(
          (r) =>
            `${r.bulletin_date ?? ""} — ${r.bulletin_type ?? ""}\n${r.body_text ?? ""}\n`,
        )
        .join("\n--------------------------------\n");
      sections.push(
        [
          "=============================",
          company,
          "=============================",
          story,
          "",
        ].join("\n"),
      );
    }
    const safeStart = startDate ? startDate.replaceAll("-", "") : "inicio";
    const safeEnd = endDate ? endDate.replaceAll("-", "") : "fim";
    const filename = `cpc_notices_${safeStart}_${safeEnd}.txt`;
    const blob = new Blob([sections.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold">CPC — Notices</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={handleExportZip}
            disabled={loading || !hasFiltered}
            className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600 disabled:opacity-60"
          >
            📄 Exportar ZIP
          </button>
          <button
            onClick={handleExportTxt}
            disabled={loading || !hasFiltered}
            className="px-4 py-2 bg-green-500 text-black rounded hover:bg-green-600 disabled:opacity-60"
          >
            📜 Exportar TXT consolidado
          </button>
        </div>
      </div>

      <div className="flex items-center text-sm text-gray-600">
        {loading ? "Carregando…" : `${filteredSorted.length} boletins no filtro`}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex gap-4">
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
            className="border rounded px-3 py-1 self-end"
            onClick={handleReset}
            title="Reset"
          >
            🔄
          </button>
        </div>

        <div>
          <label className="block text-sm mb-1">Company</label>
          <Select
            isMulti
            options={companyOpts}
            value={selCompanies}
            onChange={(v: MultiValue<Opt>) => setSelCompanies(v as Opt[])}
            classNamePrefix="cpc-select"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Ticker</label>
          <Select
            isMulti
            options={tickerOpts}
            value={selTickers}
            onChange={(v: MultiValue<Opt>) => setSelTickers(v as Opt[])}
            classNamePrefix="cpc-select"
          />
        </div>
      </div>

      <div className="w-full h-80 border rounded p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid />
            <XAxis
              dataKey="dateNum"
              type="number"
              domain={["auto", "auto"]}
              tickFormatter={(v) => new Date(v).toISOString().slice(0, 10)}
              name="Date"
            />
            <YAxis
              type="category"
              dataKey="ticker"
              name="Ticker"
              width={90}
              tick={{ fontSize: 12 }}
            />
            <Tooltip labelFormatter={() => ""} content={<CustomTooltip />} />
            <Scatter data={chartData} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Resultados</h2>
        <div className="border rounded overflow-x-auto">
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
              {filteredSorted.map((row) => (
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
