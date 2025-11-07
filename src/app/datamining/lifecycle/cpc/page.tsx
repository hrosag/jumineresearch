"use client";

import { useEffect, useMemo, useState, useDeferredValue } from "react";
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
  dateISO: string;
  composite_key?: string;
};

function toDateNum(iso: string | null | undefined): number {
  if (!iso) return Number.NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return Number.NaN;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return Date.UTC(y, mo, d, 12, 0, 0);
}

function fmtUTC(ts: number): string {
  if (!Number.isFinite(ts)) return "—";
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
}

function fmtDayMonth(ts: number): string {
  if (!Number.isFinite(ts)) return "—";
  const d = new Date(ts);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

type Opt = { value: string; label: string };
const CPC_CANONICAL = "NEW LISTING-CPC-SHARES";

type SortKey = "company" | "ticker" | "composite_key" | "bulletin_date" | "canonical_type";
type SortDir = "asc" | "desc";

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [selectedBulletin, setSelectedBulletin] = useState<Row | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [globalMinDate, setGlobalMinDate] = useState<string>("");
  const [globalMaxDate, setGlobalMaxDate] = useState<string>("");

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [selCompanies, setSelCompanies] = useState<Opt[]>([]);
  const [selTickers, setSelTickers] = useState<Opt[]>([]);
  const [onlyMulti, setOnlyMulti] = useState(false);

  // sort + filtros por coluna
  const [sortKey, setSortKey] = useState<SortKey>("bulletin_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [fCompany, setFCompany] = useState("");
  const [fTicker, setFTicker] = useState("");
  const [fKey, setFKey] = useState("");
  const [fDate, setFDate] = useState(""); // aceita prefixo YYYY, YYYY-MM, YYYY-MM-DD
  const [fType, setFType] = useState("");

  // filtros “deferidos” para debounce natural
  const dfCompany = useDeferredValue(fCompany);
  const dfTicker = useDeferredValue(fTicker);
  const dfKey = useDeferredValue(fKey);
  const dfDate = useDeferredValue(fDate);
  const dfType = useDeferredValue(fType);

  // paginação da tabela
  const PAGE = 50;
  const [tableLimit, setTableLimit] = useState(PAGE);

  // restaura filtros da URL
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const s = q.get("s"); const e = q.get("e");
    const t = q.get("t"); const c = q.get("c");
    const m = q.get("m");
    if (s) setStartDate(s);
    if (e) setEndDate(e);
    if (m === "1") setOnlyMulti(true);
    if (t) setSelTickers(t.split(",").map(v => ({ value: v, label: v })));
    if (c) setSelCompanies(c.split(",").map(v => ({ value: v, label: v })));
  }, []);

  // baixa dados
  async function load() {
    setLoading(true);

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

    const anchors = new Map<string, string>();
    const companies = new Set<string>();
    for (const r of cohort || []) {
      const key = `${r.company ?? ""}|${r.ticker ?? ""}`;
      const d = r.bulletin_date!;
      if (!anchors.has(key)) anchors.set(key, d);
      else if (d < anchors.get(key)!) anchors.set(key, d);
      if (r.company) companies.add(r.company);
    }

    const compArr = Array.from(companies).sort();
    const globalAnchor = [...anchors.values()].sort()[0] || null;

    const { data: timeline, error: e2 } = await supabase
      .from("vw_bulletins_with_canonical")
      .select(
        // body_text removido. Buscar sob demanda.
        "id, source_file, company, ticker, bulletin_type, canonical_type, bulletin_date, composite_key",
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

    const filteredByAnchor = r.filter((row) => {
      const key = `${row.company ?? ""}|${row.ticker ?? ""}`;
      const anchor = anchors.get(key);
      if (!anchor) return false;
      if (!row.bulletin_date) return false;
      return row.bulletin_date >= anchor;
    });

    setRows(filteredByAnchor);

    const ds = filteredByAnchor.map((x) => x.bulletin_date).filter(Boolean) as string[];
    if (ds.length) {
      const min = ds.reduce((a, b) => (a < b ? a : b));
      const max = ds.reduce((a, b) => (a > b ? a : b));
      setGlobalMinDate(min);
      setGlobalMaxDate(max);
      setStartDate((prev) => prev || min);
      setEndDate((prev) => prev || max);
    } else {
      setGlobalMinDate("");
      setGlobalMaxDate("");
      setStartDate("");
      setEndDate("");
    }

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // valida intervalo
  useEffect(() => {
    if (startDate && endDate && startDate > endDate) setEndDate(startDate);
  }, [startDate, endDate]);

  // sincroniza filtros na URL
  useEffect(() => {
    const p = new URLSearchParams();
    if (startDate) p.set("s", startDate);
    if (endDate) p.set("e", endDate);
    if (selTickers.length) p.set("t", selTickers.map(o => o.value).join(","));
    if (selCompanies.length) p.set("c", selCompanies.map(o => o.value).join(","));
    if (onlyMulti) p.set("m", "1");
    history.replaceState(null, "", `?${p.toString()}`);
  }, [startDate, endDate, selTickers, selCompanies, onlyMulti]);

  // janela atual
  const rowsInWindow = useMemo(() => {
    return rows.filter((r) => {
      if (!r.bulletin_date) return false;
      if (startDate && r.bulletin_date < startDate) return false;
      if (endDate && r.bulletin_date > endDate) return false;
      return true;
    });
  }, [rows, startDate, endDate]);

  // opções de selects
  const companyOpts = useMemo<Opt[]>(() => {
    const s = new Set<string>();
    for (const r of rowsInWindow) if (r.company) s.add(r.company);
    return Array.from(s).sort().map((v) => ({ value: v, label: v }));
  }, [rowsInWindow]);

  const tickerOpts = useMemo<Opt[]>(() => {
    const s = new Set<string>();
    for (const r of rowsInWindow) if (r.ticker) s.add(r.ticker);
    return Array.from(s).sort().map((v) => ({ value: v, label: v }));
  }, [rowsInWindow]);

  // poda seleções inválidas
  useEffect(() => {
    const validCompanies = new Set(companyOpts.map((o) => o.value));
    const validTickers = new Set(tickerOpts.map((o) => o.value));
    setSelCompanies((prev) => prev.filter((o) => validCompanies.has(o.value)));
    setSelTickers((prev) => prev.filter((o) => validTickers.has(o.value)));
  }, [companyOpts, tickerOpts]);

  // contagem por ticker
  const tickerCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rowsInWindow) {
      if (!r.ticker) continue;
      m.set(r.ticker, (m.get(r.ticker) ?? 0) + 1);
    }
    return m;
  }, [rowsInWindow]);

  // filtro principal
  const filtered = useMemo(() => {
    const cset = new Set(selCompanies.map((o) => o.value));
    const tset = new Set(selTickers.map((o) => o.value));
    return rowsInWindow.filter((r) => {
      if (cset.size && (!r.company || !cset.has(r.company))) return false;
      if (tset.size && (!r.ticker || !tset.has(r.ticker))) return false;
      if (onlyMulti && (!r.ticker || (tickerCount.get(r.ticker) ?? 0) < 2)) return false;
      return true;
    });
  }, [rowsInWindow, selCompanies, selTickers, onlyMulti, tickerCount]);

  // dataset ordenado por data para o gráfico
  const filteredSorted = useMemo(
    () => [...filtered].sort((a, b) => toDateNum(a.bulletin_date) - toDateNum(b.bulletin_date)),
    [filtered],
  );

  // gráfico
  const chartData: ScatterDatum[] = useMemo(
    () =>
      filteredSorted.map((r) => ({
        company: r.company ?? "",
        ticker: r.ticker ?? "",
        dateNum: toDateNum(r.bulletin_date),
        canonical_type: r.canonical_type ?? "",
        dateISO: r.bulletin_date ?? "",
        composite_key: r.composite_key ?? undefined,
      })),
    [filteredSorted],
  );

  const xDomain: [number | "auto", number | "auto"] = useMemo(() => {
    const times = filteredSorted
      .map((r) => toDateNum(r.bulletin_date))
      .filter((v): v is number => Number.isFinite(v));
    if (!times.length) return ["auto", "auto"];
    const PAD = 5 * 24 * 60 * 60 * 1000;
    const min = Math.min(...times);
    const max = Math.max(...times);
    return [min - PAD, max + PAD];
  }, [filteredSorted]);

  const tickerOrder = useMemo<string[]>(() => {
    if (selTickers.length) return selTickers.map((o) => o.value);
    const first = new Map<string, number>();
    for (const r of filteredSorted) {
      const t = r.ticker ?? "";
      if (!t) continue;
      const ts = toDateNum(r.bulletin_date);
      const prev = first.get(t);
      if (Number.isFinite(ts) && (prev === undefined || (ts as number) < prev!)) {
        first.set(t, ts as number);
      }
    }
    return Array.from(first.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([t]) => t);
  }, [filteredSorted, selTickers]);

  const [yLimit, setYLimit] = useState<number>(10);

  useEffect(() => {
    setYLimit((v) => Math.max(v, selTickers.length || 10));
  }, [selTickers.length]);

  useEffect(() => {
    if (tickerOrder.length && yLimit > tickerOrder.length) setYLimit(tickerOrder.length);
  }, [tickerOrder.length, yLimit]);

  const visibleTickers = useMemo(
    () => tickerOrder.slice(0, Math.max(1, Math.min(yLimit, tickerOrder.length || 1))),
    [tickerOrder, yLimit],
  );

  const chartDataVis = useMemo(
    () => chartData.filter((d) => d.ticker && visibleTickers.includes(d.ticker)),
    [chartData, visibleTickers],
  );

  const chartHeight = useMemo(() => {
    const base = 260;
    const perRow = 26;
    const maxH = 1200;
    return Math.min(maxH, Math.max(base, 60 + visibleTickers.length * perRow));
  }, [visibleTickers]);

  const handleReset = () => {
    setSelCompanies([]);
    setSelTickers([]);
    setStartDate(globalMinDate);
    setEndDate(globalMaxDate);
    setOnlyMulti(false);
    setSortKey("bulletin_date");
    setSortDir("asc");
    setFCompany("");
    setFTicker("");
    setFKey("");
    setFDate("");
    setFType("");
    setTableLimit(PAGE);
  };

  const hasFiltered = filteredSorted.length > 0;

  // abrir modal com body_text sob demanda
  const openBulletinModal = async (row: Row) => {
    setSelectedBulletin(row);
    if (!row.composite_key || row.body_text) return;
    const { data, error } = await supabase
      .from("vw_bulletins_with_canonical")
      .select("body_text")
      .eq("composite_key", row.composite_key)
      .single();
    if (!error && data) {
      setSelectedBulletin((prev) => (prev ? { ...prev, body_text: data.body_text } : prev));
    }
  };
  const closeBulletinModal = () => setSelectedBulletin(null);

  // tabela: filtros por coluna + sort
  function toggleSort(k: SortKey) {
    setSortKey((prevK) => {
      if (prevK !== k) {
        setSortDir("asc");
        return k;
      }
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return k;
    });
  }
  const sortIndicator = (k: SortKey) =>
    sortKey === k ? <span className="ml-1 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span> : null;

  const tableRows = useMemo(() => {
    const cf = dfCompany.trim().toLowerCase();
    const tf = dfTicker.trim().toLowerCase();
    const kf = dfKey.trim().toLowerCase();
    const df = dfDate.trim();
    const yf = dfType.trim().toLowerCase();

    const arr = filtered.filter((r) => {
      const c = (r.company ?? "").toLowerCase();
      const t = (r.ticker ?? "").toLowerCase();
      const k = (r.composite_key ?? "").toLowerCase();
      const d = r.bulletin_date ?? "";
      const y = (r.canonical_type ?? r.bulletin_type ?? "").toLowerCase();

      if (cf && !c.includes(cf)) return false;
      if (tf && !t.includes(tf)) return false;
      if (kf && !k.includes(kf)) return false;
      if (df && !d.startsWith(df)) return false; // aceita "2008" ou "2008-03"
      if (yf && !y.includes(yf)) return false;
      return true;
    });

    const getVal = (r: Row, k: SortKey) =>
      k === "bulletin_date" ? toDateNum(r.bulletin_date)
      : k === "company" ? (r.company ?? "").toLowerCase()
      : k === "ticker" ? (r.ticker ?? "").toLowerCase()
      : k === "canonical_type" ? (r.canonical_type ?? "").toLowerCase()
      : (r.composite_key ?? "").toLowerCase();

    arr.sort((a, b) => {
      const va = getVal(a, sortKey);
      const vb = getVal(b, sortKey);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return arr;
  }, [filtered, dfCompany, dfTicker, dfKey, dfDate, dfType, sortKey, sortDir]);

  // paginação client-side
  const tableRowsPage = useMemo(
    () => tableRows.slice(0, tableLimit),
    [tableRows, tableLimit]
  );
  useEffect(() => {
    // se filtros mudarem, volta para primeira "página"
    setTableLimit(PAGE);
  }, [filtered.length, dfCompany, dfTicker, dfKey, dfDate, dfType, sortKey, sortDir]);

  // EXPORTS
  // Exporta a seleção COMPLETA (todas as linhas filtradas), não só a página visível
  const handleExportSelectionTxt = async () => {
    if (!tableRows.length) {
      alert("Nada a exportar. Ajuste os filtros/seleção.");
      return;
    }
    const sorted = [...tableRows].sort(
      (a, b) => toDateNum(a.bulletin_date) - toDateNum(b.bulletin_date),
    );
    const story = sorted
      .map((r) => `${r.bulletin_date ?? ""} — ${r.bulletin_type ?? ""}\n${r.body_text ?? ""}\n`)
      .join("\n--------------------------------\n");
    const safeStart = startDate ? startDate.replaceAll("-", "") : "inicio";
    const safeEnd = endDate ? endDate.replaceAll("-", "") : "fim";
    const filename = `cpc_notices_selecao_${safeStart}_${safeEnd}.txt`;
    const blob = new Blob([story], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportWindowTxt = async () => {
    const base = [...rowsInWindow].sort(
      (a, b) => toDateNum(a.bulletin_date) - toDateNum(b.bulletin_date),
    );
    if (!base.length) {
      alert("Nenhum boletim no período.");
      return;
    }
    const story = base
      .map((r) => `${r.bulletin_date ?? ""} — ${r.bulletin_type ?? ""}\n${r.body_text ?? ""}\n`)
      .join("\n--------------------------------\n");
    const safeStart = startDate ? startDate.replaceAll("-", "") : "inicio";
    const safeEnd = endDate ? endDate.replaceAll("-", "") : "fim";
    const filename = `cpc_notices_periodo_${safeStart}_${safeEnd}.txt`;
    const blob = new Blob([story], { type: "text/plain;charset=utf-8" });
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
            onClick={handleExportSelectionTxt}
            disabled={loading || !tableRows.length}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60"
            title="Exporta exatamente o que aparece na tabela (todas as linhas filtradas)"
          >
            📜 Exportar seleção
          </button>
          <button
            onClick={handleExportWindowTxt}
            disabled={loading || !rowsInWindow.length}
            className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700 disabled:opacity-60"
            title="Exporta todo o período, ignorando filtros da tabela"
          >
            🗂️ Exportar período
          </button>
        </div>
      </div>

      <div className="flex items-center text-sm text-gray-600">
        {loading ? "Carregando…" : `${filteredSorted.length} boletins no filtro`}
      </div>

      {/* Filtros superiores */}
      <div className="flex flex-wrap items-end gap-3">
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
        <div className="flex gap-2 items-end flex-wrap">
          <button className="border rounded px-3 py-1" onClick={handleReset} title="Limpar filtros">
            🔄 Limpar
          </button>
          <button
            className="border rounded px-2 py-1"
            onClick={() => setYLimit((v) => Math.max(10, v - 10))}
            title="-10 linhas"
            disabled={yLimit <= 10}
          >
            −10
          </button>
          <button
            className="border rounded px-2 py-1"
            onClick={() => setYLimit((v) => Math.min(tickerOrder.length || v + 10, v + 10))}
            title="+10 linhas"
            disabled={!tickerOrder.length || yLimit >= tickerOrder.length}
          >
            +10
          </button>
          <button
            className="border rounded px-2 py-1"
            onClick={() => setYLimit(tickerOrder.length || 10)}
            disabled={!tickerOrder.length || visibleTickers.length === (tickerOrder.length || 0)}
            title="Mostrar todas"
          >
            Todos
          </button>
          <span className="text-sm pl-2">
            {visibleTickers.length}/{tickerOrder.length || 0}
          </span>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={onlyMulti}
              onChange={(e) => setOnlyMulti(e.target.checked)}
            />
            Somente tickers com ≥2 boletins
          </label>
        </div>
      </div>

      {/* Selects */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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

      {/* Gráfico */}
      <div className="w-full border rounded p-2" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid />
            <XAxis
              dataKey="dateNum"
              type="number"
              domain={xDomain}
              tickFormatter={(v) => fmtDayMonth(Number(v))}
              name="Data"
              tick={{ fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="ticker"
              name="Ticker"
              ticks={visibleTickers}
              domain={visibleTickers}
              interval={0}
              tickLine={false}
              width={90}
              tick={{ fontSize: 12 }}
              allowDuplicatedCategory={false}
              tickFormatter={(t) => `${t} (${tickerCount.get(String(t)) ?? 0})`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const d = payload[0]?.payload as ScatterDatum | undefined;
                if (!d) return null;
                const date = d.dateISO || fmtUTC(d.dateNum);
                return (
                  <div className="bg-white p-2 border rounded shadow text-sm">
                    <div><strong>Data:</strong> {date}</div>
                    <div><strong>Empresa:</strong> {d.company || "—"}</div>
                    <div><strong>Ticker:</strong> {d.ticker || "—"}</div>
                    <div><strong>Canonical:</strong> {d.canonical_type || "—"}</div>
                    <div><strong>Key:</strong> {d.composite_key || "—"}</div>
                  </div>
                );
              }}
            />
            <Scatter data={chartDataVis} />
          </ScatterChart>
        </ResponsiveContainer>
        {selTickers.length > 0 && chartDataVis.length === 0 && (
          <div className="text-xs text-gray-600 mt-1">Sem eventos para a seleção no período.</div>
        )}
      </div>
      {!loading && filtered.length === 0 && (
        <div className="text-sm text-gray-600 mt-2">
          Sem resultados. Ajuste datas, empresa/ticker ou “Somente ≥2”.
        </div>
      )}

      {/* Tabela */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Resultados</h2>
        <div className="border rounded overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr className="text-left align-top">
                <th className="p-2" aria-sort={sortKey==="company" ? (sortDir==="asc"?"ascending":"descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("company")}>
                    Empresa {sortIndicator("company")}
                  </button>
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm"
                    placeholder="Filtrar"
                    value={fCompany}
                    onChange={(e) => setFCompany(e.target.value)}
                  />
                </th>
                <th className="p-2" aria-sort={sortKey==="ticker" ? (sortDir==="asc"?"ascending":"descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("ticker")}>
                    Ticker {sortIndicator("ticker")}
                  </button>
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm"
                    placeholder="Filtrar"
                    value={fTicker}
                    onChange={(e) => setFTicker(e.target.value)}
                  />
                </th>
                <th className="p-2" aria-sort={sortKey==="composite_key" ? (sortDir==="asc"?"ascending":"descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("composite_key")}>
                    Composite Key {sortIndicator("composite_key")}
                  </button>
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm"
                    placeholder="Filtrar"
                    value={fKey}
                    onChange={(e) => setFKey(e.target.value)}
                  />
                </th>
                <th className="p-2" aria-sort={sortKey==="bulletin_date" ? (sortDir==="asc"?"ascending":"descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("bulletin_date")}>
                    Data {sortIndicator("bulletin_date")}
                  </button>
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm"
                    placeholder="YYYY ou YYYY-MM ou YYYY-MM-DD"
                    value={fDate}
                    onChange={(e) => setFDate(e.target.value)}
                  />
                </th>
                <th className="p-2" aria-sort={sortKey==="canonical_type" ? (sortDir==="asc"?"ascending":"descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("canonical_type")}>
                    Tipo de Boletim {sortIndicator("canonical_type")}
                  </button>
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm"
                    placeholder="Filtrar"
                    value={fType}
                    onChange={(e) => setFType(e.target.value)}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRowsPage.map((row) => {
                const compositeKey = row.composite_key ?? "—";
                return (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{row.company}</td>
                    <td className="p-2">{row.ticker}</td>
                    <td className="p-2">
                      {row.composite_key ? (
                        <button
                          type="button"
                          onClick={() => openBulletinModal(row)}
                          className="text-blue-600 hover:underline"
                          title="Abrir boletim completo"
                        >
                          {compositeKey}
                        </button>
                      ) : (
                        compositeKey
                      )}
                    </td>
                    <td className="p-2">{row.bulletin_date}</td>
                    <td className="p-2">{row.canonical_type ?? "—"}</td>
                  </tr>
                );
              })}
              {tableRowsPage.length === 0 && (
                <tr>
                  <td className="p-2 text-gray-600" colSpan={5}>
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação simples */}
        <div className="flex items-center justify-between text-sm">
          <div>
            Mostrando {Math.min(tableLimit, tableRows.length)} de {tableRows.length}
          </div>
          <div className="flex gap-2">
            <button
              className="border rounded px-3 py-1 disabled:opacity-60"
              onClick={() => setTableLimit((v) => Math.max(PAGE, v - PAGE))}
              disabled={tableLimit <= PAGE}
              title="-50 linhas"
            >
              Mostrar menos
            </button>
            <button
              className="border rounded px-3 py-1 disabled:opacity-60"
              onClick={() => setTableLimit((v) => Math.min(tableRows.length, v + PAGE))}
              disabled={tableLimit >= tableRows.length}
              title="+50 linhas"
            >
              Mostrar mais
            </button>
          </div>
        </div>

        {selectedBulletin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30">
            <div
              className="relative bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="bulletin-title"
            >
              <button
                type="button"
                className="absolute top-3 right-3 text-sm text-gray-600 hover:text-gray-800"
                onClick={closeBulletinModal}
                aria-label="Fechar"
              >
                Fechar
              </button>
              <div className="flex flex-col gap-2 pr-12">
                <h3 id="bulletin-title" className="text-lg font-semibold">Boletim Completo</h3>
                <div className="text-sm text-gray-600">
                  <div><strong>Empresa:</strong> {selectedBulletin.company ?? "—"}</div>
                  <div><strong>Ticker:</strong> {selectedBulletin.ticker ?? "—"}</div>
                  <div><strong>Composite Key:</strong> {selectedBulletin.composite_key ?? "—"}</div>
                  <div><strong>Data:</strong> {selectedBulletin.bulletin_date ?? "—"}</div>
                </div>
                <pre className="whitespace-pre-wrap text-sm">
                  {selectedBulletin.body_text ?? "Sem conteúdo disponível."}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
