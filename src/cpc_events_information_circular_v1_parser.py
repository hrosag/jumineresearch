import os
import re
import hashlib
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

import requests

# =========================
# CPC Events Parser: CPC-Information Circular
# Target table: cpc_events
# Event type: INFORMATION_CIRCULAR
#
# IMPORTANT (padrão do repo):
# - NÃO atualizar all_data aqui.
# - all_data é marcado como READY no route.ts (API) antes de disparar o workflow.
# =========================

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_KEY:
    raise RuntimeError("Missing env: SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY")

VIEW_NAME = os.environ.get("VIEW_NAME") or "vw_bulletins_with_canonical"
TABLE_EVENTS = os.environ.get("TABLE_EVENTS") or "cpc_events"
TABLE_CPC_BIRTH = os.environ.get("TABLE_CPC_BIRTH") or "cpc_birth"

COMPOSITE_KEY = os.environ.get("COMPOSITE_KEY")
PARSER_PROFILE = os.environ.get("PARSER_PROFILE") or "cpc_events_information_circular_v1"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}


def _sb_url(path: str) -> str:
    return f"{SUPABASE_URL.rstrip('/')}/rest/v1/{path.lstrip('/')}"


def _sha1(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8", errors="ignore")).hexdigest()


def _parse_long_date(s: str) -> Optional[str]:
    """Parses: 'October 29, 2008' or 'Nov 21, 2008' -> YYYY-MM-DD"""
    s = (s or "").strip()
    if not s:
        return None
    s = re.sub(r"\s+", " ", s)
    for f in ("%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(s, f).date().isoformat()
        except ValueError:
            continue
    return None


def fetch_bulletin_by_key(composite_key: str) -> Dict[str, Any]:
    params = {
        "select": "company,ticker,bulletin_date,canonical_type,bulletin_type,body_text",
        "composite_key": f"eq.{composite_key}",
        "limit": "1",
    }
    r = requests.get(_sb_url(VIEW_NAME), headers=HEADERS, params=params, timeout=60)
    r.raise_for_status()
    rows = r.json()
    if not rows:
        raise RuntimeError(f"Composite key não encontrado na view: {composite_key}")
    return rows[0]


def find_cpc_birth_id(company: str, ticker: str) -> Optional[str]:
    """Best-effort: match by ticker exact; else company ilike; earliest bulletin_date."""
    company = (company or "").strip()
    ticker = (ticker or "").strip()

    if ticker:
        params = {"select": "id,bulletin_date", "ticker": f"eq.{ticker}", "order": "bulletin_date.asc", "limit": "1"}
        r = requests.get(_sb_url(TABLE_CPC_BIRTH), headers=HEADERS, params=params, timeout=60)
        r.raise_for_status()
        rows = r.json()
        if rows:
            return rows[0].get("id")

    if company:
        params = {
            "select": "id,bulletin_date",
            "company_name": f"ilike.%{company}%",
            "order": "bulletin_date.asc",
            "limit": "1",
        }
        r = requests.get(_sb_url(TABLE_CPC_BIRTH), headers=HEADERS, params=params, timeout=60)
        r.raise_for_status()
        rows = r.json()
        if rows:
            return rows[0].get("id")

    return None


def parse_information_circular(body_text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Extract:
    - circular_date_iso from: "CPC Information Circular dated <DATE>, ..."
    - purpose text: "for the purpose of <...>."
    """
    body = body_text or ""

    m = re.search(
        r"cpc\s+information\s+circular\s+dated\s+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})",
        body,
        flags=re.IGNORECASE,
    )
    circular_date_iso = _parse_long_date(m.group(1)) if m else None

    m2 = re.search(
        r"for\s+the\s+purpose\s+of\s+(.+?)(?:\.\s|$)",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )
    purpose = None
    if m2:
        purpose = re.sub(r"\s+", " ", m2.group(1)).strip().rstrip(".") or None

    return circular_date_iso, purpose


def insert_event(row: Dict[str, Any]) -> None:
    headers = dict(HEADERS)
    headers["Prefer"] = "return=minimal"
    r = requests.post(_sb_url(TABLE_EVENTS), headers=headers, json=row, timeout=60)
    r.raise_for_status()


def main() -> None:
    if not COMPOSITE_KEY:
        raise RuntimeError("COMPOSITE_KEY env não informado.")
    composite_key = COMPOSITE_KEY.strip()

    b = fetch_bulletin_by_key(composite_key)

    company = b.get("company") or ""
    ticker = b.get("ticker") or ""
    bulletin_date = b.get("bulletin_date")  # ISO already in view

    body_text = b.get("body_text") or ""
    if not body_text.strip():
        raise RuntimeError("body_text vazio — não há o que parsear.")

    circular_date_iso, purpose = parse_information_circular(body_text)

    cpc_birth_id = find_cpc_birth_id(company, ticker)
    if not cpc_birth_id:
        raise RuntimeError(f"Não encontrei cpc_birth_id para company='{company}' ticker='{ticker}'.")

    summary = "CPC Information Circular accepted for filing."
    if circular_date_iso:
        summary = f"CPC Information Circular accepted for filing (circular dated {circular_date_iso})."

    event_row = {
        "cpc_birth_id": cpc_birth_id,
        "event_composite_key": composite_key,
        "event_type": "INFORMATION_CIRCULAR",
        "bulletin_date": bulletin_date,
        "event_effective_date": circular_date_iso or bulletin_date,
        "event_effective_time": None,
        "event_effective_text": purpose,
        "event_summary": summary,
        "event_body_raw": body_text,
        "parse_version": PARSER_PROFILE,
        "source_hash": _sha1(body_text),
    }

    insert_event(event_row)


if __name__ == "__main__":
    main()
