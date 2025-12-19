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
  TooltipProps,
} from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";

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
  capitalization_volume: number | string | null; // bigint pode vir como string

  halt_date: string | null; // YYYY-MM-DD
  resume_trading_date: string | null; // YYYY-MM-DD
};

type Opt = { value: string; label: string };

type PointKind = "LISTING" | "HALT" | "RESUME";

type ScatterDatum = {
  ticker_root: string;
  dateNum: number;
  dateISO: string;

  company: string;
  ticker: string;

  kind: PointKind;
};

function normalizeTickerRoot(t?: string | null) {
  return (t ?? "").trim().toUpperCase().split(".")[0];
}

function toDateNum(iso: string): number {
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

function CustomTooltip(props: TooltipProps<ValueType, NameType>) {
  if (!props.active || !props.payload || !props.payload.length) return null;
  const p0 = props.payload[0];
  const d = p0 && (p0.payload as unknown as ScatterDatum | undefined);
  if (!d) return null;

  return (
    <div className="bg-white border rounded shadow-sm p-2 text-xs">
      <div className="font-semibold">
        {d.company} ({d.ticker})
      </div>
      <div>{d.kind} • {fmtDateBR(d.dateISO)}</div>
    </div>
  );
}

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [autoPeriod, setAutoPeriod] = useState(true);

  const [selCompanies, setSelCompanies] = useState<Opt[]>([]);
  const [selTickers, setSelTickers] = useState<Opt[]>([]);

  const [yLimit, setYLimit] = useState<number>(18);

  async function fetchMinMaxCommence() {
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
    return { minDate, maxDate };
  }

  useEffect(() => {
    (async () => {
      try {
        if (!autoPeriod) return;
        const { minDate, maxDate } = await fetchMinMaxCommence();
        if (minDate) setStartDate(minDate);
        if (maxDate) setEndDate(maxDate);
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPeriod]);

  useEffect(() => {
    if (startDate && endDate && startDate > endDate) setEndDate(startDate);
  }, [startDate, endDate]);

  function clearFilters() {
    setSelCompanies([]);
    setSelTickers([]);
  }

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (autoPeriod) {
        const { minDate, maxDate } = await fetchMinMaxCommence();
        if (minDate) setStartDate(minDate);
        if (maxDate) setEndDate(maxDate);
      }

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

    return rowsInWindow.filter((r) => {
      const root = normalizeTickerRoot(r.ticker);
      if (cset.size && (!r.company_name || !cset.has(r.company_name))) return false;
      if (tset.size && (!root || !tset.has(root))) return false;
      return true;
    });
  }, [rowsInWindow, selCompanies, selTickers]);

  const kpis = useMemo(() => {
    const total = rowsFiltered.length;
    const withHalt = rowsFiltered.filter((r) => !!r.halt_date).length;
    const withResume = rowsFiltered.filter((r) => !!r.resume_trading_date).length;
    const haltedAndResumed = rowsFiltered.filter((r) => !!r.halt_date && !!r.resume_trading_date).length;
    return { total, withHalt, withResume, haltedAndResumed };
  }, [rowsFiltered]);

  const chartPoints = useMemo<ScatterDatum[]>(() => {
    const pts: ScatterDatum[] = [];
    for (const r of rowsFiltered) {
      if (!r.company_name || !r.ticker) continue;
      const root = normalizeTickerRoot(r.ticker);
      if (!root) continue;

      if (r.commence_date) {
        pts.push({
          ticker_root: root,
          dateISO: r.commence_date,
          dateNum: toDateNum(r.commence_date),
          company: r.company_name,
          ticker: r.ticker,
          kind: "LISTING",
        });
      }
      if (r.halt_date) {
        pts.push({
          ticker_root: root,
          dateISO: r.halt_date,
          dateNum: toDateNum(r.halt_date),
          company: r.company_name,
          ticker: r.ticker,
          kind: "HALT",
        });
      }
      if (r.resume_trading_date) {
        pts.push({
          ticker_root: root,
          dateISO: r.resume_trading_date,
          dateNum: toDateNum(r.resume_trading_date),
          company: r.company_name,
          ticker: r.ticker,
          kind: "RESUME",
        });
      }
    }
    return pts.filter((p) => Number.isFinite(p.dateNum));
  }, [rowsFiltered]);

  const xDomain = useMemo<[number | "auto", number | "auto"]>(() => {
    const times = chartPoints.map((d) => d.dateNum).filter((v) => Number.isFinite(v)) as number[];
    if (!times.length) return ["auto", "auto"];
    const min = Math.min(...times);
    const max = Math.max(...times);
    return [min - 5 * DAY, max + 5 * DAY];
  }, [chartPoints]);

  const xTicksMemo = useMemo(() => {
    if (xDomain[0] === "auto") {
      return {
        ticks: [] as number[],
        formatter: (v: number) => new Date(v).toISOString().slice(0, 10),
      };
    }
    return makeTicksAdaptive([xDomain[0] as number, xDomain[1] as number]);
  }, [xDomain]);

  const tickerOrder = useMemo<string[]>(() => {
    const first = new Map<string, number>();
    for (const d of chartPoints) {
      const prev = first.get(d.ticker_root);
      if (prev === undefined || d.dateNum < prev) first.set(d.ticker_root, d.dateNum);
    }
    return Array.from(first.entries()).sort((a, b) => a[1] - b[1]).map(([t]) => t);
  }, [chartPoints]);

  useEffect(() => {
    if (tickerOrder.length && yLimit > tickerOrder.length) setYLimit(tickerOrder.length);
  }, [tickerOrder.length, yLimit]);

  const visibleTickers = useMemo(
    () => tickerOrder.slice(0, Math.max(1, Math.min(yLimit, tickerOrder.length || 1))),
    [tickerOrder, yLimit],
  );

  const chartDataVis = useMemo(
    () => chartPoints.filter((d) => visibleTickers.includes(d.ticker_root)),
    [chartPoints, visibleTickers],
  );

  const chartHeight = useMemo(
    () => Math.min(1200, Math.max(300, 70 + visibleTickers.length * 26)),
    [visibleTickers.length],
  );

  async function exportTableXlsx(baseRows: Row[]) {
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
    XLSX.writeFile(wb, `cpc_universe_${s}_${e}.xlsx`);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">CPC — Universe</h1>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => exportTableXlsx(rowsFiltered)}
            disabled={!rowsFiltered.length}
            className="px-3 h-10 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
            title="Exportar tabela (.xlsx)"
            aria-label="Exportar tabela (.xlsx)"
          >
            📄 .xlsx
          </button>

          <button
            onClick={clearFilters}
            className="border rounded px-3 h-10 font-semibold"
            title="Limpar filtros"
            aria-label="Limpar filtros"
          >
            🧹
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
            placeholder="Select..."
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
            placeholder="Select..."
          />
        </div>
      </div>

      <details open className="border rounded">
        <summary className="cursor-pointer px-3 py-2 border-b text-sm font-semibold select-none">
          KPIs
        </summary>
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
      </details>

      <details open className="border rounded">
        <summary className="cursor-pointer px-3 py-2 border-b text-sm font-semibold select-none">
          Scatter
        </summary>

        <div className="px-3 py-2 border-b flex flex-wrap items-center gap-3 text-sm">
          <span className="text-xs text-black/70">Tickers visíveis:</span>

          <button
            className="border rounded px-2 h-8"
            onClick={() => setYLimit((v) => Math.max(1, v - 10))}
            aria-label="-10"
            title="-10"
          >
            −10
          </button>
          <button
            className="border rounded px-2 h-8"
            onClick={() => setYLimit((v) => Math.min(tickerOrder.length || v + 10, v + 10))}
            aria-label="+10"
            title="+10"
          >
            +10
          </button>
          <button
            className="border rounded px-2 h-8"
            onClick={() => setYLimit(Math.max(1, tickerOrder.length))}
            aria-label="Todos"
            title="Todos"
          >
            Todos
          </button>

          <span className="text-xs text-black/60 ml-auto">
            Pontos: Listing / Halt / Resume
          </span>
        </div>

        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 18, right: 16, bottom: 18, left: 14 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="dateNum"
                domain={xDomain as unknown as [number, number]}
                ticks={xTicksMemo.ticks}
                tickFormatter={xTicksMemo.formatter as unknown as (value: number) => string}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="ticker_root"
                width={110}
                tick={{ fontSize: 12 }}
                allowDuplicatedCategory={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={chartDataVis} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </details>

      <div className="w-full border rounded overflow-hidden">
        <div className="px-3 py-2 border-b text-sm flex items-center">
          <span className="font-semibold">Tabela</span>
          {loading && <span className="ml-3 text-xs text-black/60">carregando...</span>}
          <span className="ml-auto text-xs text-black/60">Linhas: {rowsFiltered.length}</span>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[1100px] w-full text-sm">
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
        Fonte: <span className="font-mono">{VIEW_NAME}</span>.
      </div>
    </div>
  );
}
