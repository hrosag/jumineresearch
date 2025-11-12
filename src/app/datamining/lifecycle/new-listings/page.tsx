"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// --- Supabase client (Next.js client-side)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// --- Tipos mínimos usados nesta tela
type Row = {
  company?: string | null;
  ticker_root?: string | null;
  composite_key?: string | null;
  bulletin_date?: string | null;
  canonical_type?: string | null;
  bulletin_type?: string | null;
};

const CANON = {
  CPC: "NEW LISTING-CPC-SHARES",
  SHARES: "NEW LISTING-SHARES",
  IPO: "NEW LISTING-IPO-SHARES",
} as const;

type Bucket = { pure: Row[]; mixed: Row[] };

// --- Helpers
function classifyRow(r: Row, label: string) {
  const L = label.toUpperCase();
  const ct = (r.canonical_type || "").toUpperCase();
  const bt = (r.bulletin_type || "").toUpperCase();
  const hitCanonical = ct === L;
  const hitMixed = !hitCanonical && bt.includes(L);
  return { any: hitCanonical || hitMixed, mixed: hitMixed };
}

function bucketize(rows: Row[]) {
  const B: Record<string, Bucket> = {
    [CANON.CPC]: { pure: [], mixed: [] },
    [CANON.SHARES]: { pure: [], mixed: [] },
    [CANON.IPO]: { pure: [], mixed: [] },
  };
  for (const r of rows) {
    const hits = [CANON.CPC, CANON.SHARES, CANON.IPO]
      .map((lbl) => [lbl, classifyRow(r, lbl)] as const)
      .filter(([, m]) => m.any);
    if (!hits.length) continue;

    // prioridade: se algum for canônico, use esse; senão o primeiro match
    const canonicalHit = hits.find(([, m]) => !m.mixed);
    const [label, meta] = canonicalHit ?? hits[0];

    const r2: Row & { _mixed?: boolean } = { ...r, _mixed: meta.mixed };
    (meta.mixed ? B[label].mixed : B[label].pure).push(r2);
  }
  return B;
}

type SortKey = "company" | "ticker_root" | "composite_key" | "bulletin_date" | "tag";
type SortDir = "asc" | "desc";

function sortRows(rows: (Row & { _mixed?: boolean })[], key: SortKey, dir: SortDir) {
  const mul = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av =
      key === "tag" ? (a._mixed ? "mixed" : "") : String((a as any)[key] ?? "");
    const bv =
      key === "tag" ? (b._mixed ? "mixed" : "") : String((b as any)[key] ?? "");
    if (av < bv) return -1 * mul;
    if (av > bv) return 1 * mul;
    return 0;
  });
}

function useTextFilter(rows: (Row & { _mixed?: boolean })[]) {
  const [qCompany, setQCompany] = useState("");
  const [qTicker, setQTicker] = useState("");
  const [includeMixed, setIncludeMixed] = useState(true);

  const filtered = useMemo(() => {
    const qc = qCompany.trim().toUpperCase();
    const qt = qTicker.trim().toUpperCase();
    return rows.filter((r) => {
      if (!includeMixed && r._mixed) return false;
      if (qc && !(r.company || "").toUpperCase().includes(qc)) return false;
      if (qt && !(r.ticker_root || "").toUpperCase().includes(qt)) return false;
      return true;
    });
  }, [rows, qCompany, qTicker, includeMixed]);

  return {
    filtered,
    qCompany,
    setQCompany,
    qTicker,
    setQTicker,
    includeMixed,
    setIncludeMixed,
  };
}

// --- Cabeçalho com sort
function Th({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  const arrow = !active ? "" : dir === "asc" ? " ▲" : " ▼";
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{ cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" }}
      title="Clique para ordenar"
    >
      {label}
      {arrow}
    </th>
  );
}

// --- Tabela por bucket
function BucketTable({
  title,
  pure,
  mixed,
}: {
  title: string;
  pure: (Row & { _mixed?: boolean })[];
  mixed: (Row & { _mixed?: boolean })[];
}) {
  const all = useMemo(() => [...pure, ...mixed], [pure, mixed]);
  const {
    filtered,
    qCompany,
    setQCompany,
    qTicker,
    setQTicker,
    includeMixed,
    setIncludeMixed,
  } = useTextFilter(all);

  const [sortKey, setSortKey] = useState<SortKey>("bulletin_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const rows = useMemo(() => sortRows(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);

  const total = pure.length + mixed.length;
  const mixedCount = mixed.length;

  return (
    <details open>
      <summary style={{ fontWeight: 600, cursor: "pointer" }}>
        {title} ({total}){mixedCount ? (
          <span
            className="ml-2 inline-flex items-center rounded border px-2 py-0.5 text-xs opacity-80"
            aria-label={`mixed ${mixedCount}`}
          >
            mixed {mixedCount}
          </span>
        ) : null}
      </summary>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "8px 0" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span>Empresa</span>
          <input
            value={qCompany}
            onChange={(e) => setQCompany(e.target.value)}
            placeholder="filtrar..."
            style={{ padding: "2px 6px" }}
          />
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span>Ticker</span>
          <input
            value={qTicker}
            onChange={(e) => setQTicker(e.target.value)}
            placeholder="filtrar..."
            style={{ padding: "2px 6px" }}
          />
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={includeMixed}
            onChange={(e) => setIncludeMixed(e.target.checked)}
          />
          <span>Incluir mixed</span>
        </label>
      </div>

      {/* Tabela */}
      <table className="w-full" style={{ width: "100%" }}>
        <thead>
          <tr>
            <Th label="Empresa"      sortKey="company"       activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <Th label="Ticker"       sortKey="ticker_root"   activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <Th label="Composite Key"sortKey="composite_key" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <Th label="Data"         sortKey="bulletin_date" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <Th label="Tag"          sortKey="tag"           activeKey={sortKey} dir={sortDir} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={(r.composite_key ?? "") + i}>
              <td>
                {r.company}
              </td>
              <td>{r.ticker_root}</td>
              <td>
                {r.composite_key ? (
                  <a href={`/bulletin/${encodeURIComponent(r.composite_key)}`}>
                    {r.composite_key}
                  </a>
                ) : "—"}
              </td>
              <td>{r.bulletin_date ?? "—"}</td>
              <td>{r._mixed ? (
                <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs opacity-80">
                  mixed
                </span>
              ) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

// --- Página
export default function NewListingsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      // Captura canônicos + “mistos” numa única query .or(...)
      const orExpr = [
        `canonical_type.eq.${CANON.CPC}`,
        `canonical_type.eq.${CANON.SHARES}`,
        `canonical_type.eq.${CANON.IPO}`,
        `bulletin_type.ilike.%${CANON.CPC}%`,
        `bulletin_type.ilike.%${CANON.SHARES}%`,
        `bulletin_type.ilike.%${CANON.IPO}%`,
      ].join(",");

      const { data, error } = await supabase
        .from("vw_bulletins_with_canonical")
        .select("*")
        .or(orExpr)
        // .order("bulletin_date", { ascending: false }) // opcional
        // .limit(5000) // se necessário
        ;

      if (cancel) return;
      if (error) {
        console.error("Supabase error:", error);
        setRows([]);
      } else {
        setRows(data ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const buckets = useMemo(() => bucketize(rows ?? []), [rows]);

  if (loading) return <div>Carregando…</div>;
  if (!rows?.length) return <div>Nenhum resultado.</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <BucketTable
        title={CANON.CPC}
        pure={buckets[CANON.CPC].pure}
        mixed={buckets[CANON.CPC].mixed}
      />
      <BucketTable
        title={CANON.SHARES}
        pure={buckets[CANON.SHARES].pure}
        mixed={buckets[CANON.SHARES].mixed}
      />
      <BucketTable
        title={CANON.IPO}
        pure={buckets[CANON.IPO].pure}
        mixed={buckets[CANON.IPO].mixed}
      />
    </div>
  );
}
