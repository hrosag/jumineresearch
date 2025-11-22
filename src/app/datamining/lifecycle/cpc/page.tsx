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
  BarChart,
  Bar,
  LabelList,
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
  ticker_root: string;
  dateNum: number;
  canonical_type: string;
  type_display: string;
  dateISO: string;
  composite_key?: string;
};

type Opt = { value: string; label: string };

const CPC_CANONICAL = "NEW LISTING-CPC-SHARES";
type SortKey = "company" | "ticker" | "composite_key" | "bulletin_date" | "canonical_type";
type SortDir = "asc" | "desc";

// ---------- helpers ----------
const DAY = 24 * 60 * 60 * 1000;
function toDateNum(iso: string | null | undefined): number {
  if (!iso) return Number.NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || "").trim());
  if (!m) return Number.NaN;
  const y = Number(m[1]); const mo = Number(m[2]) - 1; const d = Number(m[3]);
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
function normalizeTicker(t?: string | null) {
  return (t ?? "").trim().toUpperCase().replace(/\.P$/, "");
}

function withBodyTextFilled(rows: Row[], map: Map<string, string>) {
  return rows.map(r => {
    if (r.body_text || !r.composite_key) return r;
    return { ...r, body_text: map.get(r.composite_key) ?? r.body_text ?? "" };
  });
}
function keyCT(company?: string | null, ticker?: string | null) {
  return `${(company ?? "").trim()}|${normalizeTicker(ticker)}`;
}

function startOfDayUTC(ts: number) { const d = new Date(ts); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
function startOfMonthUTC(ts: number) { const d = new Date(ts); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); }
function startOfQuarterUTC(ts: number) { const d = new Date(ts); const q0 = Math.floor(d.getUTCMonth() / 3) * 3; return Date.UTC(d.getUTCFullYear(), q0, 1); }
function startOfYearUTC(ts: number) { const d = new Date(ts); return Date.UTC(d.getUTCFullYear(), 0, 1); }
function addDaysUTC(ts: number, n: number) { return ts + n * DAY; }
function addMonthsUTC(ts: number, n: number) { const d = new Date(ts); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1); }

function makeTicksAdaptive(domain: [number, number]) {
  const [min, max] = domain;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return { ticks: [] as number[], formatter: (v: number) => fmtDayMonth(v) };
  const span = max - min;
  const fYear = new Intl.DateTimeFormat("pt-BR", { year: "numeric", timeZone: "UTC" });
  const fMonY = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });
  const fMon = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
  const fDayMon = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  if (span >= 3 * 365 * DAY) { let t = startOfYearUTC(min); const ticks: number[] = []; while (t <= max) { ticks.push(t); t = addMonthsUTC(t, 12); } return { ticks, formatter: (v: number) => fYear.format(v) }; }
  if (span >= 12 * 30 * DAY) { let t = startOfQuarterUTC(min); const ticks: number[] = []; while (t <= max) { ticks.push(t); t = addMonthsUTC(t, 3); } return { ticks, formatter: (v: number) => fMonY.format(v) }; }
  if (span >= 3 * 30 * DAY) { let t = startOfMonthUTC(min); const ticks: number[] = []; while (t <= max) { ticks.push(t); t = addMonthsUTC(t, 1); } return { ticks, formatter: (v: number) => fMon.format(v) }; }
  if (span >= 60 * DAY) { let t = startOfDayUTC(min); const ticks: number[] = []; while (t <= max) { ticks.push(t); t = addDaysUTC(t, 15); } return { ticks, formatter: (v: number) => fDayMon.format(v) }; }
  if (span >= 14 * DAY) { let t = startOfDayUTC(min); const ticks: number[] = []; while (t <= max) { ticks.push(t); t = addDaysUTC(t, 7); } return { ticks, formatter: (v: number) => fDayMon.format(v) }; }
  { let t = startOfDayUTC(min); const ticks: number[] = []; while (t <= max) { ticks.push(t); t = addDaysUTC(t, 1); } return { ticks, formatter: (v: number) => fDayMon.format(v) }; }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function errMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    return typeof m === "string" ? m : "Erro desconhecido";
  }
  return "Erro desconhecido";
}

function computeAnchorRange(map: Map<string, string>): { min: string; max: string } | null {
  const dates = Array.from(map.values()).filter(Boolean);
  if (!dates.length) return null;
  const min = dates.reduce((a, b) => (a < b ? a : b));
  const max = dates.reduce((a, b) => (a > b ? a : b));
  return { min, max };
}

// Tipagem explícita para evitar "any" no LabelList custom
type BarLabelProps = {
  x?: number;
  y?: number;
  width?: number;
  value?: number | string;
};

// Custom label for BarChart values (consistent size/position)
function BarValueLabel(props: BarLabelProps) {
  const { x, y, width, value } = props;
  const cx = (x ?? 0) + (width ?? 0) / 2;
  const vy = (y ?? 0) - 6;
  return (
    <text x={cx} y={vy} textAnchor="middle" fontSize={12} fontWeight={600}>
      {value}
    </text>
  );
}

// =========================================================

export default function Page() {
  const [loadingAnchors, setLoadingAnchors] = useState(false);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [useAnchor, setUseAnchor] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [selCompanies, setSelCompanies] = useState<Opt[]>([]);
  const [selTickers, setSelTickers] = useState<Opt[]>([]);

  // FLAGS: só afetam o Scatter
  const [onlyMulti, setOnlyMulti] = useState(false);
  const [onlySingle, setOnlySingle] = useState(false);
  const [onlyFirst, setOnlyFirst] = useState(false);
  const [onlyLast, setOnlyLast] = useState(false);
  const [showTickerAxis, setShowTickerAxis] = useState(true);

  // filtros da tabela
  const [sortKey, setSortKey] = useState<SortKey>("bulletin_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [fCompany, setFCompany] = useState("");
  const [fTicker, setFTicker] = useState("");
  const [fKey, setFKey] = useState("");
  const [fDate, setFDate] = useState("");
  const [fType, setFType] = useState("");

  const dfCompany = useDeferredValue(fCompany);
  const dfTicker = useDeferredValue(fTicker);
  const dfKey = useDeferredValue(fKey);
  const dfDate = useDeferredValue(fDate);
  const dfType = useDeferredValue(fType);

  const PAGE = 50;
  const [tableLimit, setTableLimit] = useState(PAGE);

  const tableRef = useRef<HTMLDivElement | null>(null);
  const firstRowRef = useRef<HTMLTableRowElement | null>(null);

  // acordeões
  const [showChart, setShowChart] = useState(true);
  const [showStats, setShowStats] = useState(true);

  // Âncoras
  const [anchors, setAnchors] = useState<Map<string, string>>(new Map());
  const [anchorCompanies, setAnchorCompanies] = useState<string[]>([]);

  // fetch âncoras
  useEffect(() => {
    (async () => {
      setLoadingAnchors(true);
      setErrorMsg(null);
      try {
        const { data, error } = await supabase
          .from("vw_bulletins_with_canonical")
          .select("company, ticker, bulletin_date, canonical_type, bulletin_type")
          .or(`canonical_type.eq.${CPC_CANONICAL},bulletin_type.ilike.%${CPC_CANONICAL}%`);
        if (error) throw error;

        const map = new Map<string, string>();
        const companies = new Set<string>();
        for (const r of (data || []) as Row[]) {
          const key = keyCT(r.company, r.ticker);
          const d = r.bulletin_date || "";
          if (!d) continue;
          const hasCpc =
            r.canonical_type === CPC_CANONICAL ||
            (r.bulletin_type || "").toUpperCase().includes(CPC_CANONICAL);
          if (!hasCpc) continue;
          if (!map.has(key) || d < (map.get(key) as string)) map.set(key, d);
          if (r.company) companies.add(r.company);
        }
        setAnchors(map);
        setAnchorCompanies(Array.from(companies).sort());
      } catch (e) {
        setErrorMsg(errMessage(e));
      } finally {
        setLoadingAnchors(false);
      }
    })();
  }, []);

  // 3) ao ligar "ancorar dados", preencher Start/End com o range CPC
  useEffect(() => {
    if (!useAnchor) return;
    const r = computeAnchorRange(anchors);
    if (!r) return;
    if (!startDate) setStartDate(r.min);
    if (!endDate) setEndDate(r.max);
  }, [useAnchor, anchors, startDate, endDate]);

  // dataset simples (GO sem âncora)
  async function fetchSimpleWindow() {
    setLoadingTimeline(true);
    setErrorMsg(null);
    try {
      const q = supabase
        .from("vw_bulletins_with_canonical")
        .select("id, source_file, company, ticker, bulletin_type, canonical_type, bulletin_date, composite_key")
        .order("bulletin_date", { ascending: true });
      if (startDate) q.gte("bulletin_date", startDate);
      if (endDate) q.lte("bulletin_date", endDate);
      const { data, error } = await q;
      if (error) throw error;
      setRows((data || []) as Row[]);
    } catch (e) {
      setErrorMsg(errMessage(e));
    } finally {
      setLoadingTimeline(false);
    }
  }

  // timeline pós-âncora (GO com âncora)
  function computeMinAnchorByCompany(map: Map<string, string>) {
    const perCompany = new Map<string, string>();
    for (const k of map.keys()) {
      const [company] = k.split("|");
      const d = map.get(k)!;
      const prev = perCompany.get(company);
      if (!prev || d < prev) perCompany.set(company, d);
    }
    return perCompany;
  }
  async function fetchTimelineAfterAnchor() {
    if (!anchors.size || !anchorCompanies.length) {
      setErrorMsg("Âncoras indisponíveis.");
      return;
    }
    setLoadingTimeline(true);
    setErrorMsg(null);
    try {
      const perCompanyMin = computeMinAnchorByCompany(anchors);
      const chunks = chunk(anchorCompanies, 100);
      const allowedKeys = new Set(anchors.keys());
      const all: Row[] = [];
      for (const companies of chunks) {
        let chunkMin = "9999-12-31";
        for (const c of companies) {
          const d = perCompanyMin.get(c)!;
          if (d < chunkMin) chunkMin = d;
        }
        const query = supabase
          .from("vw_bulletins_with_canonical")
          .select("id, source_file, company, ticker, bulletin_type, canonical_type, bulletin_date, composite_key")
          .in("company", companies)
          .gte("bulletin_date", chunkMin)
          .order("bulletin_date", { ascending: true });
        if (endDate) query.lte("bulletin_date", endDate);
        const { data, error } = await query;
        if (error) throw error;
        for (const r of (data || []) as Row[]) {
          const key = keyCT(r.company, r.ticker);
          if (!allowedKeys.has(key)) continue;
          const anchor = anchors.get(key);
          if (!anchor || !r.bulletin_date || r.bulletin_date < anchor) continue;
          all.push(r);
        }
      }
      setRows(all);
    } catch (e) {
      setErrorMsg(errMessage(e));
    } finally {
      setLoadingTimeline(false);
    }
  }

  // sanity de datas
  useEffect(() => {
    if (startDate && endDate && startDate > endDate) setEndDate(startDate);
  }, [startDate, endDate]);

  // URL (não dispara buscas)
  useEffect(() => {
    const p = new URLSearchParams();
    if (startDate) p.set("s", startDate);
    if (endDate) p.set("e", endDate);
    if (selTickers.length) p.set("t", selTickers.map((o) => o.value).join(","));
    if (selCompanies.length) p.set("c", selCompanies.map((o) => o.value).join(","));
    const qs = p.toString();
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }, [startDate, endDate, selTickers, selCompanies]);

  // janela básica (stats/tabela)
  const rowsInWindow = useMemo(() => {
    return rows.filter((r) => {
      if (!r.bulletin_date) return false;
      if (startDate && r.bulletin_date < startDate) return false;
      if (endDate && r.bulletin_date > endDate) return false;
      return true;
    });
  }, [rows, startDate, endDate]);

  // Selects
  const companyOpts = useMemo<Opt[]>(() => {
    const s = new Set<string>();
    for (const r of rowsInWindow) if (r.company) s.add(r.company);
    return Array.from(s).sort().map((v) => ({ value: v, label: v }));
  }, [rowsInWindow]);
  const tickerOpts = useMemo<Opt[]>(() => {
    const roots = new Map<string, Set<string>>();
    for (const r of rowsInWindow) {
      const root = normalizeTicker(r.ticker);
      if (!root) continue;
      if (!roots.has(root)) roots.set(root, new Set());
      roots.get(root)!.add(r.ticker ?? "");
    }
    return Array.from(roots.keys()).sort((a, b) => a.localeCompare(b)).map((root) => ({ value: root, label: root }));
  }, [rowsInWindow]);
  useEffect(() => {
    const validCompanies = new Set(companyOpts.map((o) => o.value));
    const validTickers = new Set(tickerOpts.map((o) => o.value));
    setSelCompanies((prev) => prev.filter((o) => validCompanies.has(o.value)));
    setSelTickers((prev) => prev.filter((o) => validTickers.has(o.value)));
  }, [companyOpts, tickerOpts]);

  // -------- Tabela --------
  const filteredBaseForTable = useMemo(() => {
    const cset = new Set(selCompanies.map((o) => o.value));
    const tset = new Set(selTickers.map((o) => o.value));
    return rowsInWindow.filter((r) => {
      const tRoot = normalizeTicker(r.ticker);
      if (cset.size && (!r.company || !cset.has(r.company))) return false;
      if (tset.size && (!tRoot || !tset.has(tRoot))) return false;
      return true;
    });
  }, [rowsInWindow, selCompanies, selTickers]);

  const tC = useDeferredValue(dfCompany);
  const tT = useDeferredValue(dfTicker);
  const tK = useDeferredValue(dfKey);
  const tD = useDeferredValue(dfDate);
  const tY = useDeferredValue(dfType);

  const tableRowsBase = useMemo(() => {
    const cf = tC.trim().toLowerCase();
    const tf = tT.trim().toLowerCase();
    const kf = tK.trim().toLowerCase();
    const dfv = tD.trim();
    const yf = tY.trim().toLowerCase();
    return filteredBaseForTable.filter((r) => {
      const c = (r.company ?? "").toLowerCase();
      const t = (r.ticker ?? "").toLowerCase();
      const k = (r.composite_key ?? "").toLowerCase();
      const d = r.bulletin_date ?? "";
      const y = (r.canonical_type ?? r.bulletin_type ?? "").toLowerCase();
      if (cf && !c.includes(cf)) return false;
      if (tf && !t.includes(tf)) return false;
      if (kf && !k.includes(kf)) return false;
      if (dfv && !d.startsWith(dfv)) return false;
      if (yf && !y.includes(yf)) return false;
      return true;
    });
  }, [filteredBaseForTable, tC, tT, tK, tD, tY]);

  function toggleSort(k: SortKey) {
    setSortKey((prevK) => {
      if (prevK !== k) { setSortDir("asc"); return k; }
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return k;
    });
  }
  const sortIndicator = (k: SortKey) =>
    sortKey === k ? <span className="ml-1 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span> : null;

  const tableRows = useMemo(() => {
    const getVal = (r: Row, k: SortKey) =>
      k === "bulletin_date" ? toDateNum(r.bulletin_date)
      : k === "company" ? (r.company ?? "").toLowerCase()
      : k === "ticker" ? (r.ticker ?? "").toLowerCase()
      : k === "canonical_type" ? (r.canonical_type ?? r.bulletin_type ?? "").toLowerCase()
      : (r.composite_key ?? "").toLowerCase();
    const arr = [...tableRowsBase];
    arr.sort((a, b) => {
      const va = getVal(a, sortKey);
      const vb = getVal(b, sortKey);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [tableRowsBase, sortKey, sortDir]);

  const tableRowsPage = useMemo(() => tableRows.slice(0, tableLimit), [tableRows, tableLimit]);
  useEffect(() => { setTableLimit(PAGE); }, [tableRowsBase.length, tC, tT, tK, tD, tY, sortKey, sortDir]);

  // -------- Estatísticas --------
  const stats = useMemo(() => {
    const cset = new Set(selCompanies.map((o) => o.value));
    const tset = new Set(selTickers.map((o) => o.value));
    const base = rowsInWindow.filter((r) => {
      const tRoot = normalizeTicker(r.ticker);
      if (cset.size && (!r.company || !cset.has(r.company))) return false;
      if (tset.size && (!tRoot || !tset.has(tRoot))) return false;
      return true;
    });

    const totalBulletins = base.length;
    const perCompany = new Map<string, number>();
    for (const r of base) {
      if (!r.company) continue;
      perCompany.set(r.company, (perCompany.get(r.company) ?? 0) + 1);
    }
    const totalCompanies = perCompany.size;
    let eq1 = 0, ge2 = 0;
    for (const cnt of perCompany.values()) {
      if (cnt === 1) eq1++; else if (cnt >= 2) ge2++;
    }
    const chartData = [
      { group: "Boletins", count: totalBulletins, label: "Total de boletins" },
      { group: "Empresas", count: totalCompanies, label: "Total de empresas" },
      { group: "=1", count: eq1, label: "Empresas com 1 boletim" },
      { group: "≥2", count: ge2, label: "Empresas com ≥2 boletins" },
    ];
    return { chartData };
  }, [rowsInWindow, selCompanies, selTickers]);

  // -------- Scatter (usa flags) --------
  const filteredForChart = useMemo(() => {
    const cset = new Set(selCompanies.map((o) => o.value));
    const tset = new Set(selTickers.map((o) => o.value));
    let data = rowsInWindow.filter((r) => {
      const tRoot = normalizeTicker(r.ticker);
      if (cset.size && (!r.company || !cset.has(r.company))) return false;
      if (tset.size && (!tRoot || !tset.has(tRoot))) return false;
      return true;
    });
    const counts = new Map<string, number>();
    for (const r of data) {
      const root = normalizeTicker(r.ticker);
      if (!root) continue;
      counts.set(root, (counts.get(root) ?? 0) + 1);
    }
    if (onlySingle) data = data.filter((r) => counts.get(normalizeTicker(r.ticker)) === 1);
    if (onlyMulti) data = data.filter((r) => (counts.get(normalizeTicker(r.ticker)) ?? 0) >= 2);
    if (onlyFirst || onlyLast) {
      const byRoot = new Map<string, Row[]>();
      for (const r of data) {
        const root = normalizeTicker(r.ticker);
        if (!root) continue;
        const arr = byRoot.get(root) || [];
        arr.push(r);
        byRoot.set(root, arr);
      }
      const picked: Row[] = [];
      for (const arr of byRoot.values()) {
        arr.sort((a, b) => toDateNum(a.bulletin_date) - toDateNum(b.bulletin_date));
        if (onlyFirst) picked.push(arr[0]);
        if (onlyLast) picked.push(arr[arr.length - 1]);
      }
      data = picked;
    }
    return data.sort((a, b) => toDateNum(a.bulletin_date) - toDateNum(b.bulletin_date));
  }, [rowsInWindow, selCompanies, selTickers, onlySingle, onlyMulti, onlyFirst, onlyLast]);

  const chartData = useMemo(
    () =>
      filteredForChart.map((r) => ({
        company: r.company ?? "",
        ticker: r.ticker ?? "",
        ticker_root: normalizeTicker(r.ticker),
        dateNum: toDateNum(r.bulletin_date),
        canonical_type: r.canonical_type ?? "",
        type_display: r.canonical_type ?? r.bulletin_type ?? "",
        dateISO: r.bulletin_date ?? "",
        composite_key: r.composite_key ?? undefined,
      })),
    [filteredForChart],
  ) as ScatterDatum[];

  // xDomain memoizado p/ satisfazer react-hooks/exhaustive-deps
  const xDomain = useMemo<[number | "auto", number | "auto"]>(() => {
    const times = filteredForChart
      .map((r) => toDateNum(r.bulletin_date))
      .filter((v) => Number.isFinite(v)) as number[];
    if (!times.length) return ["auto", "auto"];
    const min = Math.min(...times);
    const max = Math.max(...times);
    return [min - 5 * DAY, max + 5 * DAY];
  }, [filteredForChart]);

  const xTicksMemo = useMemo(
    () =>
      xDomain[0] === "auto"
        ? { ticks: [] as number[], formatter: (v: number) => fmtDayMonth(v) }
        : makeTicksAdaptive([xDomain[0] as number, xDomain[1] as number]),
    [xDomain],
  );

  const tickerOrder = useMemo<string[]>(() => {
    if (selTickers.length) return selTickers.map((o) => o.value);
    const first = new Map<string, number>();
    for (const r of filteredForChart) {
      const t = normalizeTicker(r.ticker);
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
  }, [filteredForChart, selTickers]);

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
    () => chartData.filter((d) => d.ticker_root && visibleTickers.includes(d.ticker_root)),
    [chartData, visibleTickers],
  );

  const chartHeight = useMemo(() => {
    const base = 260;
    const perRow = 26;
    const maxH = 1200;
    return Math.min(maxH, Math.max(base, 60 + visibleTickers.length * perRow));
  }, [visibleTickers]);

  const tickerCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rowsInWindow) {
      const t = normalizeTicker(r.ticker);
      if (!t) continue;
      m.set(t, (m.get(t) ?? 0) + 1);
    }
    return m;
  }, [rowsInWindow]);

  // Reset
  const handleReset = () => {
    setSelCompanies([]);
    setSelTickers([]);
    setOnlyMulti(false);
    setOnlySingle(false);
    setOnlyFirst(false);
    setOnlyLast(false);
    setShowTickerAxis(true);
    setSortKey("bulletin_date");
    setSortDir("asc");
    setFCompany("");
    setFTicker("");
    setFKey("");
    setFDate("");
    setFType("");
    setTableLimit(PAGE);
    setShowChart(true);
    setShowStats(true);
    setStartDate("");
    setEndDate("");
    setRows([]);
  };

  // modal
  const [selectedBulletin, setSelectedBulletin] = useState<Row | null>(null);
  const openBulletinModal = async (row: Row) => {
    setSelectedBulletin(row);
    if (!row.composite_key || row.body_text) return;
    const { data } = await supabase
      .from("vw_bulletins_with_canonical")
      .select("body_text")
      .eq("composite_key", row.composite_key)
      .single();
    if (data) {
      setSelectedBulletin((prev) =>
        prev ? { ...prev, body_text: (data as { body_text?: string | null }).body_text ?? null } : prev,
      );
    }
  };
  const closeBulletinModal = () => setSelectedBulletin(null);

  function onPointClick(payload: ScatterDatum, _index: number, ...rest: unknown[]) {
    const evtLike = rest[0] as { shiftKey?: boolean } | undefined;
    const isShift = Boolean(evtLike && evtLike.shiftKey);
    if (isShift && payload.composite_key) {
      setFKey(payload.composite_key);
      setFCompany("");
    } else {
      setFCompany(payload.company || "");
      setFKey("");
    }
    setTimeout(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      firstRowRef.current?.classList.add("bg-yellow-50");
      setTimeout(() => firstRowRef.current?.classList.remove("bg-yellow-50"), 1800);
    }, 0);
  }

  // helper para exportar .txt unificado
  async function exportRowsToTxt(baseRows: Row[], filenameBase: string) {
    if (!baseRows.length) return;
    const missing = Array.from(
      new Set(baseRows.filter((r) => !r.body_text && r.composite_key).map((r) => r.composite_key as string)),
    );
    let filled: Row[] = baseRows;
    if (missing.length) {
      const { data } = await supabase
        .from("vw_bulletins_with_canonical")
        .select("composite_key, body_text")
        .in("composite_key", missing);
      const map = new Map<string, string>();
      for (const r of (data || []) as { composite_key: string | null; body_text: string | null }[]) {
        if (r.composite_key) map.set(r.composite_key, r.body_text ?? "");
      }
      filled = withBodyTextFilled(baseRows, map);
    }
    const sorted = [...filled].sort((a, b) => toDateNum(a.bulletin_date) - toDateNum(b.bulletin_date));
    const story = sorted
      .map((r) => `${r.bulletin_date ?? ""} — ${r.bulletin_type ?? ""}\n${r.body_text ?? ""}\n`)
      .join("\n--------------------------------\n");
    const s = startDate ? startDate.replaceAll("-", "") : "inicio";
    const e = endDate ? endDate.replaceAll("-", "") : "fim";
    const filename = `${filenameBase}_${s}_${e}.txt`;
    const blob = new Blob([story], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

// ================= RENDER =================
  return (
    <div className="p-6 space-y-4">
      {/* Título + EXPORTS */}
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">CPC — Notices</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          {/* Exportar seleção */}
          <button
            onClick={async () => {
              const base = [...tableRows];
              if (!base.length) {
                alert("Nada a exportar. Ajuste os filtros/seleção.");
                return;
              }
              await exportRowsToTxt(base, "cpc_notices_selecao");
            }}
            disabled={!tableRows.length}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60"
          >
            📜 Exportar seleção
          </button>

          {/* Exportar período */}
          <button
            onClick={async () => {
              const base = [...rowsInWindow];
              if (!base.length) {
                alert("Nenhum boletim no período.");
                return;
              }
              await exportRowsToTxt(base, "cpc_notices_periodo");
            }}
            disabled={!rowsInWindow.length}
            className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700 disabled:opacity-60"
          >
            🗂️ Exportar período
          </button>

          {/* Exportar tabela agregada */}
          <button
            onClick={async () => {
              const baseRows = tableRows;
              if (!baseRows.length) {
                alert("Tabela vazia. Ajuste os filtros.");
                return;
              }
              const groups = new Map<string, Row[]>();
              for (const r of baseRows) {
                const root = normalizeTicker(r.ticker);
                if (!root) continue;
                if (!groups.has(root)) groups.set(root, []);
                groups.get(root)!.push(r);
              }
              const agg = Array.from(groups.entries())
                .map(([root, arr]) => {
                  const ordered = [...arr].sort((a, b) => toDateNum(a.bulletin_date) - toDateNum(b.bulletin_date));
                  const first = ordered[0];
                  const last = ordered[ordered.length - 1];
                  return {
                    ticker_root: root,
                    company_first: first?.company ?? "",
                    company_last: last?.company ?? "",
                    events: ordered.length,
                    first_date: first?.bulletin_date ?? "",
                    last_date: last?.bulletin_date ?? "",
                  };
                })
                .sort((a, b) => a.first_date.localeCompare(b.first_date) || a.ticker_root.localeCompare(b.ticker_root));

              const XLSX = await import("xlsx");
              const ws = XLSX.utils.json_to_sheet(agg);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "CPC_TabelaAgregada");
              const s = startDate ? startDate.replaceAll("-", "") : "inicio";
              const e = endDate ? endDate.replaceAll("-", "") : "fim";
              const filename = `cpc_tabela_agregada_${s}_${e}.xlsx`;
              XLSX.writeFile(wb, filename);
            }}
            disabled={!tableRows.length}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
          >
            📊 Exportar tabela agregada (.xlsx)
          </button>
        </div>
      </div>

      {/* Linha única alinhada: Start | End | ⚡ | 🧹 */}
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

        {/* botões alinhados ao fundo dos inputs */}
        <div className="flex items-end gap-2 pb-[2px]">
          <button
            className="border rounded px-3 h-10 font-semibold flex items-center justify-center"
            title="Executar busca"
            aria-label="Executar busca"
            onClick={() => (useAnchor ? fetchTimelineAfterAnchor() : fetchSimpleWindow())}
            disabled={loadingTimeline || (!startDate && !endDate && !useAnchor)}
          >
            ⚡
          </button>
          <button className="border rounded px-3 h-10 flex items-center justify-center" onClick={handleReset} title="Limpar" aria-label="Limpar filtros">
            🧹
          </button>
        </div>
      </div>

      {errorMsg && <div className="border border-red-300 bg-red-50 text-red-800 p-2 rounded">{errorMsg}</div>}

      {/* "Ancorar dados" logo abaixo */}
      <div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useAnchor} onChange={(e) => setUseAnchor(e.target.checked)} />
          Ancorar dados
          {loadingAnchors && <span className="text-xs text-gray-500">(carregando âncoras...)</span>}
        </label>
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

      {/* Botões de acordeão */}
      <div className="flex gap-2 flex-wrap">
        <button
          className="border rounded px-3 py-2"
          onClick={() => setShowChart((v) => !v)}
          title={showChart ? "Fechar Scatter" : "Abrir Scatter"}
        >
          {showChart ? "Fechar Scatter" : "Abrir Scatter"}
        </button>
        <button
          className="border rounded px-3 py-2"
          onClick={() => setShowStats((v) => !v)}
          title={showStats ? "Fechar estatísticas" : "Abrir estatísticas"}
        >
          {showStats ? "Fechar estatísticas" : "Abrir estatísticas"}
        </button>
      </div>

      {/* Estatísticas (Coluna) */}
      {showStats && (
        <div className="w-full border rounded p-3">
          <div className="text-sm text-gray-700 mb-2">Empresas e boletins no período selecionado.</div>
          <div className="w-full md:w-1/2">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={stats.chartData}
                margin={{ top: 16, right: 24, bottom: 8, left: 8 }}
                barCategoryGap="20%"
                barGap={2}
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey="group" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v: unknown, _n: unknown, p: unknown) => {
                    const payload = p as { payload?: { label?: string } } | undefined;
                    const val = typeof v === "number" ? String(v) : String(v);
                    return [val, payload?.payload?.label ?? ""];
                  }}
                  labelFormatter={(l: string) => l}
                />
                <Bar dataKey="count">
                  <LabelList dataKey="count" content={<BarValueLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Scatter */}
      {showChart && (
        <div className="w-full border rounded overflow-hidden">
          <div className="px-2 py-2 border-b flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={onlySingle}
                onChange={(e) => {
                  setOnlySingle(e.target.checked);
                  if (e.target.checked) setOnlyMulti(false);
                }}
              />
              =1 Boletim
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={onlyMulti}
                onChange={(e) => {
                  setOnlyMulti(e.target.checked);
                  if (e.target.checked) setOnlySingle(false);
                }}
              />
              ≥2 Boletins
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={onlyFirst}
                onChange={(e) => {
                  setOnlyFirst(e.target.checked);
                  if (e.target.checked) setOnlyLast(false);
                }}
              />
              Apenas primeiro
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={onlyLast}
                onChange={(e) => {
                  setOnlyLast(e.target.checked);
                  if (e.target.checked) setOnlyFirst(false);
                }}
              />
              Apenas último
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showTickerAxis} onChange={(e) => setShowTickerAxis(e.target.checked)} />
              Mostrar tickers no eixo Y
            </label>

            <div className="ml-auto flex items-center gap-2">
              <button
                className="border rounded px-2 h-10"
                onClick={() => setYLimit((v) => Math.max(10, v - 10))}
                title="-10 linhas do eixo Y"
              >
                −10
              </button>
              <button
                className="border rounded px-2 h-10"
                onClick={() => setYLimit((v) => Math.min(tickerOrder.length || v + 10, v + 10))}
                title="+10 linhas do eixo Y"
              >
                +10
              </button>
              <button
                className="border rounded px-2 h-10"
                onClick={() => setYLimit(tickerOrder.length || 10)}
                title="Mostrar todas as linhas do eixo Y"
              >
                Todos
              </button>
            </div>
          </div>

          <div className="p-2" style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid />
                <XAxis
                  dataKey="dateNum"
                  type="number"
                  domain={xDomain}
                  ticks={xTicksMemo.ticks}
                  tickFormatter={(v) => xTicksMemo.formatter(Number(v))}
                  name="Data (UTC)"
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="ticker_root"
                  name="Ticker"
                  ticks={visibleTickers}
                  interval={0}
                  tickLine={false}
                  width={showTickerAxis ? 90 : 0}
                  tick={showTickerAxis ? { fontSize: 12 } : undefined}
                  allowDuplicatedCategory={false}
                  tickFormatter={showTickerAxis ? (t) => `${t} (${tickerCount.get(String(t)) ?? 0})` : undefined}
                  hide={!showTickerAxis}
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
                        <div><strong>Tipo:</strong> {d.type_display || "—"}</div>
                        <div className="mt-1 text-xs text-gray-600">
                          Clique: filtra empresa | Shift+Clique: isola este boletim
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter data={chartDataVis} onClick={(p, idx, ...rest) => onPointClick(p as ScatterDatum, idx as number, ...rest)} />
              </ScatterChart>
            </ResponsiveContainer>

            {selTickers.length > 0 && chartDataVis.length === 0 && (
              <div className="text-xs text-gray-600 mt-1">Sem eventos para a seleção no período.</div>
            )}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="space-y-2" ref={tableRef}>
        <h2 className="text-xl font-semibold">Resultados</h2>
        <div className="border rounded overflow-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b sticky top-0 z-10">
              <tr className="text-left align-top">
                <th className="p-2" aria-sort={sortKey === "company" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("company")}>
                    Empresa {sortIndicator("company")}
                  </button>
                  <input className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="Filtrar" value={fCompany} onChange={(e) => setFCompany(e.target.value)} />
                </th>
                <th className="p-2" aria-sort={sortKey === "ticker" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("ticker")}>
                    Ticker {sortIndicator("ticker")}
                  </button>
                  <input className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="Filtrar" value={fTicker} onChange={(e) => setFTicker(e.target.value)} />
                </th>
                <th className="p-2" aria-sort={sortKey === "composite_key" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("composite_key")}>
                    Composite Key {sortIndicator("composite_key")}
                  </button>
                  <input className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="Filtrar" value={fKey} onChange={(e) => setFKey(e.target.value)} />
                </th>
                <th className="p-2" aria-sort={sortKey === "bulletin_date" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("bulletin_date")}>
                    Data {sortIndicator("bulletin_date")}
                  </button>
                  <input className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="YYYY ou YYYY-MM ou YYYY-MM-DD" value={fDate} onChange={(e) => setFDate(e.target.value)} />
                </th>
                <th className="p-2" aria-sort={sortKey === "canonical_type" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("canonical_type")}>
                    Tipo de Boletim {sortIndicator("canonical_type")}
                  </button>
                  <input className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="Filtrar" value={fType} onChange={(e) => setFType(e.target.value)} />
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRowsPage.map((row, i) => {
                const compositeKey = row.composite_key ?? "—";
                const refAttr = i === 0 ? { ref: firstRowRef } : {};
                return (
                  <tr key={row.id} className="border-b hover:bg-gray-50" {...refAttr}>
                    <td className="p-2">{row.company}</td>
                    <td className="p-2">{row.ticker}</td>
                    <td className="p-2">
                      {row.composite_key ? (
                        <button type="button" onClick={() => openBulletinModal(row)} className="text-blue-600 hover:underline" title="Abrir boletim completo">
                          {compositeKey}
                        </button>
                      ) : (
                        compositeKey
                      )}
                    </td>
                    <td className="p-2">{row.bulletin_date}</td>
                    <td className="p-2">{row.canonical_type ?? row.bulletin_type ?? "—"}</td>
                  </tr>
                );
              })}
              {tableRowsPage.length === 0 && (
                <tr>
                  <td className="p-2 text-gray-600" colSpan={5}>Nenhum registro encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {selectedBulletin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={closeBulletinModal}>
          <div className="bg-white max-w-3xl w-full rounded shadow p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Boletim</h3>
              <button className="border rounded px-2 h-10" onClick={closeBulletinModal}>Fechar</button>
            </div>
            <div className="text-sm text-gray-700">
              <div><strong>Empresa:</strong> {selectedBulletin.company || "—"}</div>
              <div><strong>Ticker:</strong> {selectedBulletin.ticker || "—"}</div>
              <div><strong>Data:</strong> {selectedBulletin.bulletin_date || "—"}</div>
              <div><strong>Tipo:</strong> {selectedBulletin.canonical_type ?? selectedBulletin.bulletin_type ?? "—"}</div>
              <div><strong>Composite Key:</strong> {selectedBulletin.composite_key ?? "—"}</div>
            </div>
            <pre className="whitespace-pre-wrap text-sm border rounded p-2 max-h-[60vh] overflow-auto">
              {selectedBulletin.body_text || "—"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
