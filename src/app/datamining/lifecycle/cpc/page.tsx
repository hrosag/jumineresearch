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
  id?: number;
  company?: string | null;
  ticker?: string | null;
  ticker_root?: string | null;
  composite_key?: string | null;
  bulletin_date?: string | null;
  canonical_type?: string | null;
  canonical_class?: string | null;
  tier?: string | null;
  bulletin_type?: string | null;
  body_text?: string | null;
  _mixed?: boolean | null;
  source_file?: string | null;
  parser_profile?: string | null;
  parser_status?: string | null;
  parser_parsed_at?: string | null;
  parse_version?: string | null;
};

type ScatterDatum = {
  id: number;
  company: string;
  ticker: string;
  ticker_root: string;
  composite_key: string;
  date: string;
  dateNum: number;
  canonical_type: string | null;
  canonical_class: string | null;
  bulletin_type: string | null;
  isCpc: boolean;
  isCpcMixed: boolean;
  isQt: boolean;
  isQtCompleted: boolean;
};

type Option = { value: string; label: string };

const CpcCanonical = "NEW LISTING-CPC-SHARES";
const QT_COMPLETED = "QUALIFYING TRANSACTION-COMPLETED";
const QT_ANY = "QUALIFYING TRANSACTION";

const PARSER_OPTIONS = ["cpc_birth"] as const;

function normalizeTicker(t: string | null | undefined): string {
  if (!t) return "";
  return t.toUpperCase().split(".")[0].trim();
}

function errMessage(e: unknown): string {
  if (!e) return "Erro desconhecido";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  try {
    // @ts-ignore
    if (typeof e.message === "string") return e.message;
  } catch {
    // ignore
  }
  return String(e);
}

function toDateNum(date: string | null | undefined): number | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d);
}

function fmtUTC(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDayMonth(ts: number): string {
  const d = new Date(ts);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${m}`;
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
  return ts + n * 24 * 60 * 60 * 1000;
}
function addMonthsUTC(ts: number, n: number) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const day = d.getUTCDate();
  return Date.UTC(y, m, day);
}

function makeTicksAdaptive(domain: [number, number]) {
  const [min, max] = domain;
  const span = max - min;
  const day = 24 * 60 * 60 * 1000;
  const month = day * 30;
  const year = day * 365;

  if (span <= day * 45) {
    // <= 45 dias → ticks diários
    const ticks: number[] = [];
    let cur = startOfDayUTC(min);
    while (cur <= max) {
      ticks.push(cur);
      cur = addDaysUTC(cur, 1);
    }
    return {
      ticks,
      formatter: (ts: number) => fmtDayMonth(ts),
    };
  }

  if (span <= month * 18) {
    // <= ~18 meses → ticks mensais
    const ticks: number[] = [];
    let cur = startOfMonthUTC(min);
    while (cur <= max) {
      ticks.push(cur);
      cur = addMonthsUTC(cur, 1);
    }
    return {
      ticks,
      formatter: (ts: number) => {
        const d = new Date(ts);
        const y = d.getUTCFullYear();
        const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
        return `${m}/${y.toString().slice(-2)}`;
      },
    };
  }

  if (span <= year * 6) {
    // <= 6 anos → ticks trimestrais
    const ticks: number[] = [];
    let cur = startOfQuarterUTC(min);
    while (cur <= max) {
      ticks.push(cur);
      cur = addMonthsUTC(cur, 3);
    }
    return {
      ticks,
      formatter: (ts: number) => {
        const d = new Date(ts);
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth();
        const q = Math.floor(m / 3) + 1;
        return `Q${q}/${y.toString().slice(-2)}`;
      },
    };
  }

  // span grande → ticks anuais
  const ticks: number[] = [];
  const startYear = new Date(min).getUTCFullYear();
  const endYear = new Date(max).getUTCFullYear();
  for (let y = startYear; y <= endYear; y++) {
    ticks.push(Date.UTC(y, 0, 1));
  }
  return {
    ticks,
    formatter: (ts: number) => new Date(ts).getUTCFullYear().toString(),
  };
}

function keyCT(company: string | null | undefined, ticker: string | null | undefined) {
  return `${(company || "").trim()}|${normalizeTicker(ticker)}`;
}

function dedupByCompanyRootType(rows: Row[]): Row[] {
  const map = new Map<string, Row>();
  for (const r of rows) {
    if (!r.company || !r.ticker_root || !r.bulletin_date) continue;
    const key = `${r.company}|${r.ticker_root}|${(r.canonical_type || r.bulletin_type || "").trim()}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, r);
      continue;
    }
    const dNew = toDateNum(r.bulletin_date);
    const dOld = toDateNum(existing.bulletin_date);
    if (dNew && dOld && dNew < dOld) {
      map.set(key, r);
    }
  }
  return Array.from(map.values());
}

function withBodyTextFilled(rows: Row[], map: Map<string, string>): Row[] {
  return rows.map((r) => {
    if (r.body_text && r.body_text.trim() !== "") return r;
    const key = r.composite_key ?? "";
    const bt = map.get(key);
    if (!bt) return r;
    return { ...r, body_text: bt };
  });
}

function isCpc(row: Row): boolean {
  const t = (row.canonical_type || row.bulletin_type || "").toUpperCase();
  return t.includes(CpcCanonical);
}

function isQtAny(row: Row): boolean {
  const t = (row.canonical_type || row.bulletin_type || "").toUpperCase();
  return t.includes(QT_ANY);
}

function isQtCompleted(row: Row): boolean {
  const t = (row.canonical_type || row.bulletin_type || "").toUpperCase();
  return t.includes(QT_COMPLETED);
}

function isCpcMixed(row: Row): boolean {
  if (row._mixed) return true;
  const klass = (row.canonical_class || "").toLowerCase();
  const type = (row.canonical_type || row.bulletin_type || "").toLowerCase();
  if (klass.startsWith("mist")) return true;
  if (type.includes(",")) return true;
  return false;
}

// detecção de CPC pelo corpo do texto (várias variantes)
function isCpcByBody(row: Row): boolean {
  const body = (row.body_text ?? "").toLowerCase();
  if (!body) return false;
  // cobre "New Listing - CPC - Shares", "New-CPC-Share(s)", "New Listing CPC Shares"
  const re =
    /(new\s*listing\s*[-–—]?\s*cpc\s*[-–—]?\s*shares?)|new[-\s]?cpc[-\s]?share(s)?/i;
  return re.test(body);
}

function suggestedParserProfile(row: Row): string | null {
  const manual = (row.parser_profile ?? "").trim();
  if (manual) return manual;

  const t = (row.canonical_type ?? "").toUpperCase();
  const klass = (row.canonical_class ?? "").toUpperCase();

  if (t.includes("NEW LISTING-CPC-SHARES") && klass === "UNICO") {
    return "cpc_birth";
  }
  return null;
}

function parserStatusLabel(row: Row): string {
  const s = (row.parser_status ?? "").toLowerCase();
  if (!s || s === "none") return "Pendente";
  if (s === "ready") return "Pronto";
  if (s === "running") return "Rodando";
  if (s === "done") return "Concluído";
  if (s === "error") return "Erro";
  return s;
}

const PAGE = 50;

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingAnchors, setLoadingAnchors] = useState(false);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const [autoPeriod, setAutoPeriod] = useState(true);

  const [selCompanies, setSelCompanies] = useState<Option[]>([]);
  const [selTickers, setSelTickers] = useState<Option[]>([]);

  const [sortKey, setSortKey] = useState<"company" | "ticker" | "date" | "type">(
    "date",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [fCompany, setFCompany] = useState("");
  const [fTicker, setFTicker] = useState("");
  const [fKey, setFKey] = useState("");
  const [fDate, setFDate] = useState("");
  const [fType, setFType] = useState("");

  const [onlyMulti, setOnlyMulti] = useState(false);
  const [onlySingle, setOnlySingle] = useState(false);
  const [onlyFirst, setOnlyFirst] = useState(false);
  const [onlyLast, setOnlyLast] = useState(false);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [removeDupByType, setRemoveDupByType] = useState(false);

  const [flagNewCpc, setFlagNewCpc] = useState(false);
  const [flagCpcMixed, setFlagCpcMixed] = useState(false);
  const [flagQtCompleted, setFlagQtCompleted] = useState(false);

  const [tableLimit, setTableLimit] = useState(PAGE);
  const [yLimit, setYLimit] = useState(40);
  const [showTickerAxis, setShowTickerAxis] = useState(true);

  const [showChart, setShowChart] = useState(true);
  const [showStats, setShowStats] = useState(true);

  const [parserLoadingId, setParserLoadingId] = useState<number | null>(null);

  async function setParserForRow(row: Row, parser: string | null) {
    if (!row.id) return;
    setParserLoadingId(row.id);
    try {
      const { error } = await supabase
        .from("all_data")
        .update({
          parser_profile: parser,
          parser_status: parser ? "ready" : "none",
          parser_parsed_at: null,
        })
        .eq("id", row.id);

      if (error) throw error;

      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                parser_profile: parser,
                parser_status: parser ? "ready" : "none",
                parser_parsed_at: null,
              }
            : r,
        ),
      );
    } catch (e) {
      setErrorMsg(errMessage(e));
    } finally {
      setParserLoadingId(null);
    }
  }

  async function activateParserForRow(row: Row) {
    if (!row.id) return;
    const parser = (row.parser_profile ?? "").trim();
    if (!parser) {
      setErrorMsg("Selecione um parser antes de ativar.");
      return;
    }

    setParserLoadingId(row.id);
    try {
      const res = await fetch("/api/cpc_birth_unico", {
        method: "POST",
      });

      if (!res.ok) {
        let msg = "";
        try {
          const body = await res.json();
          msg =
            (body && (body.error || body.message)) ||
            `Erro ao disparar parser (status ${res.status})`;
        } catch {
          msg = `Erro ao disparar parser (status ${res.status})`;
        }
        throw new Error(msg);
      }
    } catch (e) {
      setErrorMsg(errMessage(e));
    } finally {
      setParserLoadingId(null);
    }
  }

  // Âncoras (1º CPC por (company|ticker_root))
  const [anchors, setAnchors] = useState<Map<string, string>>(new Map());
  const [anchorCompanies, setAnchorCompanies] = useState<string[]>([]);

  const filledKeysRef = useRef<Set<string>>(new Set());
  const [selectedBulletin, setSelectedBulletin] = useState<Row | null>(null);

  const [xTicksMemo, setXTicksMemo] = useState<number[]>([]);
  const [xTickFormatter, setXTickFormatter] = useState<(ts: number) => string>(
    () => (ts) => fmtUTC(ts),
  );

  const [tickerOrder, setTickerOrder] = useState<string[]>([]);
  const [showTable, setShowTable] = useState(true);

  const firstRowRef = useRef<HTMLTableRowElement | null>(null);

  // carregar âncoras de CPC (1º CPC por company|ticker_root)
  useEffect(() => {
    let canceled = false;
    async function loadAnchors() {
      setLoadingAnchors(true);
      try {
        const { data, error } = await supabase
          .from("vw_bulletins_with_canonical")
          .select(
            "id, company, ticker, ticker_root, composite_key, bulletin_date, canonical_type, canonical_class",
          )
          .ilike("canonical_type", `%${CpcCanonical}%`);

        if (error) throw error;
        if (!data) return;

        const map = new Map<string, string>();
        for (const r of data as any[]) {
          const key = keyCT(r.company, r.ticker);
          const existing = map.get(key);
          if (!existing) {
            map.set(key, r.bulletin_date);
            continue;
          }
          const dNew = toDateNum(r.bulletin_date);
          const dOld = toDateNum(existing);
          if (dNew && dOld && dNew < dOld) {
            map.set(key, r.bulletin_date);
          }
        }

        if (canceled) return;
        setAnchors(map);
        setAnchorCompanies(Array.from(map.keys()).map((k) => k.split("|")[0]));
      } catch (e) {
        if (!canceled) setErrorMsg(errMessage(e));
      } finally {
        if (!canceled) setLoadingAnchors(false);
      }
    }
    loadAnchors();
    return () => {
      canceled = true;
    };
  }, []);

  // auto-período: pegar min/max de datas
  useEffect(() => {
    if (!autoPeriod) return;
    let canceled = false;
    async function loadRange() {
      try {
        const { data, error } = await supabase
          .from("vw_bulletins_with_canonical")
          .select("bulletin_date")
          .order("bulletin_date", { ascending: true });

        if (error) throw error;
        if (!data || data.length === 0) return;
        const min = (data[0] as any).bulletin_date as string;
        const max = (data[data.length - 1] as any).bulletin_date as string;
        if (canceled) return;
        setStartDate(min);
        setEndDate(max);
      } catch (e) {
        if (!canceled) setErrorMsg(errMessage(e));
      }
    }
    loadRange();
    return () => {
      canceled = true;
    };
  }, [autoPeriod]);

  // sanity de período
  useEffect(() => {
    if (startDate && endDate && startDate > endDate) {
      setEndDate(startDate);
    }
  }, [startDate, endDate]);

  // atualizar querystring
  useEffect(() => {
    const params = new URLSearchParams();
    if (startDate) params.set("s", startDate);
    if (endDate) params.set("e", endDate);
    if (selTickers.length > 0) {
      params.set(
        "t",
        selTickers
          .map((o) => o.value)
          .filter(Boolean)
          .join(","),
      );
    }
    if (selCompanies.length > 0) {
      params.set(
        "c",
        selCompanies
          .map((o) => o.value)
          .filter(Boolean)
          .join(","),
      );
    }
    const qs = params.toString();
    const newUrl = qs ? `?${qs}` : location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [startDate, endDate, selTickers, selCompanies]);

  // preencher body_text em lote
  useEffect(() => {
    async function fillBodies() {
      const missing = rows.filter(
        (r) => (!r.body_text || r.body_text.trim() === "") && r.composite_key,
      );
      if (missing.length === 0) return;

      const toFetch = missing
        .map((r) => r.composite_key!)
        .filter((k) => !filledKeysRef.current.has(k));
      if (toFetch.length === 0) return;

      const BATCH = 300;
      const chunks: string[][] = [];
      for (let i = 0; i < toFetch.length; i += BATCH) {
        chunks.push(toFetch.slice(i, i + BATCH));
      }

      const map = new Map<string, string>();
      for (const chunk of chunks) {
        const { data, error } = await supabase
          .from("all_data")
          .select("composite_key, body_text")
          .in("composite_key", chunk);
        if (error) {
          setErrorMsg(errMessage(error));
          return;
        }
        for (const row of data || []) {
          if (row.body_text && row.composite_key) {
            map.set(row.composite_key, row.body_text);
            filledKeysRef.current.add(row.composite_key);
          }
        }
      }

      if (map.size > 0) {
        setRows((prev) => withBodyTextFilled(prev, map));
      }
    }
    fillBodies();
  }, [rows]);

  const rowsInWindow = useMemo(() => {
    if (!startDate || !endDate) return rows;
    return rows.filter((r) => {
      if (!r.bulletin_date) return false;
      return r.bulletin_date >= startDate && r.bulletin_date <= endDate;
    });
  }, [rows, startDate, endDate]);

  const rowsInWindowFiltered = useMemo(() => {
    let base = rowsInWindow;

    if (selCompanies.length > 0) {
      const set = new Set(selCompanies.map((o) => o.value));
      base = base.filter((r) => r.company && set.has(r.company));
    }
    if (selTickers.length > 0) {
      const set = new Set(selTickers.map((o) => o.value));
      base = base.filter((r) => r.ticker && set.has(normalizeTicker(r.ticker)));
    }

    if (showDuplicatesOnly) {
      const keyCount = new Map<string, number>();
      for (const r of base) {
        const key = `${r.company}|${normalizeTicker(r.ticker)}|${
          r.canonical_type || r.bulletin_type || ""
        }`;
        keyCount.set(key, (keyCount.get(key) || 0) + 1);
      }
      base = base.filter((r) => {
        const key = `${r.company}|${normalizeTicker(r.ticker)}|${
          r.canonical_type || r.bulletin_type || ""
        }`;
        return (keyCount.get(key) || 0) > 1;
      });
    }

    if (onlySingle || onlyMulti || onlyFirst || onlyLast) {
      const map = new Map<string, Row[]>();
      for (const r of base) {
        const root = normalizeTicker(r.ticker);
        const key = `${r.company}|${root}`;
        const arr = map.get(key) || [];
        arr.push(r);
        map.set(key, arr);
      }

      const next: Row[] = [];
      for (const arr of map.values()) {
        const sorted = [...arr].sort((a, b) => {
          const da = toDateNum(a.bulletin_date) || 0;
          const db = toDateNum(b.bulletin_date) || 0;
          return da - db;
        });
        if (onlySingle && sorted.length === 1) {
          next.push(...sorted);
        } else if (onlyMulti && sorted.length > 1) {
          next.push(...sorted);
        } else if (onlyFirst && sorted.length > 0) {
          next.push(sorted[0]);
        } else if (onlyLast && sorted.length > 0) {
          next.push(sorted[sorted.length - 1]);
        }
      }
      base = next;
    }

    if (flagNewCpc) {
      base = base.filter((r) => isCpcByBody(r) || (r.canonical_type ?? "").includes(CpcCanonical));
    }
    if (flagCpcMixed) {
      base = base.filter((r) => isCpcMixed(r));
    }
    if (flagQtCompleted) {
      base = base.filter((r) => isQtCompleted(r));
    }

    if (removeDupByType) {
      base = dedupByCompanyRootType(base);
    }

    return base;
  }, [
    rowsInWindow,
    selCompanies,
    selTickers,
    showDuplicatesOnly,
    onlySingle,
    onlyMulti,
    onlyFirst,
    onlyLast,
    flagNewCpc,
    flagCpcMixed,
    flagQtCompleted,
    removeDupByType,
  ]);

  const defCompany = useDeferredValue(fCompany);
  const defTicker = useDeferredValue(fTicker);
  const defKey = useDeferredValue(fKey);
  const defDate = useDeferredValue(fDate);
  const defType = useDeferredValue(fType);

  const tableRowsBase = useMemo(() => {
    let base = rowsInWindowFiltered;

    if (defCompany.trim()) {
      const q = defCompany.toLowerCase();
      base = base.filter((r) =>
        (r.company || "").toLowerCase().includes(q),
      );
    }
    if (defTicker.trim()) {
      const q = defTicker.toLowerCase();
      base = base.filter((r) =>
        (r.ticker || "").toLowerCase().includes(q),
      );
    }
    if (defKey.trim()) {
      const q = defKey.toLowerCase();
      base = base.filter((r) =>
        (r.composite_key || "").toLowerCase().includes(q),
      );
    }
    if (defDate.trim()) {
      const q = defDate.toLowerCase();
      base = base.filter((r) =>
        (r.bulletin_date || "").toLowerCase().includes(q),
      );
    }
    if (defType.trim()) {
      const q = defType.toLowerCase();
      base = base.filter((r) =>
        (r.canonical_type || r.bulletin_type || "").toLowerCase().includes(q),
      );
    }

    return base;
  }, [rowsInWindowFiltered, defCompany, defTicker, defKey, defDate, defType]);

  const tableRows = useMemo(() => {
    const sorted = [...tableRowsBase];
    sorted.sort((a, b) => {
      if (sortKey === "company") {
        const ca = (a.company || "").toLowerCase();
        const cb = (b.company || "").toLowerCase();
        if (ca < cb) return sortDir === "asc" ? -1 : 1;
        if (ca > cb) return sortDir === "asc" ? 1 : -1;
        return 0;
      }
      if (sortKey === "ticker") {
        const ta = normalizeTicker(a.ticker);
        const tb = normalizeTicker(b.ticker);
        if (ta < tb) return sortDir === "asc" ? -1 : 1;
        if (ta > tb) return sortDir === "asc" ? 1 : -1;
        return 0;
      }
      if (sortKey === "date") {
        const da = toDateNum(a.bulletin_date) || 0;
        const db = toDateNum(b.bulletin_date) || 0;
        if (da < db) return sortDir === "asc" ? -1 : 1;
        if (da > db) return sortDir === "asc" ? 1 : -1;
        return 0;
      }
      if (sortKey === "type") {
        const ta = (a.canonical_type || a.bulletin_type || "").toLowerCase();
        const tb = (b.canonical_type || b.bulletin_type || "").toLowerCase();
        if (ta < tb) return sortDir === "asc" ? -1 : 1;
        if (ta > tb) return sortDir === "asc" ? 1 : -1;
        return 0;
      }
      return 0;
    });
    return sorted;
  }, [tableRowsBase, sortKey, sortDir]);

  const tableRowsPage = useMemo(
    () => tableRows.slice(0, tableLimit),
    [tableRows, tableLimit],
  );

  const tickerCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rowsInWindowFiltered) {
      const root = normalizeTicker(r.ticker);
      if (!root) continue;
      map.set(root, (map.get(root) || 0) + 1);
    }
    return map;
  }, [rowsInWindowFiltered]);

  const chartData = useMemo(() => {
    const data: ScatterDatum[] = [];
    for (const r of rowsInWindowFiltered) {
      if (!r.id || !r.company || !r.ticker || !r.bulletin_date) continue;
      const d = toDateNum(r.bulletin_date);
      if (!d) continue;
      const root = normalizeTicker(r.ticker);
      data.push({
        id: r.id,
        company: r.company,
        ticker: r.ticker,
        ticker_root: root,
        composite_key: r.composite_key || "",
        date: r.bulletin_date,
        dateNum: d,
        canonical_type: r.canonical_type || null,
        canonical_class: r.canonical_class || null,
        bulletin_type: r.bulletin_type || null,
        isCpc: isCpc(r),
        isCpcMixed: isCpcMixed(r),
        isQt: isQtAny(r),
        isQtCompleted: isQtCompleted(r),
      });
    }
    return data;
  }, [rowsInWindowFiltered]);

  const xDomain: [number, number] | null = useMemo(() => {
    if (chartData.length === 0) return null;
    let min = chartData[0].dateNum;
    let max = chartData[0].dateNum;
    for (const d of chartData) {
      if (d.dateNum < min) min = d.dateNum;
      if (d.dateNum > max) max = d.dateNum;
    }
    const margin = 3 * 24 * 60 * 60 * 1000;
    return [min - margin, max + margin];
  }, [chartData]);

  useEffect(() => {
    if (!xDomain) return;
    const { ticks, formatter } = makeTicksAdaptive(xDomain);
    setXTicksMemo(ticks);
    setXTickFormatter(() => formatter);
  }, [xDomain]);

  const tickerOrderFromData = useMemo(() => {
    const firstSeen = new Map<string, number>();
    for (const d of chartData) {
      const key = d.ticker_root;
      if (!firstSeen.has(key) || d.dateNum < (firstSeen.get(key) || Infinity)) {
        firstSeen.set(key, d.dateNum);
      }
    }
    const arr = Array.from(firstSeen.entries());
    arr.sort((a, b) => a[1] - b[1]);
    return arr.map(([ticker]) => ticker);
  }, [chartData]);

  useEffect(() => {
    if (selTickers.length > 0) {
      setTickerOrder(selTickers.map((o) => o.value));
    } else {
      setTickerOrder(tickerOrderFromData);
    }
  }, [selTickers, tickerOrderFromData]);

  const visibleTickers = useMemo(
    () => tickerOrder.slice(0, yLimit),
    [tickerOrder, yLimit],
  );

  const chartDataVis = useMemo(() => {
    const set = new Set(visibleTickers);
    return chartData.filter((d) => set.has(d.ticker_root));
  }, [chartData, visibleTickers]);

  const chartHeight = Math.max(200, visibleTickers.length * 22 + 80);

  const companyOpts = useMemo<Option[]>(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.company) set.add(r.company);
    }
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v }));
  }, [rows]);

  const tickerOpts = useMemo<Option[]>(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (!r.ticker) continue;
      set.add(normalizeTicker(r.ticker));
    }
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v }));
  }, [rows]);

  async function loadTimeline() {
    if (!anchors || anchors.size === 0) {
      setErrorMsg("Âncoras de CPC ainda não carregadas.");
      return;
    }
    setLoadingTimeline(true);
    setErrorMsg(null);
    try {
      const companies = Array.from(anchors.keys());

      const chunks: string[][] = [];
      const BATCH = 100;
      for (let i = 0; i < companies.length; i += BATCH) {
        chunks.push(companies.slice(i, i + BATCH));
      }

      const allRows: Row[] = [];
      for (const chunk of chunks) {
        const { data, error } = await supabase
          .from("vw_bulletins_with_canonical")
          .select(
            "id, company, ticker, ticker_root, composite_key, bulletin_date, canonical_type, canonical_class, tier, bulletin_type, body_text, _mixed, source_file, parser_profile, parser_status, parser_parsed_at, parse_version",
          )
          .in("company", chunk)
          .order("bulletin_date", { ascending: true });

        if (error) throw error;
        if (!data) continue;

        allRows.push(
          ...(data as any[]).filter((r) => {
            const key = keyCT(r.company, r.ticker);
            const anchorDate = anchors.get(key);
            if (!anchorDate) return false;
            return r.bulletin_date >= anchorDate;
          }),
        );
      }

      const byKey = new Map<string, number>();
      for (const r of allRows) {
        const key = r.composite_key || "";
        byKey.set(key, (byKey.get(key) || 0) + 1);
      }

      const withExtra = allRows.map((r) => ({
        ...r,
        _mixed: isCpcMixed(r),
        ticker_root: normalizeTicker(r.ticker),
      }));

      setRows(withExtra);
      setTableLimit(PAGE);
    } catch (e) {
      setErrorMsg(errMessage(e));
    } finally {
      setLoadingTimeline(false);
    }
  }

  function handleReset() {
    setRows([]);
    setStartDate(null);
    setEndDate(null);
    setSelCompanies([]);
    setSelTickers([]);
    setOnlyMulti(false);
    setOnlySingle(false);
    setOnlyFirst(false);
    setOnlyLast(false);
    setShowDuplicatesOnly(false);
    setRemoveDupByType(false);
    setFlagNewCpc(false);
    setFlagCpcMixed(false);
    setFlagQtCompleted(false);
    setTableLimit(PAGE);
    setYLimit(40);
    setShowTickerAxis(true);
    setShowChart(true);
    setShowStats(true);
    setErrorMsg(null);
    setSelectedBulletin(null);
  }

  function toggleSort(key: "company" | "ticker" | "date" | "type") {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortIndicator(key: typeof sortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? "▲" : "▼";
  }

  function onPointClick(data: any, e: any) {
    if (!data || !data.company) return;
    if (e && e.event && e.event.shiftKey && data.composite_key) {
      setFKey(data.composite_key);
      setFCompany("");
      setFTicker("");
    } else {
      setFCompany(data.company);
      setFTicker("");
      setFKey("");
    }
    setShowTable(true);
    setTimeout(() => {
      firstRowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function openBulletinModal(row: Row) {
    if (!row.body_text && row.composite_key) {
      supabase
        .from("all_data")
        .select("body_text")
        .eq("composite_key", row.composite_key)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            setErrorMsg(errMessage(error));
            return;
          }
          if (data && data.body_text) {
            setSelectedBulletin({ ...row, body_text: data.body_text });
          } else {
            setSelectedBulletin(row);
          }
        });
    } else {
      setSelectedBulletin(row);
    }
  }

  function closeBulletinModal() {
    setSelectedBulletin(null);
  }

  function exportRowsToTxt(baseRows: Row[], filenameBase: string) {
    async function doExport() {
      const missing = baseRows.filter(
        (r) => (!r.body_text || r.body_text.trim() === "") && r.composite_key,
      );
      const toFetch = missing
        .map((r) => r.composite_key!)
        .filter((k) => !filledKeysRef.current.has(k));
      if (toFetch.length > 0) {
        const BATCH = 300;
        const chunks: string[][] = [];
        for (let i = 0; i < toFetch.length; i += BATCH) {
          chunks.push(toFetch.slice(i, i + BATCH));
        }
        const map = new Map<string, string>();
        for (const chunk of chunks) {
          const { data, error } = await supabase
            .from("all_data")
            .select("composite_key, body_text")
            .in("composite_key", chunk);
          if (error) {
            setErrorMsg(errMessage(error));
            return;
          }
          for (const row of data || []) {
            if (row.body_text && row.composite_key) {
              map.set(row.composite_key, row.body_text);
              filledKeysRef.current.add(row.composite_key);
            }
          }
        }
        if (map.size > 0) {
          baseRows = withBodyTextFilled(baseRows, map);
        }
      }

      const sorted = [...baseRows].sort((a, b) => {
        const da = toDateNum(a.bulletin_date) || 0;
        const db = toDateNum(b.bulletin_date) || 0;
        return da - db;
      });

      const SEP = "\n--------------------------------\n";
      const content = sorted
        .map((r) => r.body_text || "")
        .filter(Boolean)
        .join(SEP);

      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const fn = `${filenameBase}_${startDate || "start"}_${endDate || "end"}.txt`;
      a.href = url;
      a.download = fn;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    doExport().catch((e) => setErrorMsg(errMessage(e)));
  }

  async function exportRowsToXlsxTable(baseRows: Row[], filenameBase: string) {
    try {
      const rowsSimple = baseRows.map((r) => ({
        id: r.id || null,
        company: r.company || "",
        ticker: normalizeTicker(r.ticker),
        composite_key: r.composite_key || "",
        bulletin_date: r.bulletin_date || "",
        type: r.canonical_type || r.bulletin_type || "",
        canonical_class: r.canonical_class || "",
        source_file: r.source_file || "",
      }));

      const { utils, writeFile } = await import("xlsx");
      const sheet = utils.json_to_sheet(rowsSimple);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, sheet, "data");
      const fn = `${filenameBase}_${startDate || "start"}_${endDate || "end"}.xlsx`;
      writeFile(wb, fn);
    } catch (e) {
      setErrorMsg(errMessage(e));
    }
  }

  const kpiBoletins = useMemo(() => {
    const dedup = dedupByCompanyRootType(rowsInWindow);
    let total = dedup.length;
    let cpc = 0;
    let cpcMixed = 0;
    let qtTotal = 0;
    let qtCompleted = 0;

    for (const r of dedup) {
      if (isCpc(r)) {
        if (isCpcMixed(r)) cpcMixed++;
        else cpc++;
      }
      if (isQtAny(r)) {
        qtTotal++;
        if (isQtCompleted(r)) qtCompleted++;
      }
    }

    const keyCount = new Map<string, number>();
    for (const r of rowsInWindow) {
      const key = `${r.company}|${normalizeTicker(r.ticker)}|${r.canonical_type || r.bulletin_type || ""}`;
      keyCount.set(key, (keyCount.get(key) || 0) + 1);
    }
    let dupGroups = 0;
    let dupExtra = 0;
    for (const [, count] of keyCount) {
      if (count > 1) {
        dupGroups++;
        dupExtra += count - 1;
      }
    }

    return {
      total,
      cpc,
      cpcMixed,
      qtTotal,
      qtCompleted,
      dupGroups,
      dupExtra,
    };
  }, [rowsInWindow]);

  const kpiEmpresas = useMemo(() => {
    const byCompany = new Map<string, Row[]>();
    for (const r of rowsInWindow) {
      if (!r.company) continue;
      const arr = byCompany.get(r.company) || [];
      arr.push(r);
      byCompany.set(r.company, arr);
    }
    const totalEmp = byCompany.size;

    let empresas1 = 0;
    let empresas1CpcUnico = 0;
    let empresas1CpcMixed = 0;
    let empresas2p = 0;
    let empresasComQtCompleted = 0;

    for (const [, arr] of byCompany) {
      if (arr.length === 1) {
        empresas1++;
        const r = arr[0];
        if (isCpc(r)) {
          if (isCpcMixed(r)) empresas1CpcMixed++;
          else empresas1CpcUnico++;
        }
      } else if (arr.length >= 2) {
        empresas2p++;
      }
      if (arr.some((r) => isQtCompleted(r))) {
        empresasComQtCompleted++;
      }
    }

    return {
      totalEmp,
      empresas1,
      empresas1CpcUnico,
      empresas1CpcMixed,
      empresas2p,
      empresasComQtCompleted,
    };
  }, [rowsInWindow]);

  const filteredChartData = useMemo(() => {
    const setCompany =
      selCompanies.length > 0
        ? new Set(selCompanies.map((o) => o.value))
        : null;
    const setTicker =
      selTickers.length > 0
        ? new Set(selTickers.map((o) => o.value))
        : null;

    return chartData.filter((d) => {
      if (setCompany && !setCompany.has(d.company)) return false;
      if (setTicker && !setTicker.has(d.ticker_root)) return false;
      return true;
    });
  }, [chartData, selCompanies, selTickers]);

  const filteredChartDataVis = useMemo(() => {
    const set = new Set(visibleTickers);
    return filteredChartData.filter((d) => set.has(d.ticker_root));
  }, [filteredChartData, visibleTickers]);

  const kpiDuplicados = useMemo(() => {
    const keyCount = new Map<string, number>();
    for (const r of rowsInWindow) {
      const key = `${r.company}|${normalizeTicker(r.ticker)}|${
        r.canonical_type || r.bulletin_type || ""
      }`;
      keyCount.set(key, (keyCount.get(key) || 0) + 1);
    }
    let grupos = 0;
    let boletinsDesnecessarios = 0;
    for (const [, count] of keyCount) {
      if (count > 1) {
        grupos++;
        boletinsDesnecessarios += count - 1;
      }
    }
    return { grupos, boletinsDesnecessarios };
  }, [rowsInWindow]);

  const visibleTickerSet = useMemo(
    () => new Set(visibleTickers),
    [visibleTickers],
  );

  const kpiVisible = useMemo(() => {
    let cpc = 0;
    let cpcMixed = 0;
    let qtCompleted = 0;
    for (const d of filteredChartData) {
      if (!visibleTickerSet.has(d.ticker_root)) continue;
      if (d.isCpc) {
        if (d.isCpcMixed) cpcMixed++;
        else cpc++;
      }
      if (d.isQtCompleted) qtCompleted++;
    }
    return { cpc, cpcMixed, qtCompleted };
  }, [filteredChartData, visibleTickerSet]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold mb-2">CPC — Notices</h1>

      {errorMsg && (
        <div className="bg-red-100 text-red-800 px-3 py-2 rounded">
          {errorMsg}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">
            Período (Start)
          </label>
          <input
            type="date"
            className="border rounded px-2 py-1"
            value={startDate ?? ""}
            onChange={(e) => setStartDate(e.target.value || null)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Período (End)
          </label>
          <input
            type="date"
            className="border rounded px-2 py-1"
            value={endDate ?? ""}
            onChange={(e) => setEndDate(e.target.value || null)}
          />
        </div>
        <div className="flex items-center gap-2 mt-6">
          <button
            type="button"
            className="border px-3 py-1 rounded"
            onClick={loadTimeline}
            disabled={loadingTimeline || loadingAnchors}
          >
            {loadingTimeline ? "Carregando..." : "⚡ Buscar timeline"}
          </button>
          <button
            type="button"
            className="border px-3 py-1 rounded"
            onClick={handleReset}
          >
            🧹 Reset
          </button>
        </div>
        <div className="flex items-center gap-2 mt-6">
          <label className="inline-flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={autoPeriod}
              onChange={(e) => setAutoPeriod(e.target.checked)}
            />
            Auto-período
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="min-w-[240px]">
          <label className="block text-sm font-medium mb-1">Company</label>
          <Select
            isMulti
            options={companyOpts}
            value={selCompanies}
            onChange={(vals: MultiValue<Option>) =>
              setSelCompanies(vals as Option[])
            }
            placeholder="Filtrar por company"
          />
        </div>
        <div className="min-w-[240px]">
          <label className="block text-sm font-medium mb-1">Ticker</label>
          <Select
            isMulti
            options={tickerOpts}
            value={selTickers}
            onChange={(vals: MultiValue<Option>) =>
              setSelTickers(vals as Option[])
            }
            placeholder="Filtrar por ticker"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="border rounded p-3 flex-1 min-w-[220px]">
          <div className="text-xs font-semibold text-gray-600 mb-1">
            Boletins (únicos por company+ticker+tipo)
          </div>
          <div className="text-lg">
            Total:{" "}
            <span className="font-bold">{kpiBoletins.total}</span>
          </div>
          <div className="text-sm mt-1">
            CPC (único):{" "}
            <span className="font-semibold">{kpiBoletins.cpc}</span>
          </div>
          <div className="text-sm">
            CPC (mixed):{" "}
            <span className="font-semibold">{kpiBoletins.cpcMixed}</span>
          </div>
          <div className="text-sm mt-1">
            QT total:{" "}
            <span className="font-semibold">{kpiBoletins.qtTotal}</span>
          </div>
          <div className="text-sm">
            QT completed:{" "}
            <span className="font-semibold">
              {kpiBoletins.qtCompleted}
            </span>
          </div>
          <div className="text-sm mt-1">
            Grupos duplicados:{" "}
            <span className="font-semibold">
              {kpiBoletins.dupGroups}
            </span>
          </div>
          <div className="text-sm">
            Boletins redundantes:{" "}
            <span className="font-semibold">
              {kpiBoletins.dupExtra}
            </span>
          </div>
        </div>

        <div className="border rounded p-3 flex-1 min-w-[220px]">
          <div className="text-xs font-semibold text-gray-600 mb-1">
            Empresas
          </div>
          <div className="text-lg">
            Total empresas:{" "}
            <span className="font-bold">{kpiEmpresas.totalEmp}</span>
          </div>
          <div className="text-sm mt-1">
            Empresas com 1 boletim:{" "}
            <span className="font-semibold">{kpiEmpresas.empresas1}</span>
          </div>
          <div className="text-sm ml-3">
            &bull; 1 boletim CPC único:{" "}
            <span className="font-semibold">
              {kpiEmpresas.empresas1CpcUnico}
            </span>
          </div>
          <div className="text-sm ml-3">
            &bull; 1 boletim CPC mixed:{" "}
            <span className="font-semibold">
              {kpiEmpresas.empresas1CpcMixed}
            </span>
          </div>
          <div className="text-sm mt-1">
            Empresas com 2+ boletins:{" "}
            <span className="font-semibold">
              {kpiEmpresas.empresas2p}
            </span>
          </div>
          <div className="text-sm mt-1">
            Empresas com QT completed:{" "}
            <span className="font-semibold">
              {kpiEmpresas.empresasComQtCompleted}
            </span>
          </div>
        </div>

        <div className="border rounded p-3 flex-1 min-w-[220px]">
          <div className="text-xs font-semibold text-gray-600 mb-1">
            Duplicidade (janela)
          </div>
          <div className="text-lg">
            Grupos duplicados:{" "}
            <span className="font-bold">
              {kpiDuplicados.grupos}
            </span>
          </div>
          <div className="text-sm mt-1">
            Boletins redundantes:{" "}
            <span className="font-semibold">
              {kpiDuplicados.boletinsDesnecessarios}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <label className="inline-flex items-center text-sm gap-1">
          <input
            type="checkbox"
            checked={onlySingle}
            onChange={(e) => setOnlySingle(e.target.checked)}
          />
          Somente empresas com 1 boletim
        </label>
        <label className="inline-flex items-center text-sm gap-1">
          <input
            type="checkbox"
            checked={onlyMulti}
            onChange={(e) => setOnlyMulti(e.target.checked)}
          />
          Somente empresas com 2+ boletins
        </label>
        <label className="inline-flex items-center text-sm gap-1">
          <input
            type="checkbox"
            checked={onlyFirst}
            onChange={(e) => setOnlyFirst(e.target.checked)}
          />
          Somente 1º boletim por ticker
        </label>
        <label className="inline-flex items-center text-sm gap-1">
          <input
            type="checkbox"
            checked={onlyLast}
            onChange={(e) => setOnlyLast(e.target.checked)}
          />
          Somente último boletim por ticker
        </label>
        <label className="inline-flex items-center text-sm gap-1">
          <input
            type="checkbox"
            checked={showDuplicatesOnly}
            onChange={(e) => setShowDuplicatesOnly(e.target.checked)}
          />
          Mostrar apenas grupos duplicados
        </label>
        <label className="inline-flex items-center text-sm gap-1">
          <input
            type="checkbox"
            checked={removeDupByType}
            onChange={(e) => setRemoveDupByType(e.target.checked)}
          />
          Remover duplicados por company+ticker+tipo (mantém 1)
        </label>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <label className="inline-flex items-center text-sm gap-1">
          <input
            type="checkbox"
            checked={flagNewCpc}
            onChange={(e) => setFlagNewCpc(e.target.checked)}
          />
          Somente New CPC (por corpo/tipo)
        </label>
        <label className="inline-flex items-center text-sm gap-1">
          <input
            type="checkbox"
            checked={flagCpcMixed}
            onChange={(e) => setFlagCpcMixed(e.target.checked)}
          />
          Somente CPC mixed
        </label>
        <label className="inline-flex items-center text-sm gap-1">
          <input
            type="checkbox"
            checked={flagQtCompleted}
            onChange={(e) => setFlagQtCompleted(e.target.checked)}
          />
          Somente QT Completed
        </label>
        <label className="inline-flex items-center text-sm gap-1">
          <input
            type="checkbox"
            checked={showTickerAxis}
            onChange={(e) => setShowTickerAxis(e.target.checked)}
          />
          Mostrar eixo Y (tickers)
        </label>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <button
          type="button"
          className="border px-3 py-1 rounded text-sm"
          onClick={() => setShowChart((v) => !v)}
        >
          {showChart ? "Esconder gráfico" : "Mostrar gráfico"}
        </button>
        <button
          type="button"
          className="border px-3 py-1 rounded text-sm"
          onClick={() => setShowStats((v) => !v)}
        >
          {showStats ? "Esconder KPIs" : "Mostrar KPIs"}
        </button>
        <button
          type="button"
          className="border px-3 py-1 rounded text-sm"
          onClick={() => setShowTable((v) => !v)}
        >
          {showTable ? "Esconder tabela" : "Mostrar tabela"}
        </button>
        <button
          type="button"
          className="border px-3 py-1 rounded text-sm"
          onClick={() => setTableLimit((v) => v + PAGE)}
        >
          Carregar +{PAGE} linhas
        </button>
        <button
          type="button"
          className="border px-3 py-1 rounded text-sm"
          onClick={() => setTableLimit(100000)}
        >
          Ver todas
        </button>

        <button
          type="button"
          className="border px-3 py-1 rounded text-sm"
          onClick={() => exportRowsToTxt(tableRowsBase, "cpc_selection")}
        >
          Exportar seleção (TXT)
        </button>
        <button
          type="button"
          className="border px-3 py-1 rounded text-sm"
          onClick={() => exportRowsToTxt(rowsInWindow, "cpc_period")}
        >
          Exportar período (TXT)
        </button>
        <button
          type="button"
          className="border px-3 py-1 rounded text-sm"
          onClick={() => exportRowsToXlsxTable(tableRowsBase, "cpc_selection")}
        >
          Exportar seleção (XLSX)
        </button>
      </div>

      {showChart && xDomain && (
        <div className="border rounded p-3">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-semibold">Timeline por ticker</div>
            <div className="flex items-center gap-2 text-xs">
              <span>
                Linhas Y: {visibleTickers.length}/{tickerOrder.length}
              </span>
              <button
                type="button"
                className="border px-2 py-0.5 rounded"
                onClick={() =>
                  setYLimit((v) => Math.max(5, Math.min(v - 10, tickerOrder.length)))
                }
              >
                -10
              </button>
              <button
                type="button"
                className="border px-2 py-0.5 rounded"
                onClick={() =>
                  setYLimit((v) => Math.max(5, Math.min(v + 10, tickerOrder.length)))
                }
              >
                +10
              </button>
              <button
                type="button"
                className="border px-2 py-0.5 rounded"
                onClick={() => setYLimit(tickerOrder.length)}
              >
                Todos
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-600 mb-2">
            Clique em um ponto para filtrar por empresa. Shift+Clique para
            filtrar por composite_key.
          </div>
          <div style={{ width: "100%", height: chartHeight }}>
            <ResponsiveContainer>
              <ScatterChart
                margin={{ top: 20, right: 20, bottom: 20, left: 40 }}
              >
                <CartesianGrid />
                <XAxis
                  type="number"
                  dataKey="dateNum"
                  domain={xDomain}
                  ticks={xTicksMemo}
                  tickFormatter={xTickFormatter}
                />
                {showTickerAxis && (
                  <YAxis
                    type="category"
                    dataKey="ticker_root"
                    tickFormatter={(tick) => {
                      const count = tickerCountMap.get(tick) || 0;
                      return `${tick} (${count})`;
                    }}
                    width={120}
                  />
                )}
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  formatter={(value: any, name: string, props: any) => {
                    if (name === "dateNum") {
                      return [fmtUTC(value), "Date"];
                    }
                    if (name === "ticker_root") {
                      return [value, "Ticker"];
                    }
                    return [value, name];
                  }}
                  labelFormatter={() => ""}
                />
                <Scatter
                  data={filteredChartDataVis}
                  onClick={onPointClick}
                  shape="circle"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {showTable && (
        <div className="border rounded p-3">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-semibold">Tabela de boletins</div>
            <div className="text-xs text-gray-600">
              Mostrando {tableRowsPage.length} de {tableRows.length} linhas.
            </div>
          </div>

          <div className="overflow-auto max-h-[600px] border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b sticky top-0 z-10">
                <tr className="text-left align-top">
                  <th
                    className="p-2"
                    aria-sort={
                      sortKey === "company"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      className="font-semibold cursor-pointer select-none"
                      onClick={() => toggleSort("company")}
                    >
                      Company {sortIndicator("company")}
                    </button>
                    <input
                      className="mt-1 w-full border rounded px-2 py-1 text-sm"
                      placeholder="Filtrar"
                      value={fCompany}
                      onChange={(e) => setFCompany(e.target.value)}
                    />
                  </th>
                  <th
                    className="p-2"
                    aria-sort={
                      sortKey === "ticker"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      className="font-semibold cursor-pointer select-none"
                      onClick={() => toggleSort("ticker")}
                    >
                      Ticker {sortIndicator("ticker")}
                    </button>
                    <input
                      className="mt-1 w-full border rounded px-2 py-1 text-sm"
                      placeholder="Filtrar"
                      value={fTicker}
                      onChange={(e) => setFTicker(e.target.value)}
                    />
                  </th>
                  <th className="p-2">
                    Composite Key
                    <input
                      className="mt-1 w-full border rounded px-2 py-1 text-sm"
                      placeholder="Filtrar"
                      value={fKey}
                      onChange={(e) => setFKey(e.target.value)}
                    />
                  </th>
                  <th
                    className="p-2"
                    aria-sort={
                      sortKey === "date"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      className="font-semibold cursor-pointer select-none"
                      onClick={() => toggleSort("date")}
                    >
                      Date {sortIndicator("date")}
                    </button>
                    <input
                      className="mt-1 w-full border rounded px-2 py-1 text-sm"
                      placeholder="Filtrar"
                      value={fDate}
                      onChange={(e) => setFDate(e.target.value)}
                    />
                  </th>
                  <th
                    className="p-2"
                    aria-sort={
                      sortKey === "type"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      className="font-semibold cursor-pointer select-none"
                      onClick={() => toggleSort("type")}
                    >
                      Tipo {sortIndicator("type")}
                    </button>
                    <input
                      className="mt-1 w-full border rounded px-2 py-1 text-sm"
                      placeholder="Filtrar"
                      value={fType}
                      onChange={(e) => setFType(e.target.value)}
                    />
                  </th>
                  <th className="p-2 text-left">Parser</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Parsed em</th>
                </tr>
              </thead>
              <tbody>
                {tableRowsPage.map((row, i) => (
                  <tr
                    key={row.id}
                    className="border-b hover:bg-gray-50"
                    ref={i === 0 ? firstRowRef : undefined}
                  >
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
                          {row.composite_key}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-2">{row.bulletin_date}</td>
                    <td className="p-2">
                      {row.canonical_type ?? row.bulletin_type ?? "—"}
                    </td>
                    <td className="p-2">
                      {isCpc(row) && row.canonical_class === "Unico" ? (
                        <div className="flex gap-2 items-center">
                          <select
                            className="border px-1 py-0.5 text-xs"
                            value={suggestedParserProfile(row) ?? ""}
                            disabled={parserLoadingId === row.id}
                            onChange={(e) => {
                              const value = e.target.value || null;
                              setParserForRow(row, value);
                            }}
                          >
                            <option value="">—</option>
                            {PARSER_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            className="border px-2 py-0.5 text-xs"
                            disabled={
                              !row.parser_profile || parserLoadingId === row.id
                            }
                            onClick={() => activateParserForRow(row)}
                          >
                            {parserLoadingId === row.id
                              ? "Salvando..."
                              : "Ativar"}
                          </button>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-2 text-xs">
                      {parserStatusLabel(row)}
                    </td>
                    <td className="p-2 text-xs">
                      {row.parser_parsed_at
                        ? row.parser_parsed_at.slice(0, 10)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedBulletin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center px-4 py-2 border-b">
              <div className="font-semibold text-sm">
                {selectedBulletin.company} — {selectedBulletin.ticker} —{" "}
                {selectedBulletin.bulletin_date}
              </div>
              <button
                type="button"
                className="text-sm px-2 py-1 border rounded"
                onClick={closeBulletinModal}
              >
                Fechar
              </button>
            </div>
            <div className="p-4 overflow-auto text-xs whitespace-pre-wrap font-mono">
              {selectedBulletin.body_text || "Sem body_text disponível."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
