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
} from "recharts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type Row = {
  id: number;
  source_file?: string | null;
  company: string | null;
  ticker: string | null; // publicado, pode ser *.P
  bulletin_type: string | null;
  canonical_type: string | null;
  bulletin_date: string | null;
  composite_key?: string | null;
  body_text: string | null;
};

type ScatterDatum = {
  company: string;
  ticker: string;        // publicado
  ticker_root: string;   // normalizado, não mostrado na UI
  dateNum: number;
  canonical_type: string;
  type_display: string;  // fallback p/ bulletin_type
  dateISO: string;
  composite_key?: string;
};

type Opt = { value: string; label: string };

const CPC_CANONICAL = "NEW LISTING-CPC-SHARES";

type SortKey = "company" | "ticker" | "composite_key" | "bulletin_date" | "canonical_type";
type SortDir = "asc" | "desc";

// -------- helpers de data ----------
function toDateNum(iso: string | null | undefined): number {
  if (!iso) return Number.NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || "").trim());
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

// -------- normalização de ticker ----------
function normalizeTicker(t?: string | null) {
  return (t ?? "").trim().toUpperCase().replace(/\.P$/, "");
}
function keyCT(company?: string | null, ticker?: string | null) {
  return `${(company ?? "").trim()}|${normalizeTicker(ticker)}`;
}

// -------- helpers p/ eixos ----------
const DAY = 24 * 60 * 60 * 1000;
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
function startOfYearUTC(ts: number) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), 0, 1);
}
function addDaysUTC(ts: number, n: number) {
  return ts + n * DAY;
}
function addMonthsUTC(ts: number, n: number) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return Date.UTC(y, m + n, 1);
}
function makeTicksAdaptive(domain: [number, number]) {
  const [min, max] = domain;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    return { ticks: [] as number[], formatter: (v: number) => fmtDayMonth(v) };
  }
  const span = max - min;

  const fYear = new Intl.DateTimeFormat("pt-BR", { year: "numeric", timeZone: "UTC" });
  const fMonY = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });
  const fMon = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
  const fDayMon = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

  if (span >= 3 * 365 * DAY) {
    let t = startOfYearUTC(min);
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
  if (span >= 60 * DAY) {
    let t = startOfDayUTC(min);
    const ticks: number[] = [];
    while (t <= max) { ticks.push(t); t = addDaysUTC(t, 15); }
    return { ticks, formatter: (v: number) => fDayMon.format(v) };
  }
  if (span >= 14 * DAY) {
    let t = startOfDayUTC(min);
    const ticks: number[] = [];
    while (t <= max) { ticks.push(t); t = addDaysUTC(t, 7); }
    return { ticks, formatter: (v: number) => fDayMon.format(v) };
  }
  {
    let t = startOfDayUTC(min);
    const ticks: number[] = [];
    while (t <= max) { ticks.push(t); t = addDaysUTC(t, 1); }
    return { ticks, formatter: (v: number) => fDayMon.format(v) };
  }
}

// -------- Tipos p/ eventos (anúncio + confirmação) ----------
type Event = {
  ticker_root: string;
  company: string;
  canonical_type: string;
  event_date: string;      // ISO do 1º
  confirm_date?: string;   // ISO do 2º (se houver)
  bulletins: Row[];        // boletins usados
};

function isConfirmText(txt: string): boolean {
  const s = txt.toLowerCase();
  return (
    s.includes("upon confirmation of closing") ||
    s.includes("confirmation of closing") ||
    s.includes("commence trading") ||
    s.includes("will commence trading") ||
    s.includes("sera admise à la négociation") ||
    s.includes("confirmation de la clôture")
  );
}

function foldCpcEvents(rows: Row[]): Event[] {
  const byKey = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.bulletin_date) continue;
    const ctype = (r.canonical_type ?? r.bulletin_type ?? "").toUpperCase();
    if (ctype !== CPC_CANONICAL) continue;
    const k = `${normalizeTicker(r.ticker)}|${ctype}`;
    const arr = byKey.get(k) ?? [];
    arr.push(r);
    byKey.set(k, arr);
  }

  const out: Event[] = [];
  for (const arr0 of byKey.values()) {
    const arr = [...arr0].sort((a,b)=>toDateNum(a.bulletin_date)-toDateNum(b.bulletin_date));
    if (arr.length === 1) {
      const r = arr[0];
      out.push({
        ticker_root: normalizeTicker(r.ticker),
        company: r.company ?? "",
        canonical_type: (r.canonical_type ?? r.bulletin_type ?? "").toUpperCase(),
        event_date: r.bulletin_date!,
        bulletins: [r],
      });
      continue;
    }
    let i = 0;
    while (i < arr.length) {
      const a = arr[i];
      const b = arr[i+1];
      if (b && (toDateNum(b.bulletin_date) - toDateNum(a.bulletin_date)) <= DAY) {
        const confirmish = isConfirmText(b.body_text ?? "") || isConfirmText(a.body_text ?? "");
        if (confirmish) {
          out.push({
            ticker_root: normalizeTicker(a.ticker),
            company: a.company ?? "",
            canonical_type: (a.canonical_type ?? a.bulletin_type ?? "").toUpperCase(),
            event_date: a.bulletin_date!,
            confirm_date: b.bulletin_date!,
            bulletins: [a,b],
          });
          i += 2;
          continue;
        }
      }
      out.push({
        ticker_root: normalizeTicker(a.ticker),
        company: a.company ?? "",
        canonical_type: (a.canonical_type ?? a.bulletin_type ?? "").toUpperCase(),
        event_date: a.bulletin_date!,
        bulletins: [a],
      });
      i += 1;
    }
  }
  return out;
}

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [selectedBulletin, setSelectedBulletin] = useState<Row | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [globalMinDate, setGlobalMinDate] = useState<string>("");
  const [globalMaxDate, setGlobalMaxDate] = useState<string>("");

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [selCompanies, setSelCompanies] = useState<Opt[]>([]);
  const [selTickers, setSelTickers] = useState<Opt[]>([]); // value = raiz normalizada

  // Flags
  const [onlyMultiTypes, setOnlyMultiTypes] = useState(false); // ≥2 tipos (eventos) por ticker
  const [onlySingleType, setOnlySingleType] = useState(false); // =1 tipo (evento) por ticker
  const [onlyFirst, setOnlyFirst] = useState(false);
  const [onlyLast, setOnlyLast] = useState(false);
  const [fuseConfirm, setFuseConfirm] = useState(true); // fundir confirmações no scatter
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

  // Toggle para abrir/fechar blocos
  const [showChart, setShowChart] = useState(true);
  const [showStats, setShowStats] = useState(true);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const s = q.get("s"); const e = q.get("e");
    const t = q.get("t"); const c = q.get("c");
    if (s) setStartDate(s);
    if (e) setEndDate(e);
    if (t) {
      setSelTickers(
        t.split(",")
          .map(v => normalizeTicker(v))
          .filter(Boolean)
          .map(v => ({ value: v, label: v }))
      );
    }
    if (c) setSelCompanies(c.split(",").map(v => ({ value: v, label: v })));
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("vw_bulletins_with_canonical")
      .select("id, source_file, company, ticker, bulletin_type, canonical_type, bulletin_date, composite_key, body_text")
      .or(`canonical_type.eq.${CPC_CANONICAL},bulletin_type.ilike.%${CPC_CANONICAL}%`)
      .order("bulletin_date", { ascending: true });

    if (error) {
      console.error(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const r = (data || []) as Row[];
    setRows(r);

    const ds = r.map((x) => x.bulletin_date).filter(Boolean) as string[];
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

  useEffect(() => {
    if (startDate && endDate && startDate > endDate) setEndDate(startDate);
  }, [startDate, endDate]);

  useEffect(() => {
    const p = new URLSearchParams();
    if (startDate) p.set("s", startDate);
    if (endDate) p.set("e", endDate);
    if (selTickers.length) p.set("t", selTickers.map(o => o.value).join(","));
    if (selCompanies.length) p.set("c", selCompanies.map(o => o.value).join(","));
    history.replaceState(null, "", `?${p.toString()}`);
  }, [startDate, endDate, selTickers, selCompanies]);

  // janela temporal
  const rowsInWindow = useMemo(() => {
    return rows.filter((r) => {
      if (!r.bulletin_date) return false;
      if (startDate && r.bulletin_date < startDate) return false;
      if (endDate && r.bulletin_date > endDate) return false;
      return true;
    });
  }, [rows, startDate, endDate]);

  // filtros de seletores
  const companyOpts = useMemo<Opt[]>(() => {
    const s = new Set<string>();
    for (const r of rowsInWindow) if (r.company) s.add(r.company);
    return Array.from(s).sort().map((v) => ({ value: v, label: v }));
  }, [rowsInWindow]);

  const tickerOpts = useMemo<Opt[]>(() => {
    const roots = new Set<string>();
    for (const r of rowsInWindow) {
      const root = normalizeTicker(r.ticker);
      if (!root) continue;
      roots.add(root);
    }
    return Array.from(roots).sort().map((root) => ({ value: root, label: root }));
  }, [rowsInWindow]);

  useEffect(() => {
    const validCompanies = new Set(companyOpts.map((o) => o.value));
    const validTickers = new Set(tickerOpts.map((o) => o.value));
    setSelCompanies((prev) => prev.filter((o) => validCompanies.has(o.value)));
    setSelTickers((prev) => prev.filter((o) => validTickers.has(o.value)));
  }, [companyOpts, tickerOpts]);

  // Base respeitando Company/Ticker (para eventos/estatística)
  const baseFilteredBySelectors = useMemo(() => {
    const cset = new Set(selCompanies.map((o) => o.value));
    const tset = new Set(selTickers.map((o) => o.value)); // raízes
    return rowsInWindow.filter((r) => {
      const tRoot = normalizeTicker(r.ticker);
      if (cset.size && (!r.company || !cset.has(r.company))) return false;
      if (tset.size && (!tRoot || !tset.has(tRoot))) return false;
      return true;
    });
  }, [rowsInWindow, selCompanies, selTickers]);

  // Eventos (anúncio+confirmação)
  const events = useMemo(() => foldCpcEvents(baseFilteredBySelectors), [baseFilteredBySelectors]);

  // flags por nº de eventos por ticker_root
  const eventsPerRoot = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) {
      const k = e.ticker_root;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [events]);

  // Base da TABELA (boletins brutos) ainda respeita flags básicas de "apenas primeiro/último" por raiz (não por evento)
  const filteredBase = useMemo(() => {
    // aplica flags de nº de eventos por root
    const allowByRoot = new Set<string>();
    for (const [root, cnt] of eventsPerRoot.entries()) {
      if (onlySingleType && cnt !== 1) continue;
      if (onlyMultiTypes && cnt < 2) continue;
      allowByRoot.add(root);
    }
    return baseFilteredBySelectors.filter((r) => {
      const tRoot = normalizeTicker(r.ticker);
      if (!tRoot || !allowByRoot.has(tRoot)) return false;
      return true;
    });
  }, [baseFilteredBySelectors, eventsPerRoot, onlySingleType, onlyMultiTypes]);

  // first/last por raiz para a tabela
  const filtered = useMemo(() => {
    if (!onlyFirst && !onlyLast) return filteredBase;
    const byRoot = new Map<string, Row[]>();
    for (const r of filteredBase) {
      const t = normalizeTicker(r.ticker);
      if (!t) continue;
      if (!byRoot.has(t)) byRoot.set(t, []);
      byRoot.get(t)!.push(r);
    }
    const out: Row[] = [];
    for (const arr of byRoot.values()) {
      arr.sort((a, b) => toDateNum(a.bulletin_date) - toDateNum(b.bulletin_date));
      if (onlyFirst) out.push(arr[0]);
      if (onlyLast) out.push(arr[arr.length - 1]);
    }
    return out;
  }, [filteredBase, onlyFirst, onlyLast]);

  const filteredSorted = useMemo(
    () => [...filtered].sort((a, b) => toDateNum(a.bulletin_date) - toDateNum(b.bulletin_date)),
    [filtered],
  );

  // dados do gráfico (pode ser por boletins ou por eventos fundidos)
  const chartData = useMemo(() => {
    if (!fuseConfirm) {
      // raw boletins
      return filteredSorted.map((r) => ({
        company: r.company ?? "",
        ticker: r.ticker ?? "",
        ticker_root: normalizeTicker(r.ticker),
        dateNum: toDateNum(r.bulletin_date),
        canonical_type: r.canonical_type ?? "",
        type_display: r.canonical_type ?? r.bulletin_type ?? "",
        dateISO: r.bulletin_date ?? "",
        composite_key: r.composite_key ?? undefined,
      })) as ScatterDatum[];
    }
    // por eventos (um ponto por event_date)
    // também aplica flags onlySingleType/onlyMultiTypes
    const allowByRoot = new Set<string>();
    for (const [root, cnt] of eventsPerRoot.entries()) {
      if (onlySingleType && cnt !== 1) continue;
      if (onlyMultiTypes && cnt < 2) continue;
      allowByRoot.add(root);
    }
    return events
      .filter(e => allowByRoot.has(e.ticker_root))
      .map((e) => ({
        company: e.company,
        ticker: e.ticker_root, // rótulo aproxima
        ticker_root: e.ticker_root,
        dateNum: toDateNum(e.event_date),
        canonical_type: e.canonical_type,
        type_display: e.canonical_type,
        dateISO: e.event_date,
        composite_key: e.bulletins[0]?.composite_key,
      })) as ScatterDatum[];
  }, [filteredSorted, fuseConfirm, events, eventsPerRoot, onlySingleType, onlyMultiTypes]);

  const xDomain = useMemo<[number | "auto", number | "auto"]>(() => {
    const times = chartData.map((d) => d.dateNum).filter((v): v is number => Number.isFinite(v));
    if (!times.length) return ["auto", "auto"];
    const PAD = 5 * DAY;
    const min = Math.min(...times);
    const max = Math.max(...times);
    return [min - PAD, max + PAD];
  }, [chartData]);

  // ordem por primeiro evento da raiz
  const tickerOrder = useMemo<string[]>(() => {
    const first = new Map<string, number>();
    for (const d of chartData) {
      const t = d.ticker_root;
      if (!t) continue;
      const ts = d.dateNum;
      const prev = first.get(t);
      if (Number.isFinite(ts) && (prev === undefined || ts < prev!)) {
        first.set(t, ts);
      }
    }
    return Array.from(first.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([t]) => t);
  }, [chartData]);

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

  const handleReset = () => {
    setSelCompanies([]);
    setSelTickers([]);
    setStartDate(globalMinDate);
    setEndDate(globalMaxDate);
    setOnlyMultiTypes(false);
    setOnlySingleType(false);
    setOnlyFirst(false);
    setOnlyLast(false);
    setFuseConfirm(true);
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

  const openBulletinModal = async (row: Row) => {
    setSelectedBulletin(row);
    if (!row.composite_key || row.body_text) return;
    const { data, error } = await supabase
      .from("vw_bulletins_with_canonical")
      .select("body_text")
      .eq("composite_key", row.composite_key)
      .single();
    if (!error && data) {
      setSelectedBulletin((prev) => (prev ? { ...prev, body_text: (data as {body_text: string}).body_text } : prev));
    }
  };
  const closeBulletinModal = () => setSelectedBulletin(null);

  // Fechar modal com ESC
  useEffect(() => {
    if (!selectedBulletin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeBulletinModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedBulletin]);

  function onPointClick(
    payload: ScatterDatum,
    _index: number,
    ...rest: unknown[]
  ): void {
    const evt = (rest[0] as { shiftKey?: boolean } | undefined);
    const isShift = !!(evt && evt.shiftKey);

    if (isShift && payload.composite_key) {
      setFKey(payload.composite_key);
      setFCompany("");
    } else {
      setFCompany(payload.company || "");
      setFKey("");
    }
    setTimeout(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (firstRowRef.current) {
        firstRowRef.current.classList.add("bg-yellow-50");
        setTimeout(() => firstRowRef.current?.classList.remove("bg-yellow-50"), 1800);
      }
    }, 0);
  }

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

  // tabela: filtros de texto continuam olhando o ticker publicado
  const tableRows = useMemo(() => {
    const cf = dfCompany.trim().toLowerCase();
    const tf = dfTicker.trim().toLowerCase();
    const kf = dfKey.trim().toLowerCase();
    const dfv = dfDate.trim();
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
      if (dfv && !d.startsWith(dfv)) return false;
      if (yf && !y.includes(yf)) return false;
      return true;
    });

    const getVal = (r: Row, k: SortKey) =>
      k === "bulletin_date" ? toDateNum(r.bulletin_date)
      : k === "company" ? (r.company ?? "").toLowerCase()
      : k === "ticker" ? (r.ticker ?? "").toLowerCase()
      : k === "canonical_type" ? (r.canonical_type ?? r.bulletin_type ?? "").toLowerCase()
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

  const tableRowsPage = useMemo(() => tableRows.slice(0, tableLimit), [tableRows, tableLimit]);
  useEffect(() => { setTableLimit(PAGE); }, [filtered.length, dfCompany, dfTicker, dfKey, dfDate, dfType, sortKey, sortDir]);

  // KPIs simplificados
  const kpis = useMemo(() => {
    const total = tableRows.length;
    const companies = new Set(tableRows.map(r => r.company).filter(Boolean) as string[]).size;
    const perRoot = new Set(tableRows.map(r => normalizeTicker(r.ticker)).filter(Boolean) as string[]).size;
    return { total, companies, tickers: perRoot };
  }, [tableRows]);

  // -------- Estatísticas (=1 vs ≥2 eventos por empresa) ----------
  const statsData = useMemo(() => {
    const perCompany = new Map<string, number>();
    for (const e of events) {
      const key = e.company || "";
      if (!key) continue;
      perCompany.set(key, (perCompany.get(key) ?? 0) + 1);
    }
    let one = 0, ge2 = 0;
    for (const cnt of perCompany.values()) {
      if (cnt === 1) one++; else if (cnt >= 2) ge2++;
    }
    return [
      { group: "=1", count: one },
      { group: "≥2", count: ge2 },
      { group: "TOTAL", count: perCompany.size },
    ];
  }, [events]);

  // ticks dinâmicos para eixo X
  const xTicksMemo = useMemo(() => {
    if (xDomain[0] === "auto" || xDomain[1] === "auto") return { ticks: [] as number[], formatter: (v: number) => fmtDayMonth(v) };
    return makeTicksAdaptive([xDomain[0] as number, xDomain[1] as number]);
  }, [xDomain]);

  return (
    <div className="p-6 space-y-4">
      {/* Título + botões */}
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">CPC — Notices</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={() => {
              // export seleção (tabela)
              const run = async () => {
                if (!tableRows.length) { alert("Nada a exportar."); return; }
                const sorted = [...tableRows].sort((a,b)=>toDateNum(a.bulletin_date)-toDateNum(b.bulletin_date));
                const story = sorted.map((r) => `${r.bulletin_date ?? ""} — ${(r.bulletin_type ?? "")}\n${r.body_text ?? ""}\n`).join("\n--------------------------------\n");
                const filename = `cpc_notices_selecao_${(startDate||"").replaceAll("-","")}_${(endDate||"").replaceAll("-","")}.txt`;
                const blob = new Blob([story], { type: "text/plain;charset=utf-8" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); window.URL.revokeObjectURL(url);
              };
              void run();
            }}
            disabled={loading || !tableRows.length}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60"
            title="Exporta exatamente o que aparece na tabela (todas as linhas filtradas)"
          >
            📜 Exportar seleção
          </button>
        </div>
      </div>

      {/* KPIs (simplificados) */}
      <div className="flex flex-wrap gap-3 text-sm">
        <div className="border rounded px-2 py-1">Empresas: <strong>{kpis.companies}</strong></div>
        <div className="border rounded px-2 py-1">Tickers: <strong>{kpis.tickers}</strong></div>
        <div className="border rounded px-2 py-1">Boletins: <strong>{kpis.total}</strong></div>
      </div>

      <div className="flex items-center text-sm text-gray-600">
        {loading ? "Carregando…" : `${chartData.length} pontos no Scatter (${fuseConfirm ? "eventos fundidos" : "boletins"})`}
      </div>

      {/* Controles superiores */}
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

          {/* Flags novas por nº de eventos (tipos) */}
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={onlySingleType}
              onChange={(e) => { setOnlySingleType(e.target.checked); if (e.target.checked) setOnlyMultiTypes(false); }}
            />
            Somente tickers com 1 tipo de boletim
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={onlyMultiTypes}
              onChange={(e) => { setOnlyMultiTypes(e.target.checked); if (e.target.checked) setOnlySingleType(false); }}
            />
            Somente tickers com ≥2 tipos de boletins
          </label>

          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={onlyFirst}
              onChange={(e) => { setOnlyFirst(e.target.checked); if (e.target.checked) setOnlyLast(false); }}
            />
            Apenas primeiro
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={onlyLast}
              onChange={(e) => { setOnlyLast(e.target.checked); if (e.target.checked) setOnlyFirst(false); }}
            />
            Apenas último
          </label>

          {/* Alterna o eixo Y (tickers) */}
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={showTickerAxis}
              onChange={(e) => setShowTickerAxis(e.target.checked)}
            />
            Mostrar tickers no eixo Y
          </label>

          {/* Fundir confirmações */}
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={fuseConfirm}
              onChange={(e) => setFuseConfirm(e.target.checked)}
            />
            Fundir confirmações no Scatter
          </label>

          {/* Botões de abrir/fechar */}
          <button
            className="border rounded px-3 py-1"
            onClick={() => setShowChart(v => !v)}
            title="Abrir/fechar o gráfico de dispersão"
          >
            {showChart ? "Fechar Scatter" : "Abrir Scatter"}
          </button>
          <button
            className="border rounded px-3 py-1"
            onClick={() => setShowStats(v => !v)}
            title="Abrir/fechar o bloco de estatísticas"
          >
            {showStats ? "Fechar estatísticas" : "Abrir estatísticas"}
          </button>
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
            onChange={(v: MultiValue<Opt>) => setSelTickers(v as Opt[])} // value = raiz
            classNamePrefix="cpc-select"
          />
        </div>
      </div>

      {/* Gráfico (acordeão simples) */}
      <div
        className="w-full border rounded overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: showChart ? chartHeight : 0 }}
        aria-hidden={!showChart}
      >
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
                name="Data"
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
              <Scatter
                data={chartDataVis}
                onClick={(p, idx, ...rest) => onPointClick(p as ScatterDatum, idx as number, ...rest)}
              />
            </ScatterChart>
          </ResponsiveContainer>
          {selTickers.length > 0 && chartDataVis.length === 0 && (
            <div className="text-xs text-gray-600 mt-1">Sem eventos para a seleção no período.</div>
          )}
        </div>
      </div>

      {/* NOVO BLOCO: Estatísticas (abrir/fechar) */}
      <div
        className="w-full border rounded overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: showStats ? 260 : 0 }}
        aria-hidden={!showStats}
      >
        <div className="p-3" style={{ height: 240 }}>
          <div className="text-sm text-gray-700 mb-2">
            Empresas por nº de tipos de boletins (eventos) no período filtrado
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statsData.filter(d=>d.group!=='TOTAL')}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="group" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v: unknown) => {
                  const n = typeof v === "number" ? v : Number(v);
                  return [String(n), "Empresas"] as [string, string];
                }}
                labelFormatter={(l: unknown) => (String(l) === "=1" ? "Apenas 1 tipo" : "Dois ou mais tipos")}
              />
              <Bar dataKey="count" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 text-xs text-gray-600">
            Total de empresas no período: <strong>{(statsData.find(d=>d.group==='TOTAL')?.count) ?? 0}</strong> •
            Apenas 1 tipo: <strong>{(statsData.find(d=>d.group==='=1')?.count) ?? 0}</strong> •
            ≥2 tipos: <strong>{(statsData.find(d=>d.group==='≥2')?.count) ?? 0}</strong>
          </div>
        </div>
      </div>

      {!loading && filtered.length === 0 && (
        <div className="text-sm text-gray-600 mt-2">
          Sem resultados. Ajuste datas, filtros ou “Somente por tipo”.
        </div>
      )}

      {/* Tabela */}
      <div className="space-y-2" ref={tableRef}>
        <h2 className="text-xl font-semibold">Resultados</h2>
        <div className="border rounded overflow-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b sticky top-0 z-10">
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
              {tableRowsPage.map((row, i) => {
                const compositeKey = row.composite_key ?? "—";
                const refAttr = i === 0 ? { ref: firstRowRef } : {};
                return (
                  <tr key={row.id} className="border-b hover:bg-gray-50" {...refAttr}>
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
                    <td className="p-2">{row.canonical_type ?? row.bulletin_type ?? "—"}</td>
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

        {/* Paginação */}
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
          <div
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeBulletinModal();
            }}
          >
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

// largura do YAxis quando visível
function ninetyWidth(){ return 90; }
