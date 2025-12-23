import os
import re
import json
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional

import requests

# Config
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

VIEW_NAME = "vw_bulletins_with_canonical"
EVENTS_TABLE = "cpc_events"
BIRTH_TABLE = "cpc_birth"

COMPOSITE_KEY = os.environ.get("COMPOSITE_KEY")  # opcional: processar só um boletim
PARSER_PROFILE_ENV = os.environ.get("PARSER_PROFILE") or "events_resume_trading_v1"

PARSE_VERSION = "events_resume_trading_v1"


def clean_space(value: str | None) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def normalize_date(raw: str | None) -> str | None:
    if not raw:
        return None
    text = clean_space(raw)
    for fmt in ("%B %d, %Y", "%b %d, %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def sha1(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def sb_headers() -> Dict[str, str]:
    return {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}


def fetch_marked_rows() -> list[dict]:
    url = f"{SUPABASE_URL}/rest/v1/{VIEW_NAME}"
    params: Dict[str, Any] = {
        "select": "id,company,ticker,composite_key,canonical_type,canonical_class,bulletin_date,tier,body_text,parser_profile,parser_status",
        "parser_profile": f"eq.{PARSER_PROFILE_ENV}",
        "parser_status": "eq.ready",
        "canonical_type": "ilike.*resume trading*",
    }
    if COMPOSITE_KEY:
        params["composite_key"] = f"eq.{COMPOSITE_KEY}"

    resp = requests.get(url, headers=sb_headers(), params=params, timeout=60)
    resp.raise_for_status()
    return resp.json()


def find_cpc_birth_id(company: str | None, ticker: str | None) -> Optional[str]:
    url = f"{SUPABASE_URL}/rest/v1/{BIRTH_TABLE}"
    headers = sb_headers()

    t = clean_space(ticker)
    c = clean_space(company)

    if t:
        params = {"select": "id", "ticker": f"eq.{t}", "limit": 1}
        r = requests.get(url, headers=headers, params=params, timeout=60)
        r.raise_for_status()
        data = r.json()
        if data:
            return data[0]["id"]

        params = {"select": "id", "ticker": f"ilike.{t}", "limit": 1}
        r = requests.get(url, headers=headers, params=params, timeout=60)
        r.raise_for_status()
        data = r.json()
        if data:
            return data[0]["id"]

    if c and t:
        params = {"select": "id", "company_name": f"eq.{c}", "ticker": f"eq.{t}", "limit": 1}
        r = requests.get(url, headers=headers, params=params, timeout=60)
        r.raise_for_status()
        data = r.json()
        if data:
            return data[0]["id"]

    if c:
        params = {"select": "id", "company_name": f"ilike.{c}", "limit": 1}
        r = requests.get(url, headers=headers, params=params, timeout=60)
        r.raise_for_status()
        data = r.json()
        if data:
            return data[0]["id"]

    return None


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


def mark_done(ids: List[int]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/all_data"
    headers = {
        **sb_headers(),
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    for id_ in ids:
        payload = {"parser_status": "done", "parser_parsed_at": datetime.utcnow().isoformat()}
        resp = requests.patch(f"{url}?id=eq.{id_}", headers=headers, data=json.dumps(payload), timeout=60)
        if not resp.ok:
            print("Erro ao marcar done:", id_, resp.status_code, resp.text)
            resp.raise_for_status()

def mark_running(ids: List[int]) -> None:
    """Marca registros como 'running' (início do processamento)."""
    url = f"{SUPABASE_URL}/rest/v1/all_data"
    headers = {**sb_headers(), "Content-Type": "application/json", "Prefer": "return=representation"}
    payload = {"parser_status": "running"}
    for id_ in ids:
        resp = requests.patch(f"{url}?id=eq.{id_}", headers=headers, data=json.dumps(payload), timeout=60)
        if not resp.ok:
            print("Erro ao marcar running:", id_, resp.status_code, resp.text)
            resp.raise_for_status()

def mark_error(id_: int) -> None:
    """Marca um registro como 'error' (sem mensagem, pois all_data não tem parser_error)."""
    url = f"{SUPABASE_URL}/rest/v1/all_data"
    headers = {**sb_headers(), "Content-Type": "application/json", "Prefer": "return=representation"}
    payload = {"parser_status": "error"}
    resp = requests.patch(f"{url}?id=eq.{id_}", headers=headers, data=json.dumps(payload), timeout=60)
    if not resp.ok:
        print("Erro ao marcar error:", id_, resp.status_code, resp.text)
        resp.raise_for_status()


def parse_event_resume_trading(rec: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    ctype = (rec.get("canonical_type") or "").upper()
    if "RESUME TRADING" not in ctype:
        return None

    company = rec.get("company")
    ticker = rec.get("ticker")
    body = rec.get("body_text") or ""

    cpc_birth_id = find_cpc_birth_id(company, ticker)
    if not cpc_birth_id:
        print("SEM cpc_birth_id:", company, ticker, rec.get("composite_key"))
        return None

    effective_time = None
    effective_date_text = None
    effective_text = None

    m = re.search(
        r"effective\s+at\s+the\s+opening\s+([A-Za-z]+)\s*,\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if m:
        weekday = clean_space(m.group(1))
        effective_date_text = clean_space(m.group(2))
        effective_time = "opening"
        effective_text = f"opening {weekday}, {effective_date_text}"

    if not effective_date_text:
        m2 = re.search(
            r"effective\s+at\s+the\s+opening\s+([A-Za-z]+\s+\d{1,2},\s*\d{4})",
            body,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if m2:
            effective_date_text = clean_space(m2.group(1))
            effective_time = "opening"
            effective_text = f"opening {effective_date_text}"

    event_effective_date = normalize_date(effective_date_text) or rec.get("bulletin_date")

    row: Dict[str, Any] = {
        "cpc_birth_id": cpc_birth_id,
        "event_composite_key": rec["composite_key"],
        "event_type": "RESUME_TRADING",
        "bulletin_date": rec.get("bulletin_date"),
        "event_effective_date": event_effective_date,
        "event_effective_time": effective_time,
        "event_effective_text": effective_text,
        "event_summary": "Trading resumed in the common shares of the Company.",
        "event_body_raw": body,
        "parse_version": PARSE_VERSION,
        "parsed_at": datetime.utcnow().isoformat(),
        "source_hash": sha1(body),
    }
    return row


def main() -> None:
    records = fetch_marked_rows()
    print(f"{len(records)} registros marcados para RESUME TRADING (profile={PARSER_PROFILE_ENV}).")

    rows: List[Dict[str, Any]] = []
    ids_done: List[int] = []
    ids_all: List[int] = [r.get("id") for r in records if r.get("id") is not None]

    if ids_all:
        # Marca como running assim que o job começa a processar
        mark_running(ids_all)

    for rec in records:
        rid = rec.get("id")
        try:
            row = parse_event_resume_trading(rec)
            if row:
                rows.append(row)
                if rid is not None:
                    ids_done.append(rid)
            else:
                # Não conseguiu parsear: marca como error para não ficar preso em ready/running
                if rid is not None:
                    print("Registro não parseado; marcando error:", rid)
                    mark_error(int(rid))
        except Exception as e:
            if rid is not None:
                print("Erro ao processar registro; marcando error:", rid, str(e))
                mark_error(int(rid))


    if not rows:
        print("Nada para inserir em cpc_events.")
        return

    upsert_events(rows)
    mark_done(ids_done)
    print("Concluído.")


if __name__ == "__main__":
    main()
