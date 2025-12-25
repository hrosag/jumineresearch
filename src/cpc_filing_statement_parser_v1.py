import os
import re
import json
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

import requests

# 1) Constantes / config
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

VIEW_NAME = "vw_bulletins_with_canonical"
EVENTS_TABLE = "cpc_events"
BIRTH_TABLE = "cpc_birth"

COMPOSITE_KEY = os.getenv("COMPOSITE_KEY", "").strip()  # opcional
PARSER_PROFILE_ENV = os.getenv("PARSER_PROFILE", "cpc_filing_statement_v1").strip() or "cpc_filing_statement_v1"

EVENT_TYPE = "CPC_FILING_STATEMENT"

RE_DATED = re.compile(r"\bdated\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\b", re.IGNORECASE | re.MULTILINE)

MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}

def sb_headers() -> Dict[str, str]:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Accept": "application/json",
    }

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def clean_space(s: str | None) -> str:
    if not s:
        return ""
    return " ".join(s.strip().split())

def parse_dated_to_yyyy_mm_dd(text: str) -> Optional[str]:
    m = RE_DATED.search(text.replace("\r", ""))
    if not m:
        return None
    month, day, year = m.group(1), m.group(2), m.group(3)
    mm = MONTHS.get(month.strip().lower())
    if not mm:
        return None
    try:
        dd = int(day)
        yy = int(year)
    except Exception:
        return None
    return f"{yy:04d}-{mm:02d}-{dd:02d}"

def fetch_marked_rows() -> list[dict]:
    """
    Busca na view apenas linhas marcadas como ready para este parser_profile,
    e do tipo CPC-Filing Statement.
    """
    url = f"{SUPABASE_URL}/rest/v1/{VIEW_NAME}"
    params: Dict[str, Any] = {
        "select": "id,company,ticker,composite_key,canonical_type,canonical_class,bulletin_date,tier,body_text,parser_profile,parser_status",
        "parser_profile": f"eq.{PARSER_PROFILE_ENV}",
        "parser_status": "eq.ready",
        "canonical_type": "ilike.*filing statement*",
        "order": "bulletin_date.asc",
        "limit": "1000",
    }
    if COMPOSITE_KEY:
        params["composite_key"] = f"eq.{COMPOSITE_KEY}"

    resp = requests.get(url, headers=sb_headers(), params=params, timeout=60)
    resp.raise_for_status()
    return resp.json()

def find_cpc_birth_id(company: str | None, ticker: str | None) -> Optional[str]:
    """
    Resolve o UUID em cpc_birth para o evento atual.
    Estratégia v1: tenta ticker primeiro, e em seguida company + ticker.
    """
    url = f"{SUPABASE_URL}/rest/v1/{BIRTH_TABLE}"
    headers = sb_headers()

    t = clean_space(ticker).upper()
    c = clean_space(company).upper()

    # 1) ticker
    if t:
        params = {"select": "id", "ticker": f"eq.{t}", "limit": 1}
        r = requests.get(url, headers=headers, params=params, timeout=60)
        r.raise_for_status()
        data = r.json()
        if data:
            return data[0]["id"]

    # 2) company + ticker
    if c and t:
        params = {"select": "id", "company_name": f"eq.{c}", "ticker": f"eq.{t}", "limit": 1}
        r = requests.get(url, headers=headers, params=params, timeout=60)
        r.raise_for_status()
        data = r.json()
        if data:
            return data[0]["id"]

    return None

def build_event_row(rec: dict) -> Optional[Dict[str, Any]]:
    body = rec.get("body_text") or ""
    effective_date = parse_dated_to_yyyy_mm_dd(body)
    if not effective_date:
        return None

    company = rec.get("company")
    ticker = rec.get("ticker")
    cpc_birth_id = find_cpc_birth_id(company, ticker)

    summary = "Exchange accepted for filing the Company's CPC Filing Statement."

    src_hash = hashlib.sha1(body.encode("utf-8")).hexdigest()

    return {
        "cpc_birth_id": cpc_birth_id,
        "event_composite_key": rec.get("composite_key"),
        "event_type": clean_space(rec.get("canonical_type") or "CPC-FILING STATEMENT"),
        "bulletin_date": rec.get("bulletin_date"),
        "event_effective_date": effective_date,
        "event_effective_time": None,
        "event_effective_text": None,
        "event_summary": summary,
        "event_body_raw": body,
        "parse_version": PARSER_PROFILE_ENV,
        "parsed_at": now_iso(),
        "source_hash": src_hash,
    }

def upsert_events(rows: List[Dict[str, Any]]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{EVENTS_TABLE}"
    headers = {
        **sb_headers(),
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    params = {"on_conflict": "event_composite_key"}
    resp = requests.post(url, headers=headers, params=params, data=json.dumps(rows), timeout=60)
    if not resp.ok:
        print("Erro ao inserir em cpc_events:", resp.status_code, resp.text)
        resp.raise_for_status()

def mark_status(ids: List[int], status: str, set_parsed_at: bool = False) -> None:
    url = f"{SUPABASE_URL}/rest/v1/all_data"
    headers = {
        **sb_headers(),
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    payload: Dict[str, Any] = {"parser_status": status}
    if status in ("ready", "running"):
        payload["parser_parsed_at"] = None
    if set_parsed_at:
        payload["parser_parsed_at"] = now_iso()

    for id_ in ids:
        r = requests.patch(f"{url}?id=eq.{id_}", headers=headers, data=json.dumps(payload), timeout=60)
        if not r.ok:
            print("Erro ao atualizar status em all_data:", id_, r.status_code, r.text)
            r.raise_for_status()

def mark_running(ids: List[int]) -> None:
    mark_status(ids, "running")

def mark_done(ids: List[int]) -> None:
    # done + parsed_at
    mark_status(ids, "done", set_parsed_at=True)

def mark_error(id_: int) -> None:
    mark_status([id_], "error")

def main() -> None:
    records = fetch_marked_rows()
    if not records:
        print("Nada a processar.")
        return

    ids_all = [int(r["id"]) for r in records if r.get("id") is not None]
    if ids_all:
        mark_running(ids_all)

    out_rows: List[Dict[str, Any]] = []
    ids_done: List[int] = []

    for rec in records:
        rid = rec.get("id")
        try:
            row = build_event_row(rec)
            if row:
                out_rows.append(row)
                if rid is not None:
                    ids_done.append(int(rid))
            else:
                if rid is not None:
                    print("Não foi possível extrair effective_date; marcando error:", rid)
                    mark_error(int(rid))
        except Exception as e:
            if rid is not None:
                print("Erro ao processar registro; marcando error:", rid, str(e))
                mark_error(int(rid))

    if out_rows:
        upsert_events(out_rows)

    if ids_done:
        mark_done(ids_done)

    print(f"Finalizado. done={len(ids_done)} total={len(ids_all)}")

if __name__ == "__main__":
    main()
