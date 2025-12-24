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
  type_display: string;
  dateISO: string;
  composite_key?: string;
};

type Opt = { value: string; label: string };

const CPC_CANONICAL = "NEW LISTING-CPC-SHARES";
const QT_COMPLETED = "QUALIFYING TRANSACTION-COMPLETED";
const QT_ANY = "QUALIFYING TRANSACTION";

type SortKey =
  | "company"
  | "ticker"
  | "composite_key"
  | "bulletin_date"
  | "canonical_type";
type SortDir = "asc" | "desc";

const PARSER_OPTIONS = [
  "cpc_birth",
  "events_halt_v1",
  "events_resume_trading_v1",
  "cpc_filing_statement_v1",
] as const;

// ---------- helpers ----------
const DAY = 24 * 60 * 60 * 1000;
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
function normalizeTicker(t?: string | null) {
  return (t ?? "").trim().toUpperCase().split(".")[0];
}

// Remove duplicatas por Empresa × TickerRoot × Tipo (mantém a mais antiga por data)
function dedupByCompanyRootType(rows: Row[]): Row[] {
  const best = new Map<string, Row>();
  for (const r of rows) {
    const company = (r.company ?? "").trim();
    const root = normalizeTicker((r.ticker ?? "").trim().toUpperCase());
    const tipo = ((r.canonical_type ?? r.bulletin_type) ?? "").trim();
    if (!company || !root || !tipo) {
      const k = `__loose__|${r.id ?? Math.random()}`;
      best.set(k, r);
      continue;
    }
    const k = `${company}|${root}|${tipo}`;
    const prev = best.get(k);
    if (!prev) best.set(k, r);
    else {
      const dPrev = toDateNum(prev.bulletin_date);
      const dThis = toDateNum(r.bulletin_date);
      if (dThis < dPrev) best.set(k, r);
    }
  }
  return Array.from(best.values());
}
function withBodyTextFilled(rows: Row[], map: Map<string, string>) {
  return rows.map((r) => {
    if (r.body_text || !r.composite_key) return r;
    return { ...r, body_text: map.get(r.composite_key) ?? r.body_text ?? "" };
  });
}
function keyCT(company?: string | null, ticker?: string | null) {
  return `${(company ?? "").trim()}|${normalizeTicker(ticker)}`;
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
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max)
    return { ticks: [] as number[], formatter: (v: number) => fmtDayMonth(v) };
  const span = max - min;
  const fYear = new Intl.DateTimeFormat("pt-BR", {
    year: "numeric",
    timeZone: "UTC",
  });
  const fMonY = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const fMon = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "UTC",
  });
  const fDayMon = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
  if (span >= 3 * 365 * DAY) {
    let t = startOfMonthUTC(min);
    const ticks: number[] = [];
    while (t <= max) {
      ticks.push(t);
      t = addMonthsUTC(t, 12);
    }
    return { ticks, formatter: (v: number) => fYear.format(v) };
  }
  if (span >= 12 * 30 * DAY) {
    let t = startOfQuarterUTC(min);
    const ticks: number[] = [];
    while (t <= max) {
      ticks.push(t);
      t = addMonthsUTC(t, 3);
    }
    return { ticks, formatter: (v: number) => fMonY.format(v) };
  }
  if (span >= 3 * 30 * DAY) {
    let t = startOfMonthUTC(min);
    const ticks: number[] = [];
    while (t <= max) {
      ticks.push(t);
      t = addMonthsUTC(t, 1);
    }
    return { ticks, formatter: (v: number) => fMon.format(v) };
  }
  {
    let t = startOfDayUTC(min);
    const ticks: number[] = [];
    while (t <= max) {
      ticks.push(t);
      t = addDaysUTC(t, 15);
    }
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

// CPC / QT helpers
function isCpc(row: Row): boolean {
  const canon = (row.canonical_type ?? row.bulletin_type ?? "").toUpperCase();
  return canon.includes(CPC_CANONICAL);
}
function isCpcMixed(row: Row): boolean {
  const bt = (row.bulletin_type ?? "").toString();
  const canon = (row.canonical_type ?? row.bulletin_type ?? "").toString();
  const mixedFlag =
    typeof (row as unknown as { _mixed?: boolean })._mixed === "boolean"
      ? (row as unknown as { _mixed?: boolean })._mixed
      : false;
  const byClass = (row.canonical_class ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .startsWith("mist");
  return mixedFlag || byClass || bt.includes(",") || canon.includes(",");
}

function isQtAny(row: Row): boolean {
  const t = (row.canonical_type ?? row.bulletin_type ?? "").toUpperCase();
  return t.includes(QT_ANY);
}
function isQtCompleted(row: Row): boolean {
  const t = (row.canonical_type ?? row.bulletin_type ?? "").toUpperCase();
  return t.includes(QT_COMPLETED);
}

// Novo: detecção de CPC pelo corpo do texto (várias variantes)
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

  const t = (row.canonical_type ?? row.bulletin_type ?? "").toUpperCase();
  const klass = (row.canonical_class ?? "").toUpperCase();

  // CPC Birth (apenas Unico)
  if (t.includes("NEW LISTING-CPC-SHARES") && klass === "UNICO") {
    return "cpc_birth";
  }

  // Eventos (por tipo do boletim)
  if (t === "HALT") return "events_halt_v1";
  if (t === "RESUME TRADING") return "events_resume_trading_v1";

  return null;
}

function routeForParser(parser: string) {
  if (parser === "events_halt_v1") return "/api/cpc_events_halt";
  if (parser === "events_resume_trading_v1") return "/api/cpc_events_resume_trading";
  return "/api/cpc_birth_unico";
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

// =========================================================

export default function Page() {
  const [loadingAnchors, setLoadingAnchors] = useState(false);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([]);

  const [watchKeys, setWatchKeys] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [selCompanies, setSelCompanies] = useState<Opt[]>([]);
  const [selTickers, setSelTickers] = useState<Opt[]>([]);

  // FLAGS (Scatter + Tabela)
  const [onlyMulti, setOnlyMulti] = useState(false);
  const [onlySingle, setOnlySingle] = useState(false);
  const [onlyFirst, setOnlyFirst] = useState(false);
  const [onlyLast, setOnlyLast] = useState(false);
  const [showTickerAxis, setShowTickerAxis] = useState(true);

  // CPC
  const [flagNewCpc, setFlagNewCpc] = useState(false);
  const [flagCpcMixed, setFlagCpcMixed] = useState(false);
  // QT Completed
  const [flagQtCompleted, setFlagQtCompleted] = useState(false);
  // Remover duplicatas por Tipo
  const [removeDupByType, setRemoveDupByType] = useState<boolean>(false);
  // Ver apenas duplicados por Empresa×TickerRoot×Tipo
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState<boolean>(false);

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

  const [parserLoadingId, setParserLoadingId] = useState<number | null>(null);

  async function setParserForRow(row: Row, parser_profile: string) {
  setRows(prev =>
    prev.map(r =>
      r.composite_key === row.composite_key
        ? { ...r, parser_profile }
        : r,
    ),
  );
}


  async function activateParserForRow(row: Row) {
    if (!row.id) return;

    if (!row.composite_key) {
      setErrorMsg("Linha sem composite_key — não dá para disparar o parser.");
      return;
    }

    const parser = row.parser_profile ?? suggestedParserProfile(row);
    if (!parser) {
      setErrorMsg("Selecione um parser antes de ativar.");
      return;
    }

    // marca na all_data o parser e deixa em ready
    await setParserForRow(row, parser);

    try {
      setParserLoadingId(row.id);

      const res = await fetch(routeForParser(parser), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          composite_key: row.composite_key,
          parser_profile: parser,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(
          txt || `Erro ao disparar workflow (status ${res.status})`,
        );
      }

      // Otimista: marca como ready e inicia polling
      setRows((prev) =>
        prev.map((r) =>
          r.composite_key === row.composite_key
            ? {
                ...r,
                parser_profile: parser,
                parser_status: "ready",
                parser_parsed_at: null,
              }
            : r,
        ),
      );
      setWatchKeys((prev) => {
        const next = new Set(prev);
        next.add(row.composite_key!);
        return next;
      });
    } catch (e) {
      setErrorMsg(errMessage(e));
    } finally {
      setParserLoadingId(null);
    }
  }
useEffect(() => {
  if (watchKeys.size === 0) return;

  let cancelled = false;

  const tick = async () => {
    const keys = Array.from(watchKeys);
    if (keys.length === 0) return;

    const { data, error } = await supabase
      .from("all_data")
      .select("composite_key, parser_profile, parser_status, parser_parsed_at")
      .in("composite_key", keys);

    if (cancelled) return;
    if (error || !data) return;

    setRows(prev =>
      prev.map(r => {
        const u = data.find(d => d.composite_key === r.composite_key);
        return u
          ? {
              ...r,
              parser_profile: u.parser_profile ?? r.parser_profile,
              parser_status: u.parser_status ?? r.parser_status,
              parser_parsed_at: u.parser_parsed_at ?? r.parser_parsed_at,
            }
          : r;
      }),
    );

    setWatchKeys(prev => {
      const next = new Set(prev);
      for (const u of data) {
        if (
          u?.composite_key &&
          (u.parser_status === "done" || u.parser_status === "error")
        ) {
          next.delete(u.composite_key);
        }
      }
      return next;
    });
  };

  tick();
  const id = setInterval(tick, 4000);

  return () => {
    cancelled = true;
    clearInterval(id);
  };
}, [watchKeys]);



// Âncoras (1º CPC por (company|ticker_root))
  const [anchors, setAnchors] = useState<Map<string, string>>(new Map());
  const [anchorCompanies, setAnchorCompanies] = useState<string[]>([]);

  // Auto-período
  const [autoPeriod, setAutoPeriod] = useState(true);

  // Pré-busca: mapa de âncoras
  useEffect(() => {
    (async () => {
      setLoadingAnchors(true);
      setErrorMsg(null);
      try {
        const { data, error } = await supabase
          .from("vw_bulletins_with_canonical")
          .select(
            "company, ticker, bulletin_date, canonical_type, bulletin_type, canonical_class",
          )
          .ilike("canonical_type", `%${CPC_CANONICAL}%`);
        if (error) throw error;

        const map = new Map<string, string>();
        const companies = new Set<string>();
        for (const r of (data || []) as Row[]) {
          const key = keyCT(r.company, r.ticker);
          const d = r.bulletin_date || "";
          if (!d) continue;
          if (!isCpc(r)) continue;
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

  // Auto-período (min→max)
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
        const minDate =
          ((data as { bulletin_date: string }[] | null)?.[0]?.bulletin_date) ||
          "";
        const { data: dataMax, error: error2 } = await supabase
          .from("vw_bulletins_with_canonical")
          .select("bulletin_date")
          .order("bulletin_date", { ascending: false })
          .limit(1);
        if (error2) throw error2;
        const maxDate =
          ((dataMax as { bulletin_date: string }[] | null)?.[0]?.bulletin_date) ||
          "";
        if (minDate && (!startDate || autoPeriod)) setStartDate(minDate);
        if (maxDate && (!endDate || autoPeriod)) setEndDate(maxDate);
      } catch (e) {
        console.warn("autoPeriod preset failed:", e);
      }
    })();
  }, [autoPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  // sanity datas
  useEffect(() => {
    if (startDate && endDate && startDate > endDate) setEndDate(startDate);
  }, [startDate, endDate]);

  // URL
  useEffect(() => {
    const p = new URLSearchParams();
    if (startDate) p.set("s", startDate);
    if (endDate) p.set("e", endDate);
    if (selTickers.length)
      p.set(
        "t",
        selTickers.map((o) => o.value).join(","),
      );
    if (selCompanies.length)
      p.set(
        "c",
        selCompanies.map((o) => o.value).join(","),
      );
    const qs = p.toString();
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }, [startDate, endDate, selTickers, selCompanies]);

  // Janela básica
  const rowsInWindow = useMemo(() => {
    return rows.filter((r) => {
      if (!r.bulletin_date) return false;
      if (startDate && r.bulletin_date < startDate) return false;
      if (endDate && r.bulletin_date > endDate) return false;
      return true;
    });
  }, [rows, startDate, endDate]);

  // ===== Após carregar rows, preencher body_text ausente (para CPC body matching) =====
  const filledKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    (async () => {
      const missingKeys = Array.from(
        new Set(
          rows
            .filter((r) => !r.body_text && r.composite_key)
            .map((r) => r.composite_key as string),
        ),
      ).filter((k) => !filledKeysRef.current.has(k));

      if (!missingKeys.length) return;
      // buscar em lotes de 300
      const chunk = (arr: string[], size: number) => {
        const out: string[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      try {
        for (const batch of chunk(missingKeys, 300)) {
          const { data, error } = await supabase
            .from("vw_bulletins_with_canonical")
            .select("composite_key, body_text")
            .in("composite_key", batch);
          if (error) throw error;
          const map = new Map<string, string>();
          for (const r of (data || []) as {
            composite_key: string | null;
            body_text: string | null;
          }[]) {
            if (r.composite_key) map.set(r.composite_key, r.body_text ?? "");
          }
          setRows((prev) => withBodyTextFilled(prev, map));
          batch.forEach((k) => filledKeysRef.current.add(k));
        }
      } catch (e) {
        console.warn("Falha ao preencher body_text:", e);
      }
    })();
  }, [rows]);

  // ===== BASE GLOBAL (KPIs) com de-dup por company|ticker_root =====
  const kpiRows = useMemo(() => {
    const seen = new Set<string>();
    const out: Row[] = [];
    for (const r of rowsInWindow) {
      const root = normalizeTicker(r.ticker);
      const key = `${(r.company ?? "").trim()}|${root}|${
        (r.bulletin_date ?? "").slice(0, 10)
      }|${(r.canonical_type ?? r.bulletin_type ?? "").trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out;
  }, [rowsInWindow]);

  // Selects
  const companyOpts = useMemo<Opt[]>(() => {
    const s = new Set<string>();
    for (const r of rowsInWindow) if (r.company) s.add(r.company);
    return Array.from(s)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [rowsInWindow]);
  const tickerOpts = useMemo<Opt[]>(() => {
    const roots = new Map<string, Set<string>>();
    for (const r of rowsInWindow) {
      const root = normalizeTicker(r.ticker);
      if (!root) continue;
      if (!roots.has(root)) roots.set(root, new Set());
      roots.get(root)!.add(r.ticker ?? "");
    }
    return Array.from(roots.keys())
      .sort()
      .map((root) => ({ value: root, label: root }));
  }, [rowsInWindow]);
  useEffect(() => {
    const validCompanies = new Set(companyOpts.map((o) => o.value));
    const validTickers = new Set(tickerOpts.map((o) => o.value));
    setSelCompanies((prev) => prev.filter((o) => validCompanies.has(o.value)));
    setSelTickers((prev) => prev.filter((o) => validTickers.has(o.value)));
  }, [companyOpts, tickerOpts]);

  // -------- KPIs Globais --------

  const kpiBoletins = useMemo(() => {
    const total = kpiRows.length;
    let unico = 0,
      misto = 0,
      cpcPad = 0,
      cpcMix = 0,
      outros = 0,
      qtAny = 0,
      qtCompleted = 0;
    for (const r of kpiRows) {
      const cln = (r.canonical_class ?? "").toLowerCase();
      const isMixed = cln.startsWith("mist") || isCpcMixed(r);
      const isCpcNotice = isCpc(r);
      if (!isMixed) unico++;
      else misto++;
      if (isCpcNotice) {
        if (isMixed) cpcMix++;
        else cpcPad++;
      }
      if (!isCpcNotice) outros++;
      if (isQtAny(r)) {
        qtAny++;
        if (isQtCompleted(r)) qtCompleted++;
      }
    }
    const cpcUnifiedTotal = cpcPad + cpcMix;
    const qtOther = qtAny - qtCompleted;
    return {
      total,
      unico,
      misto,
      cpcPad,
      cpcMix,
      cpcUnifiedTotal,
      outros,
      qtAny,
      qtCompleted,
      qtOther,
    };
  }, [kpiRows]);

  const kpiDuplicados = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rowsInWindow) {
      const company = (r.company ?? "").trim();
      const root = normalizeTicker((r.ticker ?? "").trim().toUpperCase());
      const tipo = ((r.canonical_type ?? r.bulletin_type) ?? "").trim();
      if (!company || !root || !tipo) continue;
      const k = `${company}|${root}|${tipo}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    let groups = 0;
    let dupEvents = 0;
    for (const c of counts.values()) {
      if (c >= 2) {
        groups++;
        dupEvents += c - 1;
      }
    }
    return { groups, dupEvents };
  }, [rowsInWindow]);



  const kpiEmpresas = useMemo(() => {
    // map empresa -> rows
    const perCompanyRows = new Map<string, Row[]>();
    for (const r of kpiRows) {
      const c = (r.company ?? "").trim();
      if (!c) continue;
      const arr = perCompanyRows.get(c) || [];
      arr.push(r);
      perCompanyRows.set(c, arr);
    }
    const total = perCompanyRows.size;
    let eq1 = 0,
      ge2 = 0,
      eq1_unico = 0,
      eq1_misto = 0;
    const qtCompanies = new Set<string>();

    for (const [company, arr] of perCompanyRows) {
      if (arr.length === 1) {
        eq1++;
        const only = arr[0];
        if (isCpcMixed(only)) eq1_misto++;
        else eq1_unico++;
      } else if (arr.length >= 2) {
        ge2++;
      }
      for (const r of arr) if (isQtCompleted(r)) qtCompanies.add(company);
    }
    return { total, eq1, ge2, qtCompletedCompanies: qtCompanies.size, eq1_unico, eq1_misto };
  }, [kpiRows]);

  // -------- Tabela base (com flags espelhadas) --------
  const rowsInWindowFiltered = useMemo(() => {
    // Base por período + Company/Ticker
    const cset = new Set(selCompanies.map((o) => o.value));
    const tset = new Set(selTickers.map((o) => o.value));
    let data = rowsInWindow.filter((r) => {
      const tRoot = normalizeTicker(r.ticker);
      if (cset.size && (!r.company || !cset.has(r.company))) return false;
      if (tset.size && (!tRoot || !tset.has(tRoot))) return false;
      return true;
    });

    // Ver apenas grupos duplicados por Empresa×TickerRoot×Tipo
    if (showDuplicatesOnly) {
      const counts = new Map<string, number>();
      for (const r of data) {
        const company = (r.company ?? "").trim();
        const root = normalizeTicker((r.ticker ?? "").trim().toUpperCase());
        const tipo = ((r.canonical_type ?? r.bulletin_type) ?? "").trim();
        if (!company || !root || !tipo) continue;
        const k = `${company}|${root}|${tipo}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      data = data.filter((r) => {
        const company = (r.company ?? "").trim();
        const root = normalizeTicker((r.ticker ?? "").trim().toUpperCase());
        const tipo = ((r.canonical_type ?? r.bulletin_type) ?? "").trim();
        if (!company || !root || !tipo) return false;
        const k = `${company}|${root}|${tipo}`;
        return (counts.get(k) ?? 0) >= 2;
      });
    }

    // flags (=1, >=2, first/last)
    const flagsActive = onlyMulti || onlySingle || onlyFirst || onlyLast;
    if (flagsActive) {
      const counts = new Map<string, number>();
      for (const r of data) {
        const root = normalizeTicker(r.ticker);
        if (!root) continue;
        counts.set(root, (counts.get(root) ?? 0) + 1);
      }
      if (onlySingle)
        data = data.filter((r) => counts.get(normalizeTicker(r.ticker)) === 1);
      if (onlyMulti)
        data = data.filter(
          (r) => (counts.get(normalizeTicker(r.ticker)) ?? 0) >= 2,
        );
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
          arr.sort(
            (a, b) => toDateNum(a.bulletin_date) - toDateNum(b.bulletin_date),
          );
          if (onlyFirst) picked.push(arr[0]);
          if (onlyLast) picked.push(arr[arr.length - 1]);
        }
        data = picked;
      }
    }

    // CPC flags (New CPC / CPC Mixed)
    if (flagNewCpc || flagCpcMixed) {
      // Filtra SOMENTE boletins cujo corpo indica "New Listing - CPC - Shares"
      // (isCpcByBody). Depois separa em padrão vs. mixed.
      data = data.filter((r) => {
        const pub = (r.ticker ?? "").trim().toUpperCase();
        if (!pub.endsWith(".P")) return false;
        if (!isCpcByBody(r)) return false;
        const mixed = isCpcMixed(r);
        const pad = !mixed;
        return (flagNewCpc && pad) || (flagCpcMixed && mixed);
      });
    }
    // QT Completed flag
    if (flagQtCompleted) {
      data = data.filter(isQtCompleted);
    }

    
    // Remover duplicatas por tipo (opcional)
    if (removeDupByType) {
      data = dedupByCompanyRootType(data);
    }
return data;
  }, [
    rowsInWindow,
    selCompanies,
    selTickers,
    onlySingle,
    onlyMulti,
    onlyFirst,
    onlyLast,
    flagNewCpc,
    flagCpcMixed,
    flagQtCompleted,
    removeDupByType,
    showDuplicatesOnly,
  ]);

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
    return rowsInWindowFiltered.filter((r) => {
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
  }, [rowsInWindowFiltered, tC, tT, tK, tD, tY]);

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
    sortKey === k ? (
      <span className="ml-1 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>
    ) : null;

  const tableRows = useMemo(() => {
    const getVal = (r: Row, k: SortKey) =>
      k === "bulletin_date"
        ? toDateNum(r.bulletin_date)
        : k === "company"
        ? (r.company ?? "").toLowerCase()
        : k === "ticker"
        ? (r.ticker ?? "").toLowerCase()
        : k === "canonical_type"
        ? (r.canonical_type ?? r.bulletin_type ?? "").toLowerCase()
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

  const tableRowsPage = useMemo(
    () => tableRows.slice(0, tableLimit),
    [tableRows, tableLimit],
  );
  useEffect(() => {
    setTableLimit(PAGE);
  }, [tableRowsBase.length, tC, tT, tK, tD, tY]);

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

    // Ver apenas grupos duplicados por Empresa×TickerRoot×Tipo
    if (showDuplicatesOnly) {
      const countsDup = new Map<string, number>();
      for (const r of data) {
        const company = (r.company ?? "").trim();
        const root = normalizeTicker((r.ticker ?? "").trim().toUpperCase());
        const tipo = ((r.canonical_type ?? r.bulletin_type) ?? "").trim();
        if (!company || !root || !tipo) continue;
        const k = `${company}|${root}|${tipo}`;
        countsDup.set(k, (countsDup.get(k) ?? 0) + 1);
      }
      data = data.filter((r) => {
        const company = (r.company ?? "").trim();
        const root = normalizeTicker((r.ticker ?? "").trim().toUpperCase());
        const tipo = ((r.canonical_type ?? r.bulletin_type) ?? "").trim();
        if (!company || !root || !tipo) return false;
        const k = `${company}|${root}|${tipo}`;
        return (countsDup.get(k) ?? 0) >= 2;
      });
    }

    const counts = new Map<string, number>();
    for (const r of data) {
      const root = normalizeTicker(r.ticker);
      if (!root) continue;
      counts.set(root, (counts.get(root) ?? 0) + 1);
    }
    if (onlySingle)
      data = data.filter((r) => counts.get(normalizeTicker(r.ticker)) === 1);
    if (onlyMulti)
      data = data.filter(
        (r) => (counts.get(normalizeTicker(r.ticker)) ?? 0) >= 2,
      );
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
        arr.sort(
          (a, b) => toDateNum(a.bulletin_date) - toDateNum(b.bulletin_date),
        );
        if (onlyFirst) picked.push(arr[0]);
        if (onlyLast) picked.push(arr[arr.length - 1]);
      }
      data = picked;
    }

    // CPC flags (New CPC / CPC Mixed)
    if (flagNewCpc || flagCpcMixed) {
      // Filtra SOMENTE boletins cujo corpo indica "New Listing - CPC - Shares"
      // (isCpcByBody). Depois separa em padrão vs. mixed.
      data = data.filter((r) => {
        const pub = (r.ticker ?? "").trim().toUpperCase();
        if (!pub.endsWith(".P")) return false;
        if (!isCpcByBody(r)) return false;
        const mixed = isCpcMixed(r);
        const pad = !mixed;
        return (flagNewCpc && pad) || (flagCpcMixed && mixed);
      });
    }
    // QT Completed flag
    if (flagQtCompleted) {
      data = data.filter(isQtCompleted);
    }

        if (removeDupByType) {
      data = dedupByCompanyRootType(data);
    }

    return data.sort(
      (a, b) => toDateNum(a.bulletin_date) - toDateNum(b.bulletin_date),
    );
  }, [
    rowsInWindow,
    selCompanies,
    selTickers,
    onlySingle,
    onlyMulti,
    onlyFirst,
    onlyLast,
    flagNewCpc,
    flagCpcMixed,
    flagQtCompleted,
    removeDupByType,
    showDuplicatesOnly,
  ]);

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
    () =>
      xDomain[0] === "auto"
        ? { ticks: [] as number[], formatter: (v: number) => fmtDayMonth(v) }
        : makeTicksAdaptive([
            xDomain[0] as number,
            xDomain[1] as number,
          ]),
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
      if (Number.isFinite(ts) && (prev === undefined || (ts as number) < prev!))
        first.set(t, ts as number);
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
    if (tickerOrder.length && yLimit > tickerOrder.length)
      setYLimit(tickerOrder.length);
  }, [tickerOrder.length, yLimit]);

  const visibleTickers = useMemo(
    () =>
      tickerOrder.slice(
        0,
        Math.max(1, Math.min(yLimit, tickerOrder.length || 1)),
      ),
    [tickerOrder, yLimit],
  );
  const chartDataVis = useMemo(
    () =>
      chartData.filter(
        (d) => d.ticker_root && visibleTickers.includes(d.ticker_root),
      ),
    [chartData, visibleTickers],
  );

  const chartHeight = useMemo(
    () => Math.min(1200, Math.max(260, 60 + visibleTickers.length * 26)),
    [visibleTickers],
  );

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
    // Limpa datas, flags e resultados base
    setStartDate("");
    setEndDate("");
    setAutoPeriod(true);
    setRemoveDupByType(false);
    setRows([]);
  setWatchKeys(new Set());
setErrorMsg(null);
    setSelectedBulletin(null);

    setSelCompanies([]);
    setSelTickers([]);
    setOnlyMulti(false);
    setOnlySingle(false);
    setOnlyFirst(false);
    setOnlyLast(false);
    setShowTickerAxis(true);
    setFlagNewCpc(false);
    setFlagCpcMixed(false);
    setFlagQtCompleted(false);
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
        prev
          ? {
              ...prev,
              body_text: (data as { body_text?: string | null }).body_text ?? null,
            }
          : prev,
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
      setTimeout(
        () => firstRowRef.current?.classList.remove("bg-yellow-50"),
        1800,
      );
    }, 0);
  }

  // Export .txt unificado (apenas body_text)
  const SEP = "\n--------------------------------\n";
  async function exportRowsToTxt(baseRows: Row[], filenameBase: string) {
    if (!baseRows.length) return;
    const missing = Array.from(
      new Set(
        baseRows
          .filter((r) => !r.body_text && r.composite_key)
          .map((r) => r.composite_key as string),
      ),
    );
    let filled: Row[] = baseRows;
    if (missing.length) {
      const { data } = await supabase
        .from("vw_bulletins_with_canonical")
        .select("composite_key, body_text")
        .in("composite_key", missing);
      const map = new Map<string, string>();
      for (const r of (data || []) as {
        composite_key: string | null;
        body_text: string | null;
      }[]) {
        if (r.composite_key) map.set(r.composite_key, r.body_text ?? "");
      }
      filled = withBodyTextFilled(baseRows, map);
    }
    const sorted = [...filled].sort(
      (a, b) => toDateNum(a.bulletin_date) - toDateNum(b.bulletin_date),
    );
    const story = sorted
      .map((r) => (r.body_text ?? "").trim())
      .filter((t) => t.length > 0)
      .join(SEP);
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

  // Export .xlsx da tabela (sem agregação) — respeita filtros e flags
  async function exportRowsToXlsxTable(baseRows: Row[], filenameBase: string) {
    if (!baseRows.length) {
      alert("Nada a exportar.");
      return;
    }
    const rowsPlain = baseRows.map((r) => ({
      id: r.id,
      company: r.company ?? "",
      ticker: r.ticker ?? "",
      composite_key: r.composite_key ?? "",
      bulletin_date: r.bulletin_date ?? "",
      canonical_type: r.canonical_type ?? r.bulletin_type ?? "",
      canonical_class: r.canonical_class ?? "",
      source_file: r.source_file ?? "",
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

  return (
    <div className="p-6 space-y-4">
      {/* Título + EXPORTS */}
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">CPC — Notices</h1>
        {loadingAnchors && (
          <span className="text-xs text-gray-500">carregando âncoras...</span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
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
            📜 Exportar seleção (.txt)
          </button>

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
            🗂️ Exportar período (.txt)
          </button>

          <button
            onClick={async () => {
              await exportRowsToXlsxTable(tableRows, "cpc_tabela");
            }}
            disabled={!tableRows.length}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
          >
            📄 Exportar tabela (.xlsx)
          </button>
        </div>
      </div>

      {/* Linha: datas + ações */}
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
        <div className="flex items-end gap-2 pb-[2px]">
          <button
            className="border rounded px-3 h-10 font-semibold flex items-center justify-center"
            title="Executar busca"
            aria-label="Executar busca"
            onClick={async () => {
              if (!anchors.size || !anchorCompanies.length) {
                setErrorMsg(
                  "Âncoras indisponíveis (CPC inicial não encontrado).",
                );
                return;
              }
              setLoadingTimeline(true);
              setErrorMsg(null);
              try {
                const perCompanyMin = new Map<string, string>();
                for (const k of anchors.keys()) {
                  const [company] = k.split("|");
                  const d = anchors.get(k)!;
                  const prev = perCompanyMin.get(company);
                  if (!prev || d < prev) perCompanyMin.set(company, d);
                }
                const chunks = ((arr: string[], size: number) => {
                  const out: string[][] = [];
                  for (let i = 0; i < arr.length; i += size)
                    out.push(arr.slice(i, i + size));
                  return out;
                })(anchorCompanies, 100);
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
                    .select(
                      "id, source_file, company, ticker, bulletin_type, canonical_type, canonical_class, bulletin_date, tier, body_text, composite_key, parser_profile, parser_status, parser_parsed_at",
                    )
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
                    if (!anchor || !r.bulletin_date || r.bulletin_date < anchor)
                      continue;
                    all.push(r);
                  }
                }
                setRows(all);
              } catch (e) {
                setErrorMsg(errMessage(e));
              } finally {
                setLoadingTimeline(false);
              }
            }}
            disabled={loadingTimeline || (!startDate && !endDate)}
          >
            ⚡
          </button>
          <button
            className="border rounded px-3 h-10 flex items-center justify-center"
            onClick={handleReset}
            title="Limpar"
            aria-label="Limpar filtros"
          >
            🧹
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="border border-red-300 bg-red-50 text-red-800 p-2 rounded">
          {errorMsg}
        </div>
      )}

      {/* Auto-período (min→max) */}
      <div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoPeriod}
            onChange={(e) => setAutoPeriod(e.target.checked)}
          />
          Auto-período (min→max) na view
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

      {/* KPIs: dois degraus (Boletins / Empresas) com cards especiais e tipografia suave */}
      {showStats && (
        <div className="w-full border rounded p-4 bg-white space-y-3">

          {/* DEGRAU 1 — BOLETINS */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">

            {/* BU — Total (com U/M) */}
            <div className="rounded-lg border p-3 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between min-h-[88px]">
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-semibold tracking-tight">{kpiBoletins.total}</div>
                <div className="text-sm whitespace-nowrap">BU — Total</div>
              </div>
              <div className="h-px bg-black/30 my-1" />
              <div className="flex items-center gap-6 text-sm">
                <span>U: {kpiBoletins.unico}</span>
                <span>M: {kpiBoletins.misto}</span>
              </div>
            </div>

            {/* BU — CPC (unificado por canonical) */}
            <div className="rounded-lg border p-3 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between min-h-[88px]">
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-semibold tracking-tight">{kpiBoletins.cpcUnifiedTotal}</div>
                <div className="text-sm whitespace-nowrap">BU — CPC</div>
              </div>
              <div className="h-px bg-black/30 my-1" />
              <div className="flex items-center gap-6 text-sm">
                <span>U: {kpiBoletins.cpcPad}</span>
                <span>M: {kpiBoletins.cpcMix}</span>
              </div>
            </div>

            {/* Boletins — QT */}
            <div className="rounded-lg border p-3 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between min-h-[88px]">
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-semibold tracking-tight">{kpiBoletins.qtAny}</div>
                <div className="text-sm whitespace-nowrap">QT — Total</div>
              </div>
              <div className="h-px bg-black/30 my-1" />
              <div className="flex items-center gap-6 text-sm">
                <span>C: {kpiBoletins.qtCompleted}</span>
                <span>O: {kpiBoletins.qtOther}</span>
              </div>
            </div>

            {/* Eventos duplicados no dataset */}
            <div className="rounded-lg border p-3 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between min-h-[88px]">
              <div className="text-2xl font-semibold tracking-tight">{kpiDuplicados.dupEvents}</div>
              <div className="text-sm mt-1">Eventos — duplicados</div>
              <div className="text-xs mt-1 text-black/70">
                Grupos: {kpiDuplicados.groups}
              </div>
            </div>

          </div>
          {/* DEGRAU 2 — EMPRESAS */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">

            {/* Empresas — Total */}
            <div className="rounded-lg border p-3 bg-white shadow-sm hover:shadow transition-shadow flex flex-col justify-center min-h-[88px]">
              <div className="text-2xl font-semibold tracking-tight">{kpiEmpresas.total}</div>
              <div className="text-sm mt-1">Empresas — Total</div>
            </div>

            {/* Emp. =1 BU (com U/M) */}
            <div className="rounded-lg border p-3 bg-white shadow-sm hover:shadow transition-shadow flex flex-col justify-between min-h-[88px]">
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-semibold tracking-tight">{kpiEmpresas.eq1}</div>
                <div className="text-sm whitespace-nowrap">Emp. =1 BU</div>
              </div>
              <div className="h-px bg-black/30 my-1" />
              <div className="flex items-center gap-6 text-sm">
                <span>U: {kpiEmpresas.eq1_unico}</span>
                <span>M: {kpiEmpresas.eq1_misto}</span>
              </div>
            </div>

            {/* Empresas — 2+ boletins */}
            <div className="rounded-lg border p-3 bg-white shadow-sm hover:shadow transition-shadow flex flex-col justify-center min-h-[88px]">
              <div className="text-2xl font-semibold tracking-tight">{kpiEmpresas.ge2}</div>
              <div className="text-sm mt-1">Empresas — 2+ boletins</div>
            </div>

            {/* Empresas — QT (completed) */}
            <div className="rounded-lg border p-3 bg-white shadow-sm hover:shadow transition-shadow flex flex-col justify-center min-h-[88px]">
              <div className="text-2xl font-semibold tracking-tight">{kpiEmpresas.qtCompletedCompanies}</div>
              <div className="text-sm mt-1">Empresas — QT (completed)</div>
            </div>
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
              <input
                type="checkbox"
                checked={showTickerAxis}
                onChange={(e) => setShowTickerAxis(e.target.checked)}
              />
              Mostrar Tickers
            </label>
            <label className="flex items-center gap-1" title="Remove duplicatas por Empresa×TickerRoot×Tipo (mantém o 1º por data)">
              <input
                type="checkbox"
                checked={removeDupByType}
                onChange={(e) => {
                  setRemoveDupByType(e.target.checked);
                  if (e.target.checked) setShowDuplicatesOnly(false);
                }}
              />
              Rem. Dupli.
            </label>
            <label className="flex items-center gap-1" title="Ver apenas eventos duplicados por Empresa×TickerRoot×Tipo">
              <input
                type="checkbox"
                checked={showDuplicatesOnly}
                onChange={(e) => {
                  setShowDuplicatesOnly(e.target.checked);
                  if (e.target.checked) setRemoveDupByType(false);
                }}
              />
              Ver dupl.
            </label>


            {/* CPC flags */}
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={flagNewCpc}
                onChange={(e) => setFlagNewCpc(e.target.checked)}
              />
              New CPC
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={flagCpcMixed}
                onChange={(e) => setFlagCpcMixed(e.target.checked)}
              />
              CPC Mixed
            </label>

            {/* QT Completed flag */}
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={flagQtCompleted}
                onChange={(e) => setFlagQtCompleted(e.target.checked)}
              />
              QT Completed
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
                onClick={() =>
                  setYLimit((v) =>
                    Math.min(tickerOrder.length || v + 10, v + 10),
                  )
                }
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
                  tickFormatter={
                    showTickerAxis
                      ? (t) => `${t} (${tickerCount.get(String(t)) ?? 0})`
                      : undefined
                  }
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
                        <div>
                          <strong>Data:</strong> {date}
                        </div>
                        <div>
                          <strong>Empresa:</strong> {d.company || "—"}
                        </div>
                        <div>
                          <strong>Ticker:</strong> {d.ticker || "—"}
                        </div>
                        <div>
                          <strong>Tipo:</strong> {d.type_display || "—"}
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          Clique: filtra empresa | Shift+Clique: isola este
                          boletim
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={chartDataVis}
                  onClick={(p, idx, ...rest) =>
                    onPointClick(p as ScatterDatum, idx as number, ...rest)
                  }
                />
              </ScatterChart>
            </ResponsiveContainer>
            {selTickers.length > 0 && chartDataVis.length === 0 && (
              <div className="text-xs text-gray-600 mt-1">
                Sem eventos para a seleção no período.
              </div>
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
                    Empresa {sortIndicator("company")}
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
                <th
                  className="p-2"
                  aria-sort={
                    sortKey === "composite_key"
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    className="font-semibold cursor-pointer select-none"
                    onClick={() => toggleSort("composite_key")}
                  >
                    Composite Key {sortIndicator("composite_key")}
                  </button>
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
                    sortKey === "bulletin_date"
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    className="font-semibold cursor-pointer select-none"
                    onClick={() => toggleSort("bulletin_date")}
                  >
                    Data {sortIndicator("bulletin_date")}
                  </button>
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm"
                    placeholder="YYYY ou YYYY-MM ou YYYY-MM-DD"
                    value={fDate}
                    onChange={(e) => setFDate(e.target.value)}
                  />
                </th>
                <th
                  className="p-2"
                  aria-sort={
                    sortKey === "canonical_type"
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    className="font-semibold cursor-pointer select-none"
                    onClick={() => toggleSort("canonical_type")}
                  >
                    Tipo de Boletim {sortIndicator("canonical_type")}
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
                    {(isCpc(row) && row.canonical_class === "Unico") || ((row.canonical_type ?? row.bulletin_type ?? "").toUpperCase() === "HALT" || (row.canonical_type ?? row.bulletin_type ?? "").toUpperCase() === "RESUME TRADING") ? (
                      <div className="flex gap-2 items-center">
                        <select
                          className="border px-1 py-0.5 text-xs"
                          value={row.parser_profile ?? ""}
                          disabled={parserLoadingId === row.id}
                          onChange={(e) => {
                            const value = e.target.value;
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
                            (!row.parser_profile &&
                              !suggestedParserProfile(row)) ||
                            parserLoadingId === row.id
                          }
                          onClick={() => activateParserForRow(row)}
                        >
                          {parserLoadingId === row.id ? "Salvando..." : "Ativar"}
                        </button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2 text-xs">{parserStatusLabel(row)}</td>
                  <td className="p-2 text-xs">
                    {row.parser_parsed_at ? row.parser_parsed_at.slice(0, 10) : "—"}
                  </td>
                </tr>
              ))}
              {tableRowsPage.length === 0 && (
                <tr>
                  <td className="p-2 text-gray-600" colSpan={8}>
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <div className="text-sm text-gray-600">
            Exibindo {tableRowsPage.length} de {tableRows.length} registros
          </div>
          <button
            className="border rounded px-3 py-1"
            onClick={() =>
              setTableLimit((v) => Math.min(tableRows.length, v + 50))
            }
            disabled={tableRowsPage.length >= tableRows.length}
            title="Mostrar mais 50 linhas"
          >
            Mostrar +50
          </button>
          <button
            className="border rounded px-3 py-1"
            onClick={() => setTableLimit(tableRows.length)}
            disabled={tableRowsPage.length >= tableRows.length}
            title="Mostrar todas as linhas"
          >
            Mostrar todos
          </button>
        </div>
      </div>

      {/* Modal */}
      {selectedBulletin && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={closeBulletinModal}
        >
          <div
            className="bg-white max-w-3xl w-full rounded shadow p-4 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Boletim</h3>
              <button className="border rounded px-2 h-10" onClick={closeBulletinModal}>
                Fechar
              </button>
            </div>
            <div className="text-sm text-gray-700">
              <div>
                <strong>Empresa:</strong> {selectedBulletin.company || "—"}
              </div>
              <div>
                <strong>Ticker:</strong> {selectedBulletin.ticker || "—"}
              </div>
              <div>
                <strong>Data:</strong> {selectedBulletin.bulletin_date || "—"}
              </div>
              <div>
                <strong>Tipo:</strong>{" "}
                {selectedBulletin.canonical_type ??
                  selectedBulletin.bulletin_type ??
                  "—"}
              </div>
              <div>
                <strong>Composite Key:</strong>{" "}
                {selectedBulletin.composite_key ?? "—"}
              </div>
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
