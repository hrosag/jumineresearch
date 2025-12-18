"use client";

import { useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
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

/**
 * CPC Universe — consolida "Birth" (cpc_birth) + "Events" (cpc_events) em uma única timeline.
 * Fonte recomendada: view "vw_cpc_universe" (ver SQL sugerido na resposta).
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type UniverseRow = {
  id: string | number;
  record_kind: "BIRTH" | "EVENT";
  company: string | null;
  ticker: string | null;
  ticker_root?: string | null;
  canonical_type: string | null; // "NEW LISTING-CPC-SHARES" ou "HALT", "RESUME_TRADING", etc.
  canonical_class?: string | null;

  bulletin_date: string | null; // ISO YYYY-MM-DD
  effective_date_iso?: string | null; // p/ Resume Trading etc (opcional)

  composite_key?: string | null;
  source_table?: string | null;

  // Birth (opcional)
  prospectus_date_iso?: string | null;
  commence_date_iso?: string | null;
  gross_proceeds_value?: number | null;
  gross_proceeds_value_per_share?: number | null;

  // Parser (opcional – se você trouxer da all_data / view)
  parser_profile?: string | null;
  parser_status?: string | null;
  parser_parsed_at?: string | null;
};

type ScatterDatum = {
  company: string;
  ticker: string;
  ticker_root: string;
  dateNum: number;
  canonical_type: string;
  record_kind: "BIRTH" | "EVENT";
  dateISO: string;
  composite_key?: string;
};

type Opt = { value: string; label: string };

const VIEW_NAME = "vw_cpc_universe";
const DAY = 24 * 60 * 60 * 1000;

// ---------- helpers ----------
function normalizeTicker(t?: string | null) {
  return (t ?? "").trim().toUpperCase().split(".")[0];
}
function toDateNum(iso: string | null | undefined): number {
  if (!iso) return Number.NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || "").trim());
  if (!m) return Number.NaN;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return Date.UTC(y, mo, d, 12, 0, 0);
}
function startOfDayUTC(ts: number) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function startOfMonthUTC(ts: number) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}
function startOfQuarterUTC(ts: number) {
  const d = new Date(ts);
  const q0 = Math.floor(d.getUTCMonth() / 3) * 3;
  return Date.UTC(d.getUTCFullYear(), q0, 1);
}
function addDaysUTC(ts: number, n: number) {
  return ts + n * DAY;
}
function addMonthsUTC(ts: number, n: number) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1);
}
function makeTicksAdaptive(domain: [number, number]) {
  const [min, max] = domain;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    return { ticks: [] as number[], formatter: (v: number) => new Date(v).toISOString().slice(0, 10) };
  }
  const span = max - min;
  const fYear = new Intl.DateTimeFormat("pt-BR", { year: "numeric", timeZone: "UTC" });
  const fMonY = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });
  const fMon = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
  const fDayMon = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

  if (span >= 3 * 365 * DAY) {
    let t = startOfMonthUTC(min);
    const ticks: number[] = [];
    while (t <= max) { ticks.push(t); t = addMonthsUTC(t, 12); }
    return { ticks, formatter: (v: number) => fYear.format(v) };
  }
  if (span >= 12 * 30 * DAY) {
    let t = startOfQuarterUTC(min);
    const ticks: number[] = [];
    while (t <= max) { ticks.push(t); t = addMonthsUTC(t, 3); }
    return { ticks, formatter: (v: number) => fMonY.format(v) };
  }
  if (span >= 3 * 30 * DAY) {
    let t = startOfMonthUTC(min);
    const ticks: number[] = [];
    while (t <= max) { ticks.push(t); t = addMonthsUTC(t, 1); }
    return { ticks, formatter: (v: number) => fMon.format(v) };
  }
  {
    let t = startOfDayUTC(min);
    const ticks: number[] = [];
    while (t <= max) { ticks.push(t); t = addDaysUTC(t, 15); }
    return { ticks, formatter: (v: number) => fDayMon.format(v) };
  }
}

function errMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    return typeof m === "string" ? m : "Erro desconhecido";
  }
  return "Erro desconhecido";
}

function labelKind(k: "BIRTH" | "EVENT") {
  return k === "BIRTH" ? "Birth" : "Event";
}

// =========================================================

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<UniverseRow[]>([]);

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [selCompanies, setSelCompanies] = useState<Opt[]>([]);
  const [selTickers, setSelTickers] = useState<Opt[]>([]);

  const [flagBirth, setFlagBirth] = useState(true);
  const [flagEvents, setFlagEvents] = useState(true);

  const [fCompany, setFCompany] = useState("");
  const [fTicker, setFTicker] = useState("");
  const [fKey, setFKey] = useState("");
  const [fType, setFType] = useState("");

  const dfCompany = useDeferredValue(fCompany);
  const dfTicker = useDeferredValue(fTicker);
  const dfKey = useDeferredValue(fKey);
  const dfType = useDeferredValue(fType);

  const tableRef = useRef<HTMLDivElement | null>(null);

  // Auto-período (min/max)
  useEffect(() => {
    (async () => {
      try {
        const { data: dMin, error: eMin } = await supabase
          .from(VIEW_NAME)
          .select("bulletin_date")
          .order("bulletin_date", { ascending: true })
          .limit(1);
        if (eMin) throw eMin;

        const { data: dMax, error: eMax } = await supabase
          .from(VIEW_NAME)
          .select("bulletin_date")
          .order("bulletin_date", { ascending: false })
          .limit(1);
        if (eMax) throw eMax;

        const minDate = ((dMin as { bulletin_date: string }[] | null)?.[0]?.bulletin_date) || "";
        const maxDate = ((dMax as { bulletin_date: string }[] | null)?.[0]?.bulletin_date) || "";
        if (minDate && !startDate) setStartDate(minDate);
        if (maxDate && !endDate) setEndDate(maxDate);
      } catch {
        // se falhar, deixa em branco
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (startDate && endDate && startDate > endDate) setEndDate(startDate);
  }, [startDate, endDate]);

  // Load
  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const query = supabase
        .from(VIEW_NAME)
        .select(
          "id, record_kind, company, ticker, canonical_type, canonical_class, bulletin_date, effective_date_iso, composite_key, source_table, prospectus_date_iso, commence_date_iso, gross_proceeds_value, gross_proceeds_value_per_share, parser_profile, parser_status, parser_parsed_at",
        )
        .order("bulletin_date", { ascending: true });

      if (startDate) query.gte("bulletin_date", startDate);
      if (endDate) query.lte("bulletin_date", endDate);

      const { data, error } = await query;
      if (error) throw error;

      const out = (data || []) as UniverseRow[];
      // enrich ticker_root
      const out2 = out.map((r) => ({ ...r, ticker_root: normalizeTicker(r.ticker) }));
      setRows(out2);
    } catch (e) {
      setErrorMsg(errMessage(e));
    } finally {
      setLoading(false);
    }
  }

  // Select options (dependem do dataset carregado)
  const rowsInWindow = useMemo(() => {
    return rows.filter((r) => {
      if (!r.bulletin_date) return false;
      if (startDate && r.bulletin_date < startDate) return false;
      if (endDate && r.bulletin_date > endDate) return false;
      return true;
    });
  }, [rows, startDate, endDate]);

  const companyOpts = useMemo<Opt[]>(() => {
    const s = new Set<string>();
    for (const r of rowsInWindow) if (r.company) s.add(r.company);
    return Array.from(s).sort().map((v) => ({ value: v, label: v }));
  }, [rowsInWindow]);

  const tickerOpts = useMemo<Opt[]>(() => {
    const s = new Set<string>();
    for (const r of rowsInWindow) {
      const root = normalizeTicker(r.ticker);
      if (root) s.add(root);
    }
    return Array.from(s).sort().map((v) => ({ value: v, label: v }));
  }, [rowsInWindow]);

  // Filtros principais
  const rowsFiltered = useMemo(() => {
    const cset = new Set(selCompanies.map((o) => o.value));
    const tset = new Set(selTickers.map((o) => o.value));

    const kindOk = (r: UniverseRow) =>
      (flagBirth && r.record_kind === "BIRTH") ||
      (flagEvents && r.record_kind === "EVENT");

    let data = rowsInWindow.filter((r) => {
      if (!kindOk(r)) return false;
      const root = normalizeTicker(r.ticker);
      if (cset.size && (!r.company || !cset.has(r.company))) return false;
      if (tset.size && (!root || !tset.has(root))) return false;
      return true;
    });

    const cf = dfCompany.trim().toLowerCase();
    const tf = dfTicker.trim().toLowerCase();
    const kf = dfKey.trim().toLowerCase();
    const yf = dfType.trim().toLowerCase();

    data = data.filter((r) => {
      const c = (r.company ?? "").toLowerCase();
      const t = (r.ticker ?? "").toLowerCase();
      const k = (r.composite_key ?? "").toLowerCase();
      const y = (r.canonical_type ?? "").toLowerCase();
      if (cf && !c.includes(cf)) return false;
      if (tf && !t.includes(tf)) return false;
      if (kf && !k.includes(kf)) return false;
      if (yf && !y.includes(yf)) return false;
      return true;
    });

    return data;
  }, [
    rowsInWindow,
    selCompanies,
    selTickers,
    flagBirth,
    flagEvents,
    dfCompany,
    dfTicker,
    dfKey,
    dfType,
  ]);

  // KPIs
  const kpis = useMemo(() => {
    const total = rowsFiltered.length;
    let births = 0;
    let events = 0;
    const companies = new Set<string>();
    const tickers = new Set<string>();
    for (const r of rowsFiltered) {
      if (r.record_kind === "BIRTH") births++;
      else events++;
      if (r.company) companies.add(r.company);
      const root = normalizeTicker(r.ticker);
      if (root) tickers.add(root);
    }
    return { total, births, events, companies: companies.size, tickers: tickers.size };
  }, [rowsFiltered]);

  // Scatter
  const chartData = useMemo(() => {
    return rowsFiltered
      .filter((r) => r.company && r.ticker && r.bulletin_date)
      .map((r) => ({
        company: r.company ?? "",
        ticker: r.ticker ?? "",
        ticker_root: normalizeTicker(r.ticker),
        dateNum: toDateNum(r.bulletin_date),
        canonical_type: r.canonical_type ?? "",
        record_kind: r.record_kind,
        dateISO: r.bulletin_date ?? "",
        composite_key: r.composite_key ?? undefined,
      })) as ScatterDatum[];
  }, [rowsFiltered]);

  const xDomain = useMemo<[number | "auto", number | "auto"]>(() => {
    const times = chartData.map((d) => d.dateNum).filter((v) => Number.isFinite(v)) as number[];
    if (!times.length) return ["auto", "auto"];
    const min = Math.min(...times);
    const max = Math.max(...times);
    return [min - 5 * DAY, max + 5 * DAY];
  }, [chartData]);

  const xTicksMemo = useMemo(() => {
    if (xDomain[0] === "auto") return { ticks: [] as number[], formatter: (v: number) => new Date(v).toISOString().slice(0, 10) };
    return makeTicksAdaptive([xDomain[0] as number, xDomain[1] as number]);
  }, [xDomain]);

  // ordenar tickers por 1ª ocorrência
  const tickerOrder = useMemo<string[]>(() => {
    const first = new Map<string, number>();
    for (const d of chartData) {
      if (!d.ticker_root) continue;
      const prev = first.get(d.ticker_root);
      if (Number.isFinite(d.dateNum) && (prev === undefined || d.dateNum < prev)) first.set(d.ticker_root, d.dateNum);
    }
    return Array.from(first.entries()).sort((a, b) => a[1] - b[1]).map(([t]) => t);
  }, [chartData]);

  const [yLimit, setYLimit] = useState<number>(18);
  useEffect(() => {
    if (tickerOrder.length && yLimit > tickerOrder.length) setYLimit(tickerOrder.length);
  }, [tickerOrder.length, yLimit]);

  const visibleTickers = useMemo(() => tickerOrder.slice(0, Math.max(1, Math.min(yLimit, tickerOrder.length || 1))), [tickerOrder, yLimit]);
  const chartDataVis = useMemo(() => chartData.filter((d) => d.ticker_root && visibleTickers.includes(d.ticker_root)), [chartData, visibleTickers]);

  const chartHeight = useMemo(() => Math.min(1200, Math.max(260, 60 + visibleTickers.length * 26)), [visibleTickers]);

  function onPointClick(payload: ScatterDatum) {
    if (!payload?.ticker_root) return;
    setFCompany(payload.company || "");
    setFKey(payload.composite_key || "");
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  // Export .xlsx da seleção (tabela atual)
  async function exportRowsToXlsxTable(baseRows: UniverseRow[], filenameBase: string) {
    if (!baseRows.length) {
      alert("Nada a exportar.");
      return;
    }
    const rowsPlain = baseRows.map((r) => ({
      id: r.id,
      record_kind: r.record_kind,
      company: r.company ?? "",
      ticker: r.ticker ?? "",
      bulletin_date: r.bulletin_date ?? "",
      effective_date_iso: r.effective_date_iso ?? "",
      canonical_type: r.canonical_type ?? "",
      canonical_class: r.canonical_class ?? "",
      composite_key: r.composite_key ?? "",
      source_table: r.source_table ?? "",
      // birth extras
      prospectus_date_iso: r.prospectus_date_iso ?? "",
      commence_date_iso: r.commence_date_iso ?? "",
      gross_proceeds_value: r.gross_proceeds_value ?? null,
      gross_proceeds_value_per_share: r.gross_proceeds_value_per_share ?? null,
      // parser
      parser_profile: r.parser_profile ?? "",
      parser_status: r.parser_status ?? "",
      parser_parsed_at: r.parser_parsed_at ?? "",
    }));
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rowsPlain);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CPC_Universe");
    const s = startDate ? startDate.replaceAll("-", "") : "inicio";
    const e = endDate ? endDate.replaceAll("-", "") : "fim";
    XLSX.writeFile(wb, `${filenameBase}_${s}_${e}.xlsx`);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">CPC — Universe</h1>

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="border rounded px-3 h-10 font-semibold flex items-center justify-center"
            title="Carregar (view vw_cpc_universe)"
            aria-label="Carregar"
          >
            ⚡
          </button>

          <button
            onClick={async () => exportRowsToXlsxTable(rowsFiltered, "cpc_universe")}
            disabled={!rowsFiltered.length}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
          >
            📄 Exportar (.xlsx)
          </button>
        </div>
      </div>

      {/* Datas */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col">
          <label className="block text-sm">Start</label>
          <input
            type="date"
            className="border rounded px-2 h-10"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col">
          <label className="block text-sm">End</label>
          <input
            type="date"
            className="border rounded px-2 h-10"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="ml-4 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={flagBirth}
              onChange={(e) => setFlagBirth(e.target.checked)}
            />
            Birth
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={flagEvents}
              onChange={(e) => setFlagEvents(e.target.checked)}
            />
            Events
          </label>
        </div>
      </div>

      {errorMsg && (
        <div className="border border-red-300 bg-red-50 text-red-800 p-2 rounded">
          {errorMsg}
        </div>
      )}

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
          <label className="block text-sm mb-1">Ticker (root)</label>
          <Select
            isMulti
            options={tickerOpts}
            value={selTickers}
            onChange={(v: MultiValue<Opt>) => setSelTickers(v as Opt[])}
            classNamePrefix="cpc-select"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border p-3 bg-white shadow-sm">
          <div className="text-2xl font-semibold tracking-tight">{kpis.total}</div>
          <div className="text-sm mt-1">Linhas (filtrado)</div>
        </div>
        <div className="rounded-lg border p-3 bg-white shadow-sm">
          <div className="text-2xl font-semibold tracking-tight">{kpis.births}</div>
          <div className="text-sm mt-1">Birth</div>
        </div>
        <div className="rounded-lg border p-3 bg-white shadow-sm">
          <div className="text-2xl font-semibold tracking-tight">{kpis.events}</div>
          <div className="text-sm mt-1">Events</div>
        </div>
        <div className="rounded-lg border p-3 bg-white shadow-sm">
          <div className="text-2xl font-semibold tracking-tight">{kpis.companies}</div>
          <div className="text-sm mt-1">Empresas</div>
        </div>
        <div className="rounded-lg border p-3 bg-white shadow-sm">
          <div className="text-2xl font-semibold tracking-tight">{kpis.tickers}</div>
          <div className="text-sm mt-1">Tickers (root)</div>
        </div>
      </div>

      {/* Scatter */}
      <div className="w-full border rounded overflow-hidden">
        <div className="px-2 py-2 border-b flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-black/70">Tickers visíveis:</span>
            <input
              type="number"
              className="border rounded px-2 h-8 w-20"
              value={yLimit}
              min={1}
              onChange={(e) => setYLimit(Number(e.target.value || "1"))}
            />
          </div>
          <div className="text-xs text-black/60">
            Clique no ponto → filtra tabela por empresa / composite_key
          </div>
        </div>

        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 18, right: 16, bottom: 18, left: 14 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="dateNum"
                domain={xDomain as any}
                ticks={xTicksMemo.ticks}
                tickFormatter={xTicksMemo.formatter as any}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="ticker_root"
                width={100}
                tick={{ fontSize: 12 }}
                allowDuplicatedCategory={false}
              />
              <Tooltip
                formatter={(_: unknown, __: unknown, p: any) => {
                  const d = p?.payload as ScatterDatum | undefined;
                  if (!d) return "";
                  return `${labelKind(d.record_kind)} • ${d.canonical_type}`;
                }}
                labelFormatter={(_: unknown, p: any) => {
                  const d = (p?.[0]?.payload as ScatterDatum | undefined);
                  if (!d) return "";
                  return `${d.company} (${d.ticker}) • ${d.dateISO}`;
                }}
              />
              <Scatter
                data={chartDataVis}
                onClick={(p: any) => onPointClick(p?.payload as ScatterDatum)}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filtros rápidos (tabela) */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <div>
          <label className="block text-sm">Filtro: Company</label>
          <input
            className="border rounded px-2 h-10 w-full"
            value={fCompany}
            onChange={(e) => setFCompany(e.target.value)}
            placeholder="contém..."
          />
        </div>
        <div>
          <label className="block text-sm">Filtro: Ticker</label>
          <input
            className="border rounded px-2 h-10 w-full"
            value={fTicker}
            onChange={(e) => setFTicker(e.target.value)}
            placeholder="contém..."
          />
        </div>
        <div>
          <label className="block text-sm">Filtro: composite_key</label>
          <input
            className="border rounded px-2 h-10 w-full"
            value={fKey}
            onChange={(e) => setFKey(e.target.value)}
            placeholder="contém..."
          />
        </div>
        <div>
          <label className="block text-sm">Filtro: Type</label>
          <input
            className="border rounded px-2 h-10 w-full"
            value={fType}
            onChange={(e) => setFType(e.target.value)}
            placeholder="HALT, RESUME..."
          />
        </div>
      </div>

      {/* Tabela */}
      <div ref={tableRef} className="w-full border rounded overflow-hidden">
        <div className="px-3 py-2 border-b text-sm flex items-center gap-3">
          <span className="font-semibold">Tabela</span>
          {loading && <span className="text-xs text-black/60">carregando...</span>}
          <span className="ml-auto text-xs text-black/60">
            Linhas: {rowsFiltered.length}
          </span>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-2 border-b">Kind</th>
                <th className="text-left p-2 border-b">Date</th>
                <th className="text-left p-2 border-b">Company</th>
                <th className="text-left p-2 border-b">Ticker</th>
                <th className="text-left p-2 border-b">Type</th>
                <th className="text-left p-2 border-b">Effective</th>
                <th className="text-left p-2 border-b">composite_key</th>
                <th className="text-left p-2 border-b">Parser</th>
                <th className="text-left p-2 border-b">Status</th>
                <th className="text-left p-2 border-b">Parsed At</th>
              </tr>
            </thead>
            <tbody>
              {rowsFiltered.map((r) => (
                <tr key={`${r.source_table ?? "u"}-${r.id}`}>
                  <td className="p-2 border-b">{labelKind(r.record_kind)}</td>
                  <td className="p-2 border-b">{r.bulletin_date ?? "—"}</td>
                  <td className="p-2 border-b">{r.company ?? "—"}</td>
                  <td className="p-2 border-b">{r.ticker ?? "—"}</td>
                  <td className="p-2 border-b">{r.canonical_type ?? "—"}</td>
                  <td className="p-2 border-b">{r.effective_date_iso ?? "—"}</td>
                  <td className="p-2 border-b font-mono text-xs">{r.composite_key ?? "—"}</td>
                  <td className="p-2 border-b">{r.parser_profile ?? "—"}</td>
                  <td className="p-2 border-b">{r.parser_status ?? "—"}</td>
                  <td className="p-2 border-b">{r.parser_parsed_at ?? "—"}</td>
                </tr>
              ))}
              {!rowsFiltered.length && (
                <tr>
                  <td className="p-3 text-sm text-black/60" colSpan={10}>
                    Sem dados. Ajuste datas/filtros e clique ⚡.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notas rápidas */}
      <div className="text-xs text-black/60 leading-relaxed">
        <div>
          Recomendação: carregar via view <span className="font-mono">{VIEW_NAME}</span> para evitar múltiplas queries.
        </div>
        <div>
          Se você quiser manter compatibilidade com a janela anterior, traga também{" "}
          <span className="font-mono">parser_profile/parser_status/parser_parsed_at</span> na view.
        </div>
      </div>
    </div>
  );
}
