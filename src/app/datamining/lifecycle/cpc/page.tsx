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
  canonical_class?: string | null;
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
  return (t ?? "").trim().toUpperCase().split(".")[0];
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
  if (span >= 3 * 365 * DAY) { let t = startOfMonthUTC(min); const ticks: number[] = []; while (t <= max) { ticks.push(t); t = addMonthsUTC(t, 12); } return { ticks, formatter: (v: number) => fYear.format(v) }; }
  if (span >= 12 * 30 * DAY) { let t = startOfQuarterUTC(min); const ticks: number[] = []; while (t <= max) { ticks.push(t); t = addMonthsUTC(t, 3); } return { ticks, formatter: (v: number) => fMonY.format(v) }; }
  if (span >= 3 * 30 * DAY) { let t = startOfMonthUTC(min); const ticks: number[] = []; while (t <= max) { ticks.push(t); t = addMonthsUTC(t, 1); } return { ticks, formatter: (v: number) => fMon.format(v) }; }
  { let t = startOfDayUTC(min); const ticks: number[] = []; while (t <= max) { ticks.push(t); t = addDaysUTC(t, 15); } return { ticks, formatter: (v: number) => fDayMon.format(v) }; }
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

// Tipagem explícita para evitar "any" no LabelList custom
type BarLabelProps = {
  x?: number;
  y?: number;
  width?: number;
  value?: number | string;
};
function BarValueLabel(props: BarLabelProps) {
  const { x, y, width, value } = props;
  const cx = (x ?? 0) + (width ?? 0) / 2;
  const vy = (y ?? 0) - 6;
  return <text x={cx} y={vy} textAnchor="middle" fontSize={12} fontWeight={600}>{value}</text>;
}

// Pequeno componente visual para KPIs
function KpiCard({ k, label, value }: { k: string; label: string; value: number | string }) {
  return (
    <div className="border rounded p-3 bg-white">
      <div className="text-xs text-gray-500 mb-1">{k}</div>
      <div className="text-2xl font-bold leading-tight">{value}</div>
      <div className="text-sm text-gray-700">{label}</div>
    </div>
  );
}

// =========================================================

export default function Page() {
  const [loadingAnchors, setLoadingAnchors] = useState(false);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([]);

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [selCompanies, setSelCompanies] = useState<Opt[]>([]);
  const [selTickers, setSelTickers] = useState<Opt[]>([]);

  // FLAGS: afetam Scatter e, via regra abaixo, a TABELA
  const [onlyMulti, setOnlyMulti] = useState(false);
  const [onlySingle, setOnlySingle] = useState(false);
  const [onlyFirst, setOnlyFirst] = useState(false);
  const [onlyLast, setOnlyLast] = useState(false);
  const [showTickerAxis, setShowTickerAxis] = useState(true);

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

  const [showChart, setShowChart] = useState(true);
  const [showStats, setShowStats] = useState(true);

  // Âncoras (primeiro CPC por (company|ticker_root))
  const [anchors, setAnchors] = useState<Map<string, string>>(new Map());
  const [anchorCompanies, setAnchorCompanies] = useState<string[]>([]);

  // Auto-período (min→max) de toda a view
  const [autoPeriod, setAutoPeriod] = useState(true);

  // Pré-busca: carregar mapa de âncoras (CPC inicial por (company|ticker_root))
  useEffect(() => {
    (async () => {
      setLoadingAnchors(true);
      setErrorMsg(null);
      try {
        const { data, error } = await supabase
          .from("vw_bulletins_with_canonical")
          .select("company, ticker, bulletin_date, canonical_type, bulletin_type")
          .ilike("canonical_type", `%${CPC_CANONICAL}%`);
        if (error) throw error;

        const map = new Map<string, string>();
        const companies = new Set<string>();
        for (const r of (data || []) as Row[]) {
          const key = keyCT(r.company, r.ticker);
          const d = r.bulletin_date || "";
          if (!d) continue;
          const hasCpc =
            (r.canonical_type || "").toUpperCase().includes(CPC_CANONICAL) ||
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

  // Auto-período (min→max) quando habilitado ou ao montar
  useEffect(() => {
    (async () => {
      if (!autoPeriod) return;
      try {
        const { data, error } = await supabase
          .from("vw_bulletins_with_canonical")
          .select("bulletin_date")
          .order("bulletin_date", { ascending: true })
          .limit(1);
        if (error) throw error;
        const minDate = ((data as { bulletin_date: string }[] | null)?.[0]?.bulletin_date) || "";
        const { data: dataMax, error: error2 } = await supabase
          .from("vw_bulletins_with_canonical")
          .select("bulletin_date")
          .order("bulletin_date", { ascending: false })
          .limit(1);
        if (error2) throw error2;
        const maxDate = ((dataMax as { bulletin_date: string }[] | null)?.[0]?.bulletin_date) || "";
        if (minDate && (!startDate || autoPeriod)) setStartDate(minDate);
        if (maxDate && (!endDate || autoPeriod)) setEndDate(maxDate);
      } catch (e) {
        console.warn("autoPeriod preset failed:", e);
      }
    })();
  }, [autoPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Janela básica por período (para filtros/contagens)
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
    return Array.from(roots.keys()).sort().map((root) => ({ value: root, label: root }));
  }, [rowsInWindow]);
  useEffect(() => {
    const validCompanies = new Set(companyOpts.map((o) => o.value));
    const validTickers = new Set(tickerOpts.map((o) => o.value));
    setSelCompanies((prev) => prev.filter((o) => validCompanies.has(o.value)));
    setSelTickers((prev) => prev.filter((o) => validTickers.has(o.value)));
  }, [companyOpts, tickerOpts]);

  // -------- Tabela --------
  const filteredBaseForTable = useMemo(() => {
    // Base por período + Company/Ticker
    const cset = new Set(selCompanies.map((o) => o.value));
    const tset = new Set(selTickers.map((o) => o.value));
    let data = rowsInWindow.filter((r) => {
      const tRoot = normalizeTicker(r.ticker);
      if (cset.size && (!r.company || !cset.has(r.company))) return false;
      if (tset.size && (!tRoot || !tset.has(tRoot))) return false;
      return true;
    });

    // Se flags do Scatter estiverem ativas, aplica a mesma lógica aqui
    const flagsActive = onlySingle || onlyMulti || onlyFirst || onlyLast;
    if (flagsActive) {
      const counts = new Map<string, number>();
      for (const r of data) {
        const root = normalizeTicker(r.ticker);
        if (!root) continue;
        counts.set(root, (counts.get(root) ?? 0) + 1);
      }
      if (onlySingle) data = data.filter((r) => counts.get(normalizeTicker(r.ticker)) === 1);
      if (onlyMulti)  data = data.filter((r) => (counts.get(normalizeTicker(r.ticker)) ?? 0) >= 2);
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
    }
    return data;
  }, [rowsInWindow, selCompanies, selTickers, onlySingle, onlyMulti, onlyFirst, onlyLast]);

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
  const sortIndicator = (k: SortKey) => (sortKey === k ? <span className="ml-1 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span> : null);

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
  // Reset do limite: não reseta ao ordenar (não incluí sortKey/sortDir)
  useEffect(() => { setTableLimit(PAGE); }, [tableRowsBase.length, tC, tT, tK, tD, tY]);

  // -------- KPIs (substituem a barra de "Estatísticas") — date_range only --------
  const kpis = useMemo(() => {
    const a_total = rowsInWindow.length;

    // classe
    let b_unico = 0, b_misto = 0;
    for (const r of rowsInWindow) {
      const cl = (r.canonical_class ?? "").toLowerCase();
      if (cl === "unico" || cl === "único") b_unico++;
      else if (cl === "misto" || cl === "mistos" || cl === "mixed") b_misto++;
    }

    // primeiros por ticker_root
    const byRoot = new Map<string, Row[]>();
    for (const r of rowsInWindow) {
      const root = normalizeTicker(r.ticker);
      if (!root || !r.bulletin_date) continue;
      const arr = byRoot.get(root) || [];
      arr.push(r);
      byRoot.set(root, arr);
    }
    let c_primeiros = 0;
    let e_primeiro_padrao = 0;
    for (const arr of byRoot.values()) {
      arr.sort((a, b) => {
        const da = toDateNum(a.bulletin_date);
        const db = toDateNum(b.bulletin_date);
        if (da !== db) return da - db;
        const ka = (a.composite_key ?? "");
        const kb = (b.composite_key ?? "");
        return ka.localeCompare(kb);
      });
      const first = arr[0];
      c_primeiros++;
      const typeUp = ((first.canonical_type ?? first.bulletin_type ?? "")).toUpperCase();
      // "padrão" = match exato ao canônico (sem vírgula/sufixos)
      if (typeUp === CPC_CANONICAL) e_primeiro_padrao++;
    }
    const d_nao_primeiros = a_total - c_primeiros;
    const f_primeiro_fora = c_primeiros - e_primeiro_padrao;
    const g_demais = a_total - (e_primeiro_padrao + f_primeiro_fora);

    return {
      a_total,
      b_unico,
      b_misto,
      c_primeiros,
      d_nao_primeiros,
      e_primeiro_padrao,
      f_primeiro_fora,
      g_demais,
    };
  }, [rowsInWindow]);

  // -------- Scatter --------
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
    () => (xDomain[0] === "auto" ? { ticks: [] as number[], formatter: (v: number) => fmtDayMonth(v) }
      : makeTicksAdaptive([xDomain[0] as number, xDomain[1] as number])),
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
      if (Number.isFinite(ts) && (prev === undefined || (ts as number) < prev!)) first.set(t, ts as number);
    }
    return Array.from(first.entries()).sort((a, b) => a[1] - b[1]).map(([t]) => t);
  }, [filteredForChart, selTickers]);

  const [yLimit, setYLimit] = useState<number>(10);
  useEffect(() => { setYLimit((v) => Math.max(v, selTickers.length || 10)); }, [selTickers.length]);
  useEffect(() => { if (tickerOrder.length && yLimit > tickerOrder.length) setYLimit(tickerOrder.length); }, [tickerOrder.length, yLimit]);

  const visibleTickers = useMemo(() => tickerOrder.slice(0, Math.max(1, Math.min(yLimit, tickerOrder.length || 1))), [tickerOrder, yLimit]);
  const chartDataVis = useMemo(() => chartData.filter((d) => d.ticker_root && visibleTickers.includes(d.ticker_root)), [chartData, visibleTickers]);

  const chartHeight = useMemo(() => Math.min(1200, Math.max(260, 60 + visibleTickers.length * 26)), [visibleTickers]);

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

  // Export .txt unificado (apenas body_text)
  const SEP = "\\n--------------------------------\\n";
  async function exportRowsToTxt(baseRows: Row[], filenameBase: string) {
    if (!baseRows.length) return;
    const missing = Array.from(new Set(baseRows.filter((r) => !r.body_text && r.composite_key).map((r) => r.composite_key as string)));
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
    const story = sorted.map((r) => (r.body_text ?? "").trim()).filter((t) => t.length > 0).join(SEP);
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

  // Export .xlsx de TABELA (sem agregação) — exatamente as linhas mostradas (respeita filtros e flags)
  async function exportRowsToXlsxTable(baseRows: Row[], filenameBase: string) {
    if (!baseRows.length) { alert("Nada a exportar."); return; }
    const rowsPlain = baseRows.map(r => ({
      id: r.id,
      company: r.company ?? "",
      ticker: r.ticker ?? "",
      composite_key: r.composite_key ?? "",
      bulletin_date: r.bulletin_date ?? "",
      canonical_type: r.canonical_type ?? r.bulletin_type ?? "",
      canonical_class: r.canonical_class ?? "",
      source_file: r.source_file ?? ""
    }));
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rowsPlain);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tabela");
    const s = startDate ? startDate.replaceAll("-", "") : "inicio";
    const e = endDate ? endDate.replaceAll("-", "") : "fim";
    const filename = `${filenameBase}_${s}_${e}.xlsx";
    XLSX.writeFile(wb, filename);
  }

  // ===== base para o novo gráfico temático (segue date_range + Company/Ticker) =====
  const baseForThematic = useMemo(() => {
    const cset = new Set(selCompanies.map((o) => o.value));
    const tset = new Set(selTickers.map((o) => o.value));
    return rowsInWindow.filter((r) => {
      const tRoot = normalizeTicker(r.ticker);
      if (cset.size && (!r.company || !cset.has(r.company))) return false;
      if (tset.size && (!tRoot || !tset.has(tRoot))) return false;
      return true;
    });
  }, [rowsInWindow, selCompanies, selTickers]);

  const thematicData = useMemo(() => {
    let unicos = 0, mistos = 0, cpc = 0, cpcMisto = 0, outros = 0;
    for (const r of baseForThematic) {
      const ct = (r.canonical_type ?? "").toUpperCase();
      const cl = (r.canonical_class ?? "").toLowerCase();
      if (cl === "unico" || cl === "único") unicos++;
      if (cl === "misto" || cl === "mistos" || cl === "mixed") mistos++;
      if (ct.includes(CPC_CANONICAL)) {
        cpc++;
        if (cl === "misto" || cl === "mistos" || cl === "mixed") cpcMisto++;
      } else {
        outros++;
      }
    }
    return [
      { group: "Únicos", count: unicos, label: "Boletins 'únicos' (pode sobrepor)" },
      { group: "Mistos", count: mistos, label: "Boletins 'mistos' (pode sobrepor)" },
      { group: "CPC (contains)", count: cpc, label: "NEW LISTING-CPC-SHARES (pode sobrepor)" },
      { group: "CPC (misto)", count: cpcMisto, label: "CPC com class='misto' (subset de CPC)" },
      { group: "Outros", count: outros, label: "Demais tipos (não CPC)" },
    ];
  }, [baseForThematic]);

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

  async function fetchAnchoredTimeline() {
    if (!anchors.size || !anchorCompanies.length) {
      setErrorMsg("Âncoras indisponíveis (CPC inicial não encontrado).");
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
          .select("id, source_file, company, ticker, bulletin_type, canonical_type, canonical_class, bulletin_date, composite_key, body_text")
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

  return (
    <div className="p-6 space-y-4">
      {/* Título + EXPORTS */}
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">CPC — Notices</h1>
        {loadingAnchors && <span className="text-xs text-gray-500">carregando âncoras...</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={async () => {
              const base = [...tableRows];
              if (!base.length) { alert("Nada a exportar. Ajuste os filtros/seleção."); return; }
              await exportRowsToTxt(base, "cpc_notices_selecao");
            }}
            disabled={!tableRows.length}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60"
          >📜 Exportar seleção (.txt)</button>

          <button
            onClick={async () => {
              const base = [...rowsInWindow];
              if (!base.length) { alert("Nenhum boletim no período."); return; }
              await exportRowsToTxt(base, "cpc_notices_periodo");
            }}
            disabled={!rowsInWindow.length}
            className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700 disabled:opacity-60"
          >🗂️ Exportar período (.txt)</button>

          <button
            onClick={async () => {
              await exportRowsToXlsxTable(tableRows, "cpc_tabela");
            }}
            disabled={!tableRows.length}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
          >📄 Exportar tabela (.xlsx)</button>
        </div>
      </div>

      {/* Linha: Start | End | ⚡ | 🧹 */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col">
          <label className="block text-sm">Start</label>
          <input type="date" className="border rounded px-2 h-10" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="flex flex-col">
          <label className="block text-sm">End</label>
          <input type="date" className="border rounded px-2 h-10" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="flex items-end gap-2 pb-[2px]">
          <button className="border rounded px-3 h-10 font-semibold flex items-center justify-center" title="Executar busca" aria-label="Executar busca" onClick={fetchAnchoredTimeline} disabled={loadingTimeline || (!startDate && !endDate)}>⚡</button>
          <button className="border rounded px-3 h-10 flex items-center justify-center" onClick={handleReset} title="Limpar" aria-label="Limpar filtros">🧹</button>
        </div>
      </div>

      {errorMsg && <div className="border border-red-300 bg-red-50 text-red-800 p-2 rounded">{errorMsg}</div>}

      {/* Auto-período (min→max) */}
      <div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoPeriod} onChange={(e) => setAutoPeriod(e.target.checked)} />
          Auto-período (min→max) na view
        </label>
      </div>

      {/* Selects */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="block text-sm mb-1">Company</label>
          <Select isMulti options={companyOpts} value={selCompanies} onChange={(v: MultiValue<Opt>) => setSelCompanies(v as Opt[])} classNamePrefix="cpc-select" />
        </div>
        <div>
          <label className="block text-sm mb-1">Ticker</label>
          <Select isMulti options={tickerOpts} value={selTickers} onChange={(v: MultiValue<Opt>) => setSelTickers(v as Opt[])} classNamePrefix="cpc-select" />
        </div>
      </div>

      {/* Acordeões */}
      <div className="flex gap-2 flex-wrap">
        <button className="border rounded px-3 py-2" onClick={() => setShowChart((v) => !v)} title={showChart ? "Fechar Scatter" : "Abrir Scatter"}>
          {showChart ? "Fechar Scatter" : "Abrir Scatter"}
        </button>
        <button className="border rounded px-3 py-2" onClick={() => setShowStats((v) => !v)} title={showStats ? "Fechar estatísticas" : "Abrir estatísticas"}>
          {showStats ? "Fechar estatísticas" : "Abrir estatísticas"}
        </button>
      </div>

      {/* KPIs (substitui o gráfico de barras) */}
      {showStats && (
        <div className="w-full border rounded p-3">
          <div className="text-sm text-gray-700 mb-2">Foto global no período selecionado (date_range).</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard k="a" label="Total de boletins" value={kpis.a_total} />
            <KpiCard k="b" label="Classe: Único" value={kpis.b_unico} />
            <KpiCard k="b" label="Classe: Misto" value={kpis.b_misto} />
            <KpiCard k="c" label="‘Primeiro boletim’ (1º por ticker)" value={kpis.c_primeiros} />
            <KpiCard k="d" label="Não ‘primeiro boletim’" value={kpis.d_nao_primeiros} />
            <KpiCard k="e" label="1º boletim ‘padrão’ (CPC exato)" value={kpis.e_primeiro_padrao} />
            <KpiCard k="f" label="1º boletim fora do padrão" value={kpis.f_primeiro_fora} />
            <KpiCard k="g" label="‘Demais boletins’ = a − (e + f)" value={kpis.g_demais} />
          </div>
        </div>
      )}

      {/* Scatter */}
      {showChart && (
        <div className="w-full border rounded overflow-hidden">
          <div className="px-2 py-2 border-b flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={onlySingle} onChange={(e) => { setOnlySingle(e.target.checked); if (e.target.checked) setOnlyMulti(false); }} />
              =1 Boletim
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={onlyMulti} onChange={(e) => { setOnlyMulti(e.target.checked); if (e.target.checked) setOnlySingle(false); }} />
              ≥2 Boletins
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={onlyFirst} onChange={(e) => { setOnlyFirst(e.target.checked); if (e.target.checked) setOnlyLast(false); }} />
              Apenas primeiro
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={onlyLast} onChange={(e) => { setOnlyLast(e.target.checked); if (e.target.checked) setOnlyFirst(false); }} />
              Apenas último
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showTickerAxis} onChange={(e) => setShowTickerAxis(e.target.checked)} />
              Mostrar tickers no eixo Y
            </label>

            <div className="ml-auto flex items-center gap-2">
              <button className="border rounded px-2 h-10" onClick={() => setYLimit((v) => Math.max(10, v - 10))} title="-10 linhas do eixo Y">−10</button>
              <button className="border rounded px-2 h-10" onClick={() => setYLimit((v) => Math.min(tickerOrder.length || v + 10, v + 10))} title="+10 linhas do eixo Y">+10</button>
              <button className="border rounded px-2 h-10" onClick={() => setYLimit(tickerOrder.length || 10)} title="Mostrar todas as linhas do eixo Y">Todos</button>
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
                        <div className="mt-1 text-xs text-gray-600">Clique: filtra empresa | Shift+Clique: isola este boletim</div>
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
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("company")}>Empresa </button>
                </th>
                <th className="p-2" aria-sort={sortKey === "ticker" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("ticker")}>Ticker </button>
                </th>
                <th className="p-2" aria-sort={sortKey === "composite_key" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("composite_key")}>Composite Key </button>
                </th>
                <th className="p-2" aria-sort={sortKey === "bulletin_date" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("bulletin_date")}>Data </button>
                </th>
                <th className="p-2" aria-sort={sortKey === "canonical_type" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("canonical_type")}>Tipo de Boletim </button>
                </th>
              </tr>
              <tr className="text-left align-top">
                <th className="p-2"><input className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="Filtrar" value={fCompany} onChange={(e) => setFCompany(e.target.value)} /></th>
                <th className="p-2"><input className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="Filtrar" value={fTicker} onChange={(e) => setFTicker(e.target.value)} /></th>
                <th className="p-2"><input className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="Filtrar" value={fKey} onChange={(e) => setFKey(e.target.value)} /></th>
                <th className="p-2"><input className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="YYYY ou YYYY-MM ou YYYY-MM-DD" value={fDate} onChange={(e) => setFDate(e.target.value)} /></th>
                <th className="p-2"><input className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="Filtrar" value={fType} onChange={(e) => setFType(e.target.value)} /></th>
              </tr>
            </thead>
            <tbody>
              {tableRowsPage.map((row, i) => (
                <tr key={row.id} className="border-b hover:bg-gray-50" ref={i === 0 ? firstRowRef : undefined}>
                  <td className="p-2">{row.company}</td>
                  <td className="p-2">{row.ticker}</td>
                  <td className="p-2">
                    {row.composite_key ? (
                      <button type="button" onClick={() => openBulletinModal(row)} className="text-blue-600 hover:underline" title="Abrir boletim completo">
                        {row.composite_key}
                      </button>
                    ) : ("—")}
                  </td>
                  <td className="p-2">{row.bulletin_date}</td>
                  <td className="p-2">{row.canonical_type ?? row.bulletin_type ?? "—"}</td>
                </tr>
              ))}
              {tableRowsPage.length === 0 && (
                <tr><td className="p-2 text-gray-600" colSpan={5}>Nenhum registro encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <div className="text-sm text-gray-600">Exibindo {tableRowsPage.length} de {tableRows.length} registros</div>
          <button className="border rounded px-3 py-1" onClick={() => setTableLimit((v) => Math.min(tableRows.length, v + 50))} disabled={tableRowsPage.length >= tableRows.length} title="Mostrar mais 50 linhas">Mostrar +50</button>
          <button className="border rounded px-3 py-1" onClick={() => setTableLimit(tableRows.length)} disabled={tableRowsPage.length >= tableRows.length} title="Mostrar todas as linhas">Mostrar todos</button>
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
