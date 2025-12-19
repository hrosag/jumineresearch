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
  type TooltipProps,
} from "recharts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const VIEW_NAME = "vw_cpc_universe";
const DAY = 24 * 60 * 60 * 1000;

type Row = {
  company_name: string | null;
  ticker: string | null;

  commence_date: string | null; // YYYY-MM-DD
  capitalization_volume: number | string | null; // bigint pode vir string

  halt_date: string | null; // YYYY-MM-DD
  resume_trading_date: string | null; // YYYY-MM-DD
};

type Opt = { value: string; label: string };

type ScatterPoint = {
  company_name: string;
  ticker: string;
  ticker_root: string;

  point_kind: "LISTING" | "HALT" | "RESUME";
  date_iso: string; // YYYY-MM-DD
  date_num: number; // UTC ms
};

function normalizeTickerRoot(t?: string | null) {
  return (t ?? "").trim().toUpperCase().split(".")[0];
}

function toDateNum(iso?: string | null) {
  if (!iso) return Number.NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return Number.NaN;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return Date.UTC(y, mo, d, 12, 0, 0);
}

function fmtDateBR(iso?: string | null) {
  if (!iso) return "—";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(dt);
}

function fmtIntBR(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return String(v);
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

function errMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    return typeof m === "string" ? m : "Erro desconhecido";
  }
  return "Erro desconhecido";
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

function isScatterClickPayload(x: unknown): x is { payload?: ScatterPoint } {
  if (!x || typeof x !== "object") return false;
  if (!("payload" in x)) return false;
  return true;
}

function ScatterTip(props: TooltipProps<number, string>) {
  const p0 = props.payload?.[0];
  const sp = (p0?.payload ?? null) as ScatterPoint | null;

  if (!props.active || !sp) return null;

  const kindLabel =
    sp.point_kind === "LISTING" ? "Listing" :
    sp.point_kind === "HALT" ? "Halt" :
    "Resume Trading";

  return (
    <div className="bg-white border rounded px-3 py-2 text-sm shadow">
      <div className="font-semibold">{sp.company_name}</div>
      <div className="text-xs text-black/70">{sp.ticker} • {sp.ticker_root}</div>
      <div className="mt-1">{kindLabel}: {fmtDateBR(sp.date_iso)}</div>
    </div>
  );
}

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const [autoPeriod, setAutoPeriod] = useState(true);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [selCompanies, setSelCompanies] = useState<Opt[]>([]);
  const [selTickers, setSelTickers] = useState<Opt[]>([]);

  const [search, setSearch] = useState("");
  const dfSearch = useDeferredValue(search);

  const [showKpis, setShowKpis] = useState(true);
  const [showScatter, setShowScatter] = useState(true);

  const [yLimit, setYLimit] = useState<number>(18);

  const tableRef = useRef<HTMLDivElement | null>(null);

  async function applyAutoPeriod() {
    try {
      const { data: dMin, error: eMin } = await supabase
        .from(VIEW_NAME)
        .select("commence_date")
        .order("commence_date", { ascending: true })
        .limit(1);
      if (eMin) throw eMin;

      const { data: dMax, error: eMax } = await supabase
        .from(VIEW_NAME)
        .select("commence_date")
        .order("commence_date", { ascending: false })
        .limit(1);
      if (eMax) throw eMax;

      const minDate = ((dMin as { commence_date: string }[] | null)?.[0]?.commence_date) || "";
      const maxDate = ((dMax as { commence_date: string }[] | null)?.[0]?.commence_date) || "";
      if (minDate) setStartDate(minDate);
      if (maxDate) setEndDate(maxDate);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (autoPeriod) void applyAutoPeriod();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPeriod]);

  useEffect(() => {
    if (startDate && endDate && startDate > endDate) setEndDate(startDate);
  }, [startDate, endDate]);

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const q = supabase
        .from(VIEW_NAME)
        .select("company_name,ticker,commence_date,capitalization_volume,halt_date,resume_trading_date")
        .order("commence_date", { ascending: true });

      if (startDate) q.gte("commence_date", startDate);
      if (endDate) q.lte("commence_date", endDate);

      const { data, error } = await q;
      if (error) throw error;

      setRows((data || []) as Row[]);
    } catch (e) {
      setErrorMsg(errMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setSelCompanies([]);
    setSelTickers([]);
    setSearch("");
    setYLimit(18);
    if (autoPeriod) void applyAutoPeriod();
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  const rowsInWindow = useMemo(() => {
    return rows.filter((r) => {
      if (!r.commence_date) return false;
      if (startDate && r.commence_date < startDate) return false;
      if (endDate && r.commence_date > endDate) return false;
      return true;
    });
  }, [rows, startDate, endDate]);

  const companyOpts = useMemo<Opt[]>(() => {
    const s = new Set<string>();
    for (const r of rowsInWindow) if (r.company_name) s.add(r.company_name);
    return Array.from(s).sort().map((v) => ({ value: v, label: v }));
  }, [rowsInWindow]);

  const tickerOpts = useMemo<Opt[]>(() => {
    const s = new Set<string>();
    for (const r of rowsInWindow) {
      const root = normalizeTickerRoot(r.ticker);
      if (root) s.add(root);
    }
    return Array.from(s).sort().map((v) => ({ value: v, label: v }));
  }, [rowsInWindow]);

  const rowsFiltered = useMemo(() => {
    const cset = new Set(selCompanies.map((o) => o.value));
    const tset = new Set(selTickers.map((o) => o.value));

    let data = rowsInWindow.filter((r) => {
      const root = normalizeTickerRoot(r.ticker);
      if (cset.size && (!r.company_name || !cset.has(r.company_name))) return false;
      if (tset.size && (!root || !tset.has(root))) return false;
      return true;
    });

    const q = dfSearch.trim().toLowerCase();
    if (q) {
      data = data.filter((r) => {
        const c = (r.company_name ?? "").toLowerCase();
        const t = (r.ticker ?? "").toLowerCase();
        return c.includes(q) || t.includes(q);
      });
    }

    return data;
  }, [rowsInWindow, selCompanies, selTickers, dfSearch]);

  const kpis = useMemo(() => {
    const total = rowsFiltered.length;
    const withHalt = rowsFiltered.filter((r) => !!r.halt_date).length;
    const withResume = rowsFiltered.filter((r) => !!r.resume_trading_date).length;
    const haltedAndResumed = rowsFiltered.filter((r) => !!r.halt_date && !!r.resume_trading_date).length;
    return { total, withHalt, withResume, haltedAndResumed };
  }, [rowsFiltered]);

  const scatterData = useMemo<ScatterPoint[]>(() => {
    const out: ScatterPoint[] = [];
    for (const r of rowsFiltered) {
      if (!r.company_name || !r.ticker) continue;
      const root = normalizeTickerRoot(r.ticker);

      if (r.commence_date) {
        out.push({
          company_name: r.company_name,
          ticker: r.ticker,
          ticker_root: root,
          point_kind: "LISTING",
          date_iso: r.commence_date,
          date_num: toDateNum(r.commence_date),
        });
      }
      if (r.halt_date) {
        out.push({
          company_name: r.company_name,
          ticker: r.ticker,
          ticker_root: root,
          point_kind: "HALT",
          date_iso: r.halt_date,
          date_num: toDateNum(r.halt_date),
        });
      }
      if (r.resume_trading_date) {
        out.push({
          company_name: r.company_name,
          ticker: r.ticker,
          ticker_root: root,
          point_kind: "RESUME",
          date_iso: r.resume_trading_date,
          date_num: toDateNum(r.resume_trading_date),
        });
      }
    }
    return out.filter((p) => Number.isFinite(p.date_num));
  }, [rowsFiltered]);

  const xDomain = useMemo<[number | "auto", number | "auto"]>(() => {
    const times = scatterData.map((d) => d.date_num).filter((v) => Number.isFinite(v)) as number[];
    if (!times.length) return ["auto", "auto"];
    const min = Math.min(...times);
    const max = Math.max(...times);
    return [min - 5 * DAY, max + 5 * DAY];
  }, [scatterData]);

  const xTicksMemo = useMemo(() => {
    if (xDomain[0] === "auto") return { ticks: [] as number[], formatter: (v: number) => new Date(v).toISOString().slice(0, 10) };
    return makeTicksAdaptive([xDomain[0] as number, xDomain[1] as number]);
  }, [xDomain]);

  const tickerOrder = useMemo<string[]>(() => {
    const first = new Map<string, number>();
    for (const d of scatterData) {
      const prev = first.get(d.ticker_root);
      if (Number.isFinite(d.date_num) && (prev === undefined || d.date_num < prev)) first.set(d.ticker_root, d.date_num);
    }
    return Array.from(first.entries()).sort((a, b) => a[1] - b[1]).map(([t]) => t);
  }, [scatterData]);

  useEffect(() => {
    if (tickerOrder.length && yLimit > tickerOrder.length) setYLimit(tickerOrder.length);
  }, [tickerOrder.length, yLimit]);

  const visibleTickers = useMemo(
    () => tickerOrder.slice(0, Math.max(1, Math.min(yLimit, tickerOrder.length || 1))),
    [tickerOrder, yLimit],
  );
  const scatterVis = useMemo(
    () => scatterData.filter((d) => visibleTickers.includes(d.ticker_root)),
    [scatterData, visibleTickers],
  );
  const chartHeight = useMemo(
    () => Math.min(1200, Math.max(280, 70 + visibleTickers.length * 26)),
    [visibleTickers],
  );

  function onScatterClick(x: unknown) {
    if (!isScatterClickPayload(x)) return;
    const p = x.payload;
    if (!p) return;

    setSelCompanies([{ value: p.company_name, label: p.company_name }]);
    setSelTickers([{ value: p.ticker_root, label: p.ticker_root }]);
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function exportRowsToXlsx(baseRows: Row[], filenameBase: string) {
    if (!baseRows.length) {
      alert("Nada a exportar.");
      return;
    }
    const rowsPlain = baseRows.map((r) => ({
      company_name: r.company_name ?? "",
      ticker: r.ticker ?? "",
      date_of_listing: r.commence_date ?? "",
      os_shares: r.capitalization_volume ?? null,
      halt_date: r.halt_date ?? "",
      resume_trading_date: r.resume_trading_date ?? "",
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
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">CPC — Universe</h1>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={clearFilters}
            className="border rounded px-3 h-10 font-semibold"
            title="Limpar filtros"
            aria-label="Limpar filtros"
          >
            🧹
          </button>

          <button
            onClick={async () => exportRowsToXlsx(rowsFiltered, "cpc_universe")}
            disabled={!rowsFiltered.length}
            className="px-4 h-10 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60 font-semibold"
            title="Exportar tabela (.xlsx)"
          >
            📄 Exportar (.xlsx)
          </button>

          <button
            onClick={load}
            disabled={loading}
            className="border rounded px-3 h-10 font-semibold flex items-center justify-center"
            title={`Carregar (${VIEW_NAME})`}
            aria-label="Carregar"
          >
            ⚡
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className="block text-sm">Start</label>
          <input
            type="date"
            className="border rounded px-2 h-10"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => {
              setAutoPeriod(false);
              setStartDate(e.target.value);
            }}
          />
        </div>
        <div className="flex flex-col">
          <label className="block text-sm">End</label>
          <input
            type="date"
            className="border rounded px-2 h-10"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => {
              setAutoPeriod(false);
              setEndDate(e.target.value);
            }}
          />
        </div>

        <label className="flex items-center gap-2 text-sm ml-2 select-none">
          <input
            type="checkbox"
            checked={autoPeriod}
            onChange={(e) => setAutoPeriod(e.target.checked)}
          />
          Auto-período (min→max) na view
        </label>
      </div>

      {errorMsg && (
        <div className="border border-red-300 bg-red-50 text-red-800 p-2 rounded">
          {errorMsg}
        </div>
      )}

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

      <div className="max-w-[520px]">
        <label className="block text-sm">Search (Company ou Ticker)</label>
        <input
          className="border rounded px-2 h-10 w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="contém..."
        />
      </div>

      <div className="space-y-3">
        <div className="border rounded">
          <button
            className="w-full text-left px-3 py-2 border-b font-semibold"
            onClick={() => setShowKpis((v) => !v)}
          >
            {showKpis ? "▾" : "▸"} KPIs
          </button>
          {showKpis && (
            <div className="p-3">
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <div className="rounded-lg border p-3 bg-white shadow-sm">
                  <div className="text-2xl font-semibold tracking-tight">{kpis.total}</div>
                  <div className="text-sm mt-1">CPCs (filtrado)</div>
                </div>
                <div className="rounded-lg border p-3 bg-white shadow-sm">
                  <div className="text-2xl font-semibold tracking-tight">{kpis.withHalt}</div>
                  <div className="text-sm mt-1">Com HALT</div>
                </div>
                <div className="rounded-lg border p-3 bg-white shadow-sm">
                  <div className="text-2xl font-semibold tracking-tight">{kpis.withResume}</div>
                  <div className="text-sm mt-1">Com RESUME</div>
                </div>
                <div className="rounded-lg border p-3 bg-white shadow-sm">
                  <div className="text-2xl font-semibold tracking-tight">{kpis.haltedAndResumed}</div>
                  <div className="text-sm mt-1">HALT + RESUME</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border rounded overflow-hidden">
          <button
            className="w-full text-left px-3 py-2 border-b font-semibold"
            onClick={() => setShowScatter((v) => !v)}
          >
            {showScatter ? "▾" : "▸"} Scatter
          </button>

          {showScatter && (
            <>
              <div className="px-3 py-2 border-b flex flex-wrap items-center gap-3 text-sm">
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
                  Clique no ponto → filtra Company/Ticker
                </div>
              </div>

              <div style={{ height: chartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 18, right: 16, bottom: 18, left: 14 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="date_num"
                      domain={xDomain as [number | "auto", number | "auto"]}
                      ticks={xTicksMemo.ticks}
                      tickFormatter={xTicksMemo.formatter}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="ticker_root"
                      width={100}
                      tick={{ fontSize: 12 }}
                      allowDuplicatedCategory={false}
                    />
                    <Tooltip content={<ScatterTip />} />
                    <Scatter data={scatterVis} onClick={onScatterClick} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>

      <div ref={tableRef} className="w-full border rounded overflow-hidden">
        <div className="px-3 py-2 border-b text-sm flex items-center gap-3">
          <span className="font-semibold">Tabela</span>
          {loading && <span className="text-xs text-black/60">carregando...</span>}
          <span className="ml-auto text-xs text-black/60">Linhas: {rowsFiltered.length}</span>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[1150px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-2 border-b">Company</th>
                <th className="text-left p-2 border-b">Ticker</th>
                <th className="text-left p-2 border-b">Date of Listing</th>
                <th className="text-right p-2 border-b">O/S Shares</th>
                <th className="text-left p-2 border-b">Halt</th>
                <th className="text-left p-2 border-b">Resume Trading</th>
              </tr>
            </thead>
            <tbody>
              {rowsFiltered.map((r) => (
                <tr key={`${r.ticker ?? "t"}-${r.commence_date ?? "d"}-${r.company_name ?? "c"}`}>
                  <td className="p-2 border-b">{r.company_name ?? "—"}</td>
                  <td className="p-2 border-b">{r.ticker ?? "—"}</td>
                  <td className="p-2 border-b">{fmtDateBR(r.commence_date)}</td>
                  <td className="p-2 border-b text-right tabular-nums">{fmtIntBR(r.capitalization_volume)}</td>
                  <td className="p-2 border-b">{fmtDateBR(r.halt_date)}</td>
                  <td className="p-2 border-b">{fmtDateBR(r.resume_trading_date)}</td>
                </tr>
              ))}
              {!rowsFiltered.length && (
                <tr>
                  <td className="p-3 text-sm text-black/60" colSpan={6}>
                    Sem dados. Ajuste datas/filtros e clique ⚡.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-black/60 leading-relaxed">
        Fonte: <span className="font-mono">{VIEW_NAME}</span>. Datas e números formatados no front (pt-BR).
      </div>
    </div>
  );
}
