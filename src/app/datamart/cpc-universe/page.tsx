"use client";

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { createClient } from "@supabase/supabase-js";
import Select, { MultiValue } from "react-select";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const VIEW_NAME = "vw_cpc_universe";

type Row = {
  company_name: string | null;
  ticker: string | null;

  commence_date: string | null; // YYYY-MM-DD
  capitalization_volume: number | string | null; // bigint pode vir como string

  halt_date: string | null; // YYYY-MM-DD
  resume_trading_date: string | null; // YYYY-MM-DD
};

type Opt = { value: string; label: string };

function normalizeTickerRoot(t?: string | null) {
  return (t ?? "").trim().toUpperCase().split(".")[0];
}

function fmtDateBR(iso?: string | null) {
  if (!iso) return "—";
  // iso esperado: YYYY-MM-DD
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

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [selCompanies, setSelCompanies] = useState<Opt[]>([]);
  const [selTickers, setSelTickers] = useState<Opt[]>([]);

  const [fCompany, setFCompany] = useState("");
  const [fTicker, setFTicker] = useState("");

  const dfCompany = useDeferredValue(fCompany);
  const dfTicker = useDeferredValue(fTicker);

  // Auto min/max window baseado em commence_date
  useEffect(() => {
    (async () => {
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
        if (minDate && !startDate) setStartDate(minDate);
        if (maxDate && !endDate) setEndDate(maxDate);
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    const cf = dfCompany.trim().toLowerCase();
    const tf = dfTicker.trim().toLowerCase();

    data = data.filter((r) => {
      const c = (r.company_name ?? "").toLowerCase();
      const t = (r.ticker ?? "").toLowerCase();
      if (cf && !c.includes(cf)) return false;
      if (tf && !t.includes(tf)) return false;
      return true;
    });

    return data;
  }, [rowsInWindow, selCompanies, selTickers, dfCompany, dfTicker]);

  const kpis = useMemo(() => {
    const total = rowsFiltered.length;
    const withHalt = rowsFiltered.filter((r) => !!r.halt_date).length;
    const withResume = rowsFiltered.filter((r) => !!r.resume_trading_date).length;
    const haltedAndResumed = rowsFiltered.filter((r) => !!r.halt_date && !!r.resume_trading_date).length;
    return { total, withHalt, withResume, haltedAndResumed };
  }, [rowsFiltered]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">CPC — Universe</h1>

        <div className="ml-auto flex flex-wrap gap-2">
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

      {/* Filtros rápidos */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
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
      </div>

      {/* KPIs */}
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

      {/* Tabela */}
      <div className="w-full border rounded overflow-hidden">
        <div className="px-3 py-2 border-b text-sm flex items-center gap-3">
          <span className="font-semibold">Tabela</span>
          {loading && <span className="text-xs text-black/60">carregando...</span>}
          <span className="ml-auto text-xs text-black/60">Linhas: {rowsFiltered.length}</span>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-2 border-b">Company</th>
                <th className="text-left p-2 border-b">Ticker</th>
                <th className="text-left p-2 border-b">Commence</th>
                <th className="text-right p-2 border-b">Capitalization</th>
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
