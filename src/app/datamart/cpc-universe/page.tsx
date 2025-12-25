"use client";

import type React from "react";
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
import * as XLSX from "xlsx";

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
  filing_statement_date: string | null; // YYYY-MM-DD
  information_circular_date: string | null; // YYYY-MM-DD
};

type Opt = { value: string; label: string };

type ScatterPoint = {
  company_name: string;
  ticker: string;
  ticker_root: string;
  kind: "LISTING" | "HALT" | "RESUME" | "FILING" | "CIRCULAR";
  date: string; // YYYY-MM-DD
  x: number; // epoch ms
  y: number; // ticker index
  shares: number; // capitalization_volume numeric (for tooltip)
};

function toEpoch(dateYYYYMMDD: string) {
  // YYYY-MM-DD -> epoch local midnight (ok for scatter)
  const [y, m, d] = dateYYYYMMDD.split("-").map((v) => parseInt(v, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
}

function fmtBR(dateYYYYMMDD: string | null) {
  if (!dateYYYYMMDD) return "";
  const [y, m, d] = dateYYYYMMDD.split("-");
  if (!y || !m || !d) return dateYYYYMMDD;
  return `${d}/${m}/${y}`;
}

function numBR(v: unknown) {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
        ? Number(v)
        : v == null
          ? NaN
          : Number(v);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Tooltip renderer: keep it minimally typed to avoid breaking changes between recharts TS defs. */
type ScatterTipProps = {
  active?: boolean;
  payload?: Array<{ payload?: ScatterPoint }>;
};
function ScatterTip(props: ScatterTipProps) {
  const p0 = props.payload?.[0]?.payload;
  if (!props.active || !p0) return null;

  return (
    <div className="rounded border bg-white px-3 py-2 text-xs shadow">
      <div className="font-semibold">{p0.company_name}</div>
      <div className="text-muted-foreground">
        {p0.ticker_root}
        {p0.ticker ? ` (${p0.ticker})` : ""}
      </div>
      <div className="mt-1">
        <span className="font-medium">{p0.kind}</span> — {fmtBR(p0.date)}
      </div>
      <div className="mt-1 text-muted-foreground">O/S Shares: {numBR(p0.shares)}</div>
    </div>
  );
}

type ColKey = "company" | "ticker" | "listing" | "shares" | "halt" | "resume" | "filing" | "circular";
const COLS: Array<{ key: ColKey; label: string; align?: "left" | "right" | "center" }> = [
  { key: "company", label: "Company", align: "left" },
  { key: "ticker", label: "Ticker", align: "left" },
  { key: "listing", label: "Date of Listing", align: "center" },
  { key: "shares", label: "O/S Shares", align: "right" },
  { key: "halt", label: "Halt", align: "center" },
  { key: "resume", label: "Resume Trading", align: "center" },
  { key: "filing", label: "CPC-Filing Statement", align: "center" },
  { key: "circular", label: "CPC-Information Circular", align: "center" },
];

type SortDir = "asc" | "desc";

function tickerRootOf(ticker: string | null) {
  const t = (ticker ?? "").trim();
  if (!t) return "";
  return t.includes(".") ? t.split(".")[0] : t;
}

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // base data
  const [rows, setRows] = useState<Row[]>([]);

  // do not auto-load table data on page open
  const [applied, setApplied] = useState(false);

  // auto-period (min->max)
  const [autoPeriod, setAutoPeriod] = useState(true);
  const [minDate, setMinDate] = useState<string | null>(null);
  const [maxDate, setMaxDate] = useState<string | null>(null);

  // global filters (top)
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");

  const [companyOpt, setCompanyOpt] = useState<Opt | null>(null);
  const [tickerRoots, setTickerRoots] = useState<MultiValue<Opt>>([]);

  // table header filters (like CPC-Notices)
  const [fCompany, setFCompany] = useState("");
  const [fTicker, setFTicker] = useState("");
  const [fListing, setFListing] = useState(""); // YYYY or YYYY-MM or YYYY-MM-DD
  const [fShares, setFShares] = useState(""); // substring on formatted number or raw
  const [fHalt, setFHalt] = useState("");
  const [fResume, setFResume] = useState("");
  const [fFiling, setFFiling] = useState("");
  const [fCircular, setFCircular] = useState("");

  const dCompany = useDeferredValue(fCompany);
  const dTicker = useDeferredValue(fTicker);
  const dListing = useDeferredValue(fListing);
  const dShares = useDeferredValue(fShares);
  const dHalt = useDeferredValue(fHalt);
  const dResume = useDeferredValue(fResume);
  const dFiling = useDeferredValue(fFiling);
  const dCircular = useDeferredValue(fCircular);

  // table sort (match CPC-Notices)
  const [sortKey, setSortKey] = useState<ColKey>("listing");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(k: ColKey) {
    setSortKey((prevK) => {
      if (prevK !== k) {
        setSortDir("asc");
        return k;
      }
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return k;
    });
  }

  // table pagination (match CPC-Notices)
  const PAGE = 50;
  const [tableLimit, setTableLimit] = useState(PAGE);
  useEffect(() => {
    setTableLimit(PAGE);
  }, [dCompany, dTicker, dListing, dShares, dHalt, dResume, dFiling, dCircular, sortKey, sortDir, applied]);

  // table column widths (resizable)
  const [colW, setColW] = useState<Record<ColKey, number>>({
    company: 320,
    ticker: 110,
    listing: 160,
    shares: 150,
    halt: 140,
    resume: 170,
    filing: 180,
    circular: 210,
  });

  const dragRef = useRef<{
    key: ColKey;
    startX: number;
    startW: number;
    dragging: boolean;
  } | null>(null);

  function beginResize(e: React.PointerEvent, key: ColKey) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colW[key];
    dragRef.current = { key, startX, startW, dragging: true };

    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const cur = dragRef.current;
      if (!cur?.dragging) return;
      const dx = ev.clientX - cur.startX;
      setColW((prev) => ({
        ...prev,
        [cur.key]: clamp(cur.startW + dx, 90, 900),
      }));
    };

    const onUp = () => {
      const cur = dragRef.current;
      if (cur) cur.dragging = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function applyAutoPeriodToPickers() {
    if (minDate) setStart(minDate);
    if (maxDate) setEnd(maxDate);
  }

  function clearAll() {
    setCompanyOpt(null);
    setTickerRoots([]);
    setFCompany("");
    setFTicker("");
    setFListing("");
    setFShares("");
    setFHalt("");
    setFResume("");
    setFFiling("");
    setFCircular("");
    if (minDate) setStart(minDate);
    if (maxDate) setEnd(maxDate);
    setAutoPeriod(true);
    setSortKey("listing");
    setSortDir("asc");
  }

  // load min/max from view (commence_date) - light query
  useEffect(() => {
    let alive = true;

    async function run() {
      setErr(null);
      const { data, error } = await supabase
        .from(VIEW_NAME)
        .select("commence_date")
        .not("commence_date", "is", null)
        .order("commence_date", { ascending: true })
        .limit(1);

      const { data: data2, error: error2 } = await supabase
        .from(VIEW_NAME)
        .select("commence_date")
        .not("commence_date", "is", null)
        .order("commence_date", { ascending: false })
        .limit(1);

      if (!alive) return;

      if (error || error2) {
        setErr(error?.message ?? error2?.message ?? "Erro ao buscar min/max");
        return;
      }

      const mn = data?.[0]?.commence_date ?? null;
      const mx = data2?.[0]?.commence_date ?? null;

      setMinDate(mn);
      setMaxDate(mx);

      // initialize pickers (but DO NOT load rows automatically)
      if (mn && !start) setStart(mn);
      if (mx && !end) setEnd(mx);
    }

    run();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // enforce autoPeriod when toggled on
  useEffect(() => {
    if (!autoPeriod) return;
    if (minDate && maxDate) {
      setStart(minDate);
      setEnd(maxDate);
      // do not auto-apply
    }
  }, [autoPeriod, minDate, maxDate]);

  // load rows ONLY when applied=true
  useEffect(() => {
    let alive = true;

    async function run() {
      if (!applied) return;
      if (!start || !end) return;

      setLoading(true);
      setErr(null);

      const q = supabase
        .from(VIEW_NAME)
        .select(
          "company_name,ticker,commence_date,capitalization_volume,halt_date,resume_trading_date,filing_statement_date,information_circular_date",
        )
        .gte("commence_date", start)
        .lte("commence_date", end);

      if (companyOpt?.value) q.eq("company_name", companyOpt.value);

      if (tickerRoots.length > 0) {
        // or condition: ticker ilike 'ROOT.%'
        const ors = tickerRoots.map((o) => `ticker.ilike.${o.value}.%`).join(",");
        q.or(ors);
      }

      const { data, error } = await q.order("commence_date", { ascending: true });

      if (!alive) return;

      if (error) {
        setErr(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as Row[]);
      }

      setLoading(false);
    }

    run();
    return () => {
      alive = false;
    };
  }, [applied, start, end, companyOpt, tickerRoots]);

  // options are derived from loaded rows (after ⚡)
  const companyOptions = useMemo<Opt[]>(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.company_name) s.add(r.company_name);
    return Array.from(s)
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v }));
  }, [rows]);

  const tickerRootOptions = useMemo<Opt[]>(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const root = tickerRootOf(r.ticker);
      if (root) s.add(root);
    }
    return Array.from(s)
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v }));
  }, [rows]);

  // filter table rows (only when applied; otherwise keep empty)
  const filtered = useMemo(() => {
    if (!applied) return [] as Row[];

    const fc = dCompany.trim().toLowerCase();
    const ft = dTicker.trim().toLowerCase();
    const fl = dListing.trim();
    const fs = dShares.trim().toLowerCase();
    const fh = dHalt.trim();
    const fr = dResume.trim();
    const ff = dFiling.trim();
    const fci = dCircular.trim();

    return rows.filter((r) => {
      const company = (r.company_name ?? "").toLowerCase();
      const ticker = (r.ticker ?? "").toLowerCase();
      const listing = r.commence_date ?? "";
      const sharesRaw = r.capitalization_volume ?? "";
      const sharesStr =
        typeof sharesRaw === "number"
          ? String(sharesRaw)
          : typeof sharesRaw === "string"
            ? sharesRaw
            : "";
      const sharesFmt = numBR(sharesRaw).toLowerCase();
      const halt = r.halt_date ?? "";
      const resume = r.resume_trading_date ?? "";
      const filing = r.filing_statement_date ?? "";
      const circular = r.information_circular_date ?? "";

      if (fc && !company.includes(fc)) return false;
      if (ft && !ticker.includes(ft)) return false;
      if (fl && !listing.startsWith(fl)) return false;
      if (fs && !(sharesStr.toLowerCase().includes(fs) || sharesFmt.includes(fs))) return false;
      if (fh && !halt.startsWith(fh)) return false;
      if (fr && !resume.startsWith(fr)) return false;
      if (ff && !filing.startsWith(ff)) return false;
      if (fci && !circular.startsWith(fci)) return false;

      return true;
    });
  }, [rows, applied, dCompany, dTicker, dListing, dShares, dHalt, dResume, dFiling, dCircular]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    let withHalt = 0;
    let withResume = 0;
    let withBoth = 0;
    let withFiling = 0;
    let withCircular = 0;

    for (const r of filtered) {
      const h = !!r.halt_date;
      const rs = !!r.resume_trading_date;
      if (h) withHalt += 1;
      if (rs) withResume += 1;
      if (h && rs) withBoth += 1;
      if (r.filing_statement_date) withFiling += 1;
      if (r.information_circular_date) withCircular += 1;
    }

    return { total, withHalt, withResume, withBoth, withFiling, withCircular };
  }, [filtered]);

  // ticker order + index for Y axis
  const tickerOrder = useMemo(() => {
    const s = new Set<string>();
    for (const r of filtered) {
      const root = tickerRootOf(r.ticker);
      if (root) s.add(root);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [filtered]);

  const tickerIndex = useMemo(() => {
    const m = new Map<string, number>();
    tickerOrder.forEach((t, i) => m.set(t, i));
    return m;
  }, [tickerOrder]);

  const scatterData = useMemo<ScatterPoint[]>(() => {
    if (!applied) return [];

    const pts: ScatterPoint[] = [];

    for (const r of filtered) {
      const company_name = r.company_name ?? "";
      const ticker = r.ticker ?? "";
      const ticker_root = tickerRootOf(r.ticker);
      if (!ticker_root) continue;

      const y = tickerIndex.get(ticker_root);
      if (y == null) continue;

      const shares =
        typeof r.capitalization_volume === "number"
          ? r.capitalization_volume
          : Number(r.capitalization_volume ?? 0);

      if (r.commence_date) {
        pts.push({
          company_name,
          ticker,
          ticker_root,
          kind: "LISTING",
          date: r.commence_date,
          x: toEpoch(r.commence_date),
          y,
          shares,
        });
      }
      if (r.halt_date) {
        pts.push({
          company_name,
          ticker,
          ticker_root,
          kind: "HALT",
          date: r.halt_date,
          x: toEpoch(r.halt_date),
          y,
          shares,
        });
      }
      if (r.resume_trading_date) {
        pts.push({
          company_name,
          ticker,
          ticker_root,
          kind: "RESUME",
          date: r.resume_trading_date,
          x: toEpoch(r.resume_trading_date),
          y,
          shares,
        });
      }
      if (r.filing_statement_date) {
        pts.push({
          company_name,
          ticker,
          ticker_root,
          kind: "FILING",
          date: r.filing_statement_date,
          x: toEpoch(r.filing_statement_date),
          y,
          shares,
        });
      }
      if (r.information_circular_date) {
        pts.push({
          company_name,
          ticker,
          ticker_root,
          kind: "CIRCULAR",
          date: r.information_circular_date,
          x: toEpoch(r.information_circular_date),
          y,
          shares,
        });
      }
    }

    return pts;
  }, [filtered, applied, tickerIndex]);

  const xDomain = useMemo<[number, number]>(() => {
    if (scatterData.length === 0) return [0, 0];
    let mn = Infinity;
    let mx = -Infinity;
    for (const p of scatterData) {
      mn = Math.min(mn, p.x);
      mx = Math.max(mx, p.x);
    }
    // padding 1 day
    return [mn - DAY, mx + DAY];
  }, [scatterData]);

  const sortedRows = useMemo(() => {
    const arr = [...filtered];

    const getVal = (r: Row, k: ColKey) => {
      if (k === "company") return (r.company_name ?? "").toLowerCase();
      if (k === "ticker") return (r.ticker ?? "").toLowerCase();
      if (k === "listing") return r.commence_date ?? "";
      if (k === "halt") return r.halt_date ?? "";
      if (k === "resume") return r.resume_trading_date ?? "";
      if (k === "filing") return r.filing_statement_date ?? "";
      if (k === "circular") return r.information_circular_date ?? "";
      // shares
      const raw = r.capitalization_volume;
      const n = typeof raw === "number" ? raw : Number(raw ?? NaN);
      return Number.isFinite(n) ? n : -Infinity;
    };

    arr.sort((a, b) => {
      const va = getVal(a, sortKey);
      const vb = getVal(b, sortKey);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return arr;
  }, [filtered, sortKey, sortDir]);

  const tableRowsPage = useMemo(
    () => sortedRows.slice(0, tableLimit),
    [sortedRows, tableLimit],
  );

  const sortIndicator = (k: ColKey) =>
    sortKey === k ? (
      <span className="ml-1 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>
    ) : null;

  function exportXlsx() {
    const data = sortedRows.map((r) => ({
      Company: r.company_name ?? "",
      Ticker: r.ticker ?? "",
      "Date of Listing": r.commence_date ?? "",
      "O/S Shares": r.capitalization_volume ?? "",
      Halt: r.halt_date ?? "",
      "Resume Trading": r.resume_trading_date ?? "",
      "CPC-Filing Statement": r.filing_statement_date ?? "",
      "CPC-Information Circular": r.information_circular_date ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CPC Universe");
    XLSX.writeFile(wb, "cpc-universe.xlsx");
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header row (match CPC-Notices layout) */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="text-xl font-semibold">CPC — Universe</div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-end gap-2">
              <label className="text-xs">
                <div className="mb-1 text-muted-foreground">Start</div>
                <input
                  type="date"
                  className="h-9 rounded border px-2 text-sm"
                  value={start}
                  onChange={(e) => {
                    setAutoPeriod(false);
                    setStart(e.target.value);
                    setApplied(false);
                  }}
                />
              </label>

              <label className="text-xs">
                <div className="mb-1 text-muted-foreground">End</div>
                <input
                  type="date"
                  className="h-9 rounded border px-2 text-sm"
                  value={end}
                  onChange={(e) => {
                    setAutoPeriod(false);
                    setEnd(e.target.value);
                    setApplied(false);
                  }}
                />
              </label>

              {/* icon buttons like CPC-Notices */}
              <button
                type="button"
                className="h-9 w-9 rounded border text-sm"
                title="Aplicar auto-período (min→max) e executar"
                onClick={() => {
                  setAutoPeriod(true);
                  applyAutoPeriodToPickers(); // sets start/end
                  setApplied(true); // triggers load
                }}
              >
                ⚡
              </button>

              <button
                type="button"
                className="h-9 w-9 rounded border text-sm"
                title="Limpar filtros"
                onClick={() => {
                  clearAll();
                  setRows([]);
                  setErr(null);
                  setApplied(false);
                }}
              >
                🧹
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={autoPeriod}
                onChange={(e) => {
                  setAutoPeriod(e.target.checked);
                  setApplied(false);
                }}
              />
              Auto-período (min→max) na view
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="min-w-[340px]">
              <div className="mb-1 text-xs text-muted-foreground">Company</div>
              <Select
                instanceId="company"
                isClearable
                value={companyOpt}
                onChange={(v) => {
                  setCompanyOpt((v as Opt) ?? null);
                  setApplied(false);
                }}
                options={companyOptions}
                placeholder={applied ? "Select..." : "Execute (⚡) para carregar opções"}
                isDisabled={!applied && rows.length === 0}
              />
            </div>

            <div className="min-w-[340px]">
              <div className="mb-1 text-xs text-muted-foreground">Ticker (root)</div>
              <Select
                instanceId="tickerRoot"
                isMulti
                value={tickerRoots}
                onChange={(v) => {
                  setTickerRoots(v);
                  setApplied(false);
                }}
                options={tickerRootOptions}
                placeholder={applied ? "Select..." : "Execute (⚡) para carregar opções"}
                isDisabled={!applied && rows.length === 0}
              />
            </div>
          </div>

          {!applied ? (
            <div className="text-xs text-muted-foreground">
              Dica: clique em ⚡ para carregar os dados do período selecionado.
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-9 rounded bg-indigo-600 px-3 text-sm font-medium text-white disabled:opacity-60"
            onClick={exportXlsx}
            title="Exportar (.xlsx)"
            disabled={!sortedRows.length}
          >
            Exportar (.xlsx)
          </button>
        </div>
      </div>

      {err ? (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      {/* KPIs (closed by default, like Notices preference) */}
      <details className="rounded border">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
          KPIs
        </summary>
        <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-6">
          <div className="rounded border px-3 py-2">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-lg font-semibold">{kpis.total}</div>
          </div>
          <div className="rounded border px-3 py-2">
            <div className="text-xs text-muted-foreground">Com Halt</div>
            <div className="text-lg font-semibold">{kpis.withHalt}</div>
          </div>
          <div className="rounded border px-3 py-2">
            <div className="text-xs text-muted-foreground">Com Resume</div>
            <div className="text-lg font-semibold">{kpis.withResume}</div>
          </div>
          <div className="rounded border px-3 py-2">
            <div className="text-xs text-muted-foreground">Halt + Resume</div>
            <div className="text-lg font-semibold">{kpis.withBoth}</div>
          </div>
          <div className="rounded border px-3 py-2">
            <div className="text-xs text-muted-foreground">Com Filing Statement</div>
            <div className="text-lg font-semibold">{kpis.withFiling}</div>
          </div>
          <div className="rounded border px-3 py-2">
            <div className="text-xs text-muted-foreground">Com Information Circular</div>
            <div className="text-lg font-semibold">{kpis.withCircular}</div>
          </div>
        </div>
      </details>

      {/* Scatter (closed by default) */}
      <details className="rounded border">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
          Scatter
        </summary>
        <div className="p-3">
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <CartesianGrid />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={xDomain}
                  tickFormatter={(v) => {
                    const d = new Date(v as number);
                    const dd = String(d.getDate()).padStart(2, "0");
                    const mm = String(d.getMonth() + 1).padStart(2, "0");
                    const yy = d.getFullYear();
                    return `${dd}/${mm}/${yy}`;
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[-1, Math.max(1, tickerOrder.length)]}
                  tickFormatter={(v) => tickerOrder[v as number] ?? ""}
                  interval={0}
                />
                <Tooltip content={<ScatterTip />} />
                <Scatter
                  data={scatterData}
                  onClick={(p) => {
                    const sp = (p as unknown as { payload?: ScatterPoint }).payload;
                    if (!sp) return;
                    if (sp.company_name) setCompanyOpt({ value: sp.company_name, label: sp.company_name });
                    if (sp.ticker_root) setTickerRoots([{ value: sp.ticker_root, label: sp.ticker_root }]);
                    // user can click ⚡ again to re-run with those filters
                    setApplied(false);
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Dica: clique em um ponto para preencher Company e Ticker (root). Depois clique em ⚡.
          </div>
        </div>
      </details>

      {/* Table (no "Tabela" label, no line count) */}
      <div className="rounded border">
        {/* horizontal scroll + resizable columns */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1220px] border-collapse text-sm">
            <thead>
              <tr className="bg-muted/40">
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    className="relative border-b px-2 py-2 text-left font-semibold select-none"
                    style={{ width: colW[c.key], minWidth: colW[c.key] }}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center"
                      onClick={() => toggleSort(c.key)}
                      title="Ordenar"
                    >
                      {c.label}
                      {sortIndicator(c.key)}
                    </button>

                    {/* resize handle */}
                    <span
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                      onPointerDown={(e) => beginResize(e, c.key)}
                      title="Arraste para redimensionar"
                    />
                  </th>
                ))}
              </tr>

              {/* filter row */}
              <tr className="bg-white">
                <th className="border-b px-2 py-2" style={{ width: colW.company }}>
                  <input
                    className="h-8 w-full rounded border px-2 text-xs"
                    placeholder="Filtrar"
                    value={fCompany}
                    onChange={(e) => setFCompany(e.target.value)}
                  />
                </th>
                <th className="border-b px-2 py-2" style={{ width: colW.ticker }}>
                  <input
                    className="h-8 w-full rounded border px-2 text-xs"
                    placeholder="Filtrar"
                    value={fTicker}
                    onChange={(e) => setFTicker(e.target.value)}
                  />
                </th>
                <th className="border-b px-2 py-2 text-center" style={{ width: colW.listing }}>
                  <input
                    className="h-8 w-full rounded border px-2 text-xs"
                    placeholder="YYYY ou YYYY-MM ou YYYY-MM-DD"
                    value={fListing}
                    onChange={(e) => setFListing(e.target.value)}
                  />
                </th>
                <th className="border-b px-2 py-2" style={{ width: colW.shares }}>
                  <input
                    className="h-8 w-full rounded border px-2 text-xs text-right"
                    placeholder="Filtrar"
                    value={fShares}
                    onChange={(e) => setFShares(e.target.value)}
                  />
                </th>
                <th className="border-b px-2 py-2 text-center" style={{ width: colW.halt }}>
                  <input
                    className="h-8 w-full rounded border px-2 text-xs"
                    placeholder="YYYY-MM-DD"
                    value={fHalt}
                    onChange={(e) => setFHalt(e.target.value)}
                  />
                </th>
                <th className="border-b px-2 py-2 text-center" style={{ width: colW.resume }}>
                  <input
                    className="h-8 w-full rounded border px-2 text-xs"
                    placeholder="YYYY-MM-DD"
                    value={fResume}
                    onChange={(e) => setFResume(e.target.value)}
                  />
                </th>
                <th className="border-b px-2 py-2 text-center" style={{ width: colW.filing }}>
                  <input
                    className="h-8 w-full rounded border px-2 text-xs"
                    placeholder="YYYY-MM-DD"
                    value={fFiling}
                    onChange={(e) => setFFiling(e.target.value)}
                  />
                </th>
                <th className="border-b px-2 py-2 text-center" style={{ width: colW.circular }}>
                  <input
                    className="h-8 w-full rounded border px-2 text-xs"
                    placeholder="YYYY-MM-DD"
                    value={fCircular}
                    onChange={(e) => setFCircular(e.target.value)}
                  />
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-2 py-3 text-xs text-muted-foreground" colSpan={COLS.length}>
                    Carregando...
                  </td>
                </tr>
              ) : !applied ? (
                <tr>
                  <td className="px-2 py-3 text-xs text-muted-foreground" colSpan={COLS.length}>
                    Clique em ⚡ para carregar os dados.
                  </td>
                </tr>
              ) : tableRowsPage.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-xs text-muted-foreground" colSpan={COLS.length}>
                    Nenhum resultado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                tableRowsPage.map((r, idx) => (
                  <tr key={`${r.ticker ?? ""}-${r.commence_date ?? ""}-${idx}`} className="hover:bg-muted/30">
                    <td className="border-b px-2 py-2" style={{ width: colW.company }}>
                      {r.company_name ?? ""}
                    </td>
                    <td className="border-b px-2 py-2" style={{ width: colW.ticker }}>
                      {r.ticker ?? ""}
                    </td>
                    <td className="border-b px-2 py-2 text-center" style={{ width: colW.listing }}>
                      {fmtBR(r.commence_date)}
                    </td>
                    <td className="border-b px-2 py-2 text-right" style={{ width: colW.shares }}>
                      {numBR(r.capitalization_volume)}
                    </td>
                    <td className="border-b px-2 py-2 text-center" style={{ width: colW.halt }}>
                      {fmtBR(r.halt_date)}
                    </td>
                    <td className="border-b px-2 py-2 text-center" style={{ width: colW.resume }}>
                      {fmtBR(r.resume_trading_date)}
                    </td>
                    <td className="border-b px-2 py-2 text-center" style={{ width: colW.filing }}>
                      {fmtBR(r.filing_statement_date)}
                    </td>
                    <td className="border-b px-2 py-2 text-center" style={{ width: colW.circular }}>
                      {fmtBR(r.information_circular_date)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* paginator like Notices (show more) */}
        {applied && sortedRows.length > 0 ? (
          <div className="flex items-center justify-end gap-2 px-3 py-2">
            <button
              type="button"
              className="rounded border px-3 py-1 text-xs disabled:opacity-60"
              onClick={() => setTableLimit((v) => Math.max(PAGE, v + PAGE))}
              disabled={tableLimit >= sortedRows.length}
              title="Mostrar mais"
            >
              Mostrar mais
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
