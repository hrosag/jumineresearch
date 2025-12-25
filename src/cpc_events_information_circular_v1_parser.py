import os
import re
import hashlib
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

import requests

# ======================================================
# CPC Events Parser — Information Circular (FINAL)
# File: src/cpc_events_information_circular_v1_parser.py
#
# IMPORTANT (repo padrão):
# - ESTE PARSER NÃO escreve em all_data.
# - all_data é atualizado exclusivamente pelo route.ts (PATCH).
# - Este script apenas lê a view e grava em cpc_events.
# ======================================================

SUPABASE_URL = os.environ["SUPABASE_URL"]

SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_KEY")
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
)
if not SUPABASE_KEY:
    raise RuntimeError(
        "Missing env: SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY"
    )

VIEW_NAME = os.environ.get("VIEW_NAME") or "vw_bulletins_with_canonical"
TABLE_EVENTS = os.environ.get("TABLE_EVENTS") or "cpc_events"
TABLE_CPC_BIRTH = os.environ.get("TABLE_CPC_BIRTH") or "cpc_birth"

COMPOSITE_KEY = os.environ.get("COMPOSITE_KEY")
PARSER_PROFILE = (
    os.environ.get("PARSER_PROFILE")
    or "cpc_events_information_circular_v1"
)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}


def sb_url(path: str) -> str:
    return f"{SUPABASE_URL.rstrip('/')}/rest/v1/{path.lstrip('/')}"


def sha1(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8", errors="ignore")).hexdigest()


def parse_long_date(s: str) -> Optional[str]:
    s = (s or "").strip()
    if not s:
        return None
    s = re.sub(r"\s+", " ", s)
    for fmt in ("%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    return None


def fetch_bulletin(composite_key: str) -> Dict[str, Any]:
    params = {
        "select": "company,ticker,bulletin_date,canonical_type,body_text",
        "composite_key": f"eq.{composite_key}",
        "limit": "1",
    }
    r = requests.get(
        sb_url(VIEW_NAME),
        headers=HEADERS,
        params=params,
        timeout=60,
    )
    r.raise_for_status()
    rows = r.json()
    if not rows:
        raise RuntimeError(
            f"Composite key não encontrado na view: {composite_key}"
        )
    return rows[0]


def ticker_variants(t: str) -> Tuple[str, ...]:
    t = (t or "").strip().upper()
    if not t:
        return ()
    root = t.split(".")[0]
    out = [t]
    if root and root != t:
        out.append(root)
    return tuple(dict.fromkeys(out))


def find_cpc_birth_id(company: str, ticker: str) -> Optional[str]:
    for tv in ticker_variants(ticker):
        params = {
            "select": "id,bulletin_date",
            "ticker": f"eq.{tv}",
            "order": "bulletin_date.asc",
            "limit": "1",
        }
        r = requests.get(
            sb_url(TABLE_CPC_BIRTH),
            headers=HEADERS,
            params=params,
            timeout=60,
        )
        r.raise_for_status()
        rows = r.json()
        if rows:
            return rows[0]["id"]

    if company:
        params = {
            "select": "id,bulletin_date",
            "company_name": f"ilike.%{company}%",
            "order": "bulletin_date.asc",
            "limit": "1",
        }
        r = requests.get(
            sb_url(TABLE_CPC_BIRTH),
            headers=HEADERS,
            params=params,
            timeout=60,
        )
        r.raise_for_status()
        rows = r.json()
        if rows:
            return rows[0]["id"]

    return None


def parse_information_circular(
    body_text: str,
) -> Tuple[Optional[str], Optional[str]]:
    body = body_text or ""

    m = re.search(
        r"cpc\s+information\s+circular\s+dated\s+"
        r"([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})",
        body,
        flags=re.IGNORECASE,
    )
    circular_date = parse_long_date(m.group(1)) if m else None

    m2 = re.search(
        r"for\s+the\s+purpose\s+of\s+(.+?)(?:\.\s|$)",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )
    purpose = None
    if m2:
        purpose = re.sub(r"\s+", " ", m2.group(1)).strip().rstrip(".") or None

    return circular_date, purpose


def insert_event(row: Dict[str, Any]) -> None:
    headers = dict(HEADERS)
    headers["Prefer"] = "return=minimal"
    r = requests.post(
        sb_url(TABLE_EVENTS),
        headers=headers,
        json=row,
        timeout=60,
    )
    r.raise_for_status()


def main() -> None:
    if not COMPOSITE_KEY:
        raise RuntimeError("COMPOSITE_KEY env não informado.")

    b = fetch_bulletin(COMPOSITE_KEY)

    company = b.get("company") or ""
    ticker = b.get("ticker") or ""
    bulletin_date = b.get("bulletin_date")
    body_text = b.get("body_text") or ""

    if not body_text.strip():
        raise RuntimeError("body_text vazio — não há o que parsear.")

    circular_date, purpose = parse_information_circular(body_text)

    cpc_birth_id = find_cpc_birth_id(company, ticker)
    if not cpc_birth_id:
        raise RuntimeError(
            f"Não encontrei cpc_birth_id para company='{company}' "
            f"ticker='{ticker}'."
        )

    summary = "CPC Information Circular accepted for filing."
    if circular_date:
        summary = (
            "CPC Information Circular accepted for filing "
            f"(circular dated {circular_date})."
        )

    event_row = {
        "cpc_birth_id": cpc_birth_id,
        "event_composite_key": COMPOSITE_KEY,
        "event_type": (b.get("canonical_type") or "CPC-INFORMATION CIRCULAR").strip(),
        "bulletin_date": bulletin_date,
        "event_effective_date": circular_date or bulletin_date,
        "event_effective_time": None,
        "event_effective_text": purpose,
        "event_summary": summary,
        "event_body_raw": body_text,
        "parse_version": PARSER_PROFILE,
        "source_hash": sha1(body_text),
    }

    insert_event(event_row)


if __name__ == "__main__":
    main()
