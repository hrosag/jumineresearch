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
    // mantém datas; o usuário pode usar Auto-período (min→max) para repopular
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
    const filename = `${filenameBase}_${s}_${e}.xlsx`;
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

  // ===== KPIs em cartões (compactos) =====
  const cardsStats = useMemo(() => {
    const totalBulletins = baseForThematic.length;

    // universo CPC (.P) agrupado por root (antes do ponto)
    const byRootCpc = new Map<string, Row[]>();
    for (const r of baseForThematic) {
      const pub = (r.ticker ?? "").trim().toUpperCase();
      if (!pub.endsWith(".P")) continue;
      const root = normalizeTicker(pub);
      if (!root) continue;
      const arr = byRootCpc.get(root) || [];
      arr.push(r);
      byRootCpc.set(root, arr);
    }

    let firstCount = 0;
    let firstStandard = 0;
    let firstMixed = 0;
    let oneBulletinCompanies = 0;

    for (const arr of byRootCpc.values()) {
      arr.sort((a, b) => toDateNum(a.bulletin_date) - toDateNum(b.bulletin_date));
      const first = arr[0];
      if (!first) continue;

      if (arr.length === 1) oneBulletinCompanies++;

      firstCount++;

      const canon = (first.canonical_type ?? first.bulletin_type ?? "").toUpperCase();
      const isCpc = canon.includes(CPC_CANONICAL);

      const rawClass = (first.canonical_class ?? "").toString().trim().toLowerCase();
      const normClass = rawClass.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const isMixedClass = normClass.startsWith("mist");

      if (isCpc && !isMixedClass) firstStandard++;
      if (isCpc && isMixedClass) firstMixed++;
    }

    const firstOther = firstMixed; // fora do padrão = CPC misto no 1º boletim
    const cpcTotal = Array.from(byRootCpc.values()).reduce((s, a) => s + a.length, 0);
    const demais = cpcTotal - firstCount;

    let uniqueCount = 0;
    let mixedCount = 0;
    for (const r of baseForThematic) {
      const raw = (r.canonical_class ?? "").toString().trim().toLowerCase();
      const norm = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (norm.startsWith("unic")) uniqueCount++;
      if (norm.startsWith("mist")) mixedCount++;
    }

    return {
      totalBulletins,
      firstCount,
      firstStandard,
      firstOther,
      demais,
      uniqueCount,
      mixedCount,
      oneBulletinCompanies,
    };
  }, [baseForThematic]);

  function CardStat({
    value,
    label,
    sublabel,
  }: {
    value: number | string;
    label: string;
    sublabel?: string;
  }) {
    return (
      <div className="p-2 border rounded-md bg-white shadow-sm hover:shadow transition-shadow flex flex-col">
        <div className="text-xl md:text-2xl font-semibold text-gray-900 tracking-tight">
          {value}
        </div>
        <div className="text-xs md:text-sm text-gray-700 mt-0.5 leading-snug">{label}</div>
        {sublabel && (
          <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{sublabel}</div>
        )}
      </div>
    );
  }
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
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("company")}>Empresa {sortIndicator("company")}</button>
                  <input className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="Filtrar" value={fCompany} onChange={(e) => setFCompany(e.target.value)} />
                </th>
                <th className="p-2" aria-sort={sortKey === "ticker" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("ticker")}>Ticker {sortIndicator("ticker")}</button>
                  <input className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="Filtrar" value={fTicker} onChange={(e) => setFTicker(e.target.value)} />
                </th>
                <th className="p-2" aria-sort={sortKey === "composite_key" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("composite_key")}>Composite Key {sortIndicator("composite_key")}</button>
                  <input className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="Filtrar" value={fKey} onChange={(e) => setFKey(e.target.value)} />
                </th>
                <th className="p-2" aria-sort={sortKey === "bulletin_date" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("bulletin_date")}>Data {sortIndicator("bulletin_date")}</button>
                  <input className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="YYYY ou YYYY-MM ou YYYY-MM-DD" value={fDate} onChange={(e) => setFDate(e.target.value)} />
                </th>
                <th className="p-2" aria-sort={sortKey === "canonical_type" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="font-semibold cursor-pointer select-none" onClick={() => toggleSort("canonical_type")}>Tipo de Boletim {sortIndicator("canonical_type")}</button>
                  <input className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="Filtrar" value={fType} onChange={(e) => setFType(e.target.value)} />
                </th>
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
