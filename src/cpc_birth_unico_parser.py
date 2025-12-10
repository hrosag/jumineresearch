import os
import re
import json
from datetime import datetime
from typing import Iterable, List, Dict, Any

import requests

# 1) Constantes / config
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
VIEW_NAME = "vw_bulletins_with_canonical"
TABLE_NAME = "cpc_birth"

COMPOSITE_KEY = os.environ.get("COMPOSITE_KEY")
PARSER_PROFILE_ENV = os.environ.get("PARSER_PROFILE") or "cpc_birth"

FIELDS = [
    "company_name",
    "ticker",
    "composite_key",
    "canonical_type",
    "bulletin_date",
    "tier",
    "prospectus_date",
    "prospectus_date_iso",
    "effective_date",
    "effective_date_iso",
    "gross_proceeds",
    "gross_proceeds_value",
    "gross_proceeds_class",
    "gross_proceeds_class_volume",
    "gross_proceeds_volume_value",
    "gross_proceeds_value_per_share",
    "commence_date",
    "commence_date_iso",
    "corporate_jurisdiction",
    "capitalization",
    "capitalization_volume",
    "capitalization_volume_value",
    "capitalization_class",
    "escrowed_shares",
    "escrowed_shares_value",
    "escrowed_shares_class",
    "transfer_agent",
    "trading_symbol",
    "cusip_number",
    "sponsoring_member",
    "agent",
    "agent_option",
    "agent_option_value",
    "agent_option_class",
    "agent_option_price_per_share",
    "agents_options_duration_months",
]


def clean_space(value: str | None) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def normalize_date(raw: str | None) -> str | None:
    if not raw:
        return None

    text = clean_space(raw)
    patterns = [
        "%B %d, %Y",
        "%b %d, %Y",
        "%d %B %Y",
        "%d %b %Y",
        "%Y-%m-%d",
        "%d-%b-%Y",
        "%d-%m-%Y",
        "%m/%d/%Y",
        "%m/%d/%y",
    ]

    for fmt in patterns:
        try:
            dt = datetime.strptime(text, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_numeric_value(text: str | None) -> float | None:
    if not text:
        return None

    cleaned = re.sub(r"[^0-9.\-]", "", text)
    if cleaned in {"", ".", "-", "--"}:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_integer_value(text: str | None) -> int | None:
    if not text:
        return None
    cleaned = re.sub(r"[^0-9]", "", text)
    if cleaned == "":
        return None
    try:
        return int(cleaned)
    except ValueError:
        return None


def parse_currency_class(text: str | None) -> str | None:
    if not text:
        return None
    match = re.search(r"\$[0-9,.]+\s+([^.;]+)", text)
    if match:
        return clean_space(match.group(1))
    # fallback to text after numeric portion
    match = re.search(r"[0-9,.]+\s+([^.;]+)", text)
    if match:
        return clean_space(match.group(1))
    return None


def extract_field(body: str, labels: Iterable[str]) -> str | None:
    for label in labels:
        pattern = rf"{re.escape(label)}\s*[:\-–—]\s*(.+)"
        match = re.search(pattern, body, re.IGNORECASE)
        if match:
            return clean_space(match.group(1))
    return None


def extract_price_per_share(text: str | None) -> float | None:
    if not text:
        return None
    match = re.search(
        r"\$\s*([0-9,.]+)\s*(?:per share|per common share)", text, re.IGNORECASE
    )
    if match:
        try:
            return float(match.group(1).replace(",", ""))
        except ValueError:
            return None
    return None


def extract_months(text: str | None) -> int | None:
    if not text:
        return None
    match = re.search(r"(\d+)\s*month", text, re.IGNORECASE)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return None
    return None


def normalize_row(row: dict) -> dict:
    normalized: dict[str, Any] = {}
    for field in FIELDS:
        value = row.get(field)
        if isinstance(value, str):
            value = clean_space(value)
            if value == "":
                value = None
        normalized[field] = value
    return normalized


def parse_cpc_birth_unico(rec: Dict[str, Any]) -> Dict[str, Any] | None:
    """
    rec vem da view vw_bulletins_with_canonical.
    """

    ctype = (rec.get("canonical_type") or "").upper()
    cclass = (rec.get("canonical_class") or "").capitalize()

    if "NEW LISTING-CPC-SHARES" not in ctype or cclass != "Unico":
        return None

    row = {f: None for f in FIELDS}

    row["company_name"] = clean_space(
        rec.get("company_name", "") or rec.get("company", "")
    )
    row["ticker"] = clean_space(rec.get("ticker", ""))
    row["composite_key"] = rec["composite_key"]
    row["canonical_type"] = "NEW LISTING-CPC-SHARES"
    row["bulletin_date"] = rec.get("bulletin_date")
    row["tier"] = clean_space(rec.get("tier", ""))

    body = rec.get("body_text", "") or ""

    prospectus_date = extract_field(body, ["Prospectus Date"])
    row["prospectus_date"] = prospectus_date
    row["prospectus_date_iso"] = normalize_date(prospectus_date)

    effective_date = extract_field(body, ["Effective Date"])
    row["effective_date"] = effective_date
    row["effective_date_iso"] = normalize_date(effective_date)

    commence_date = extract_field(body, ["Commence Date"])
    row["commence_date"] = commence_date
    row["commence_date_iso"] = normalize_date(commence_date)

    row["corporate_jurisdiction"] = extract_field(body, ["Corporate Jurisdiction"])

    gross_proceeds = extract_field(
        body, ["Gross Proceeds", "Gross Proceeds to the Company"]
    )
    row["gross_proceeds"] = gross_proceeds
    row["gross_proceeds_value"] = parse_numeric_value(gross_proceeds)
    row["gross_proceeds_class"] = parse_currency_class(gross_proceeds)
    row["gross_proceeds_class_volume"] = parse_integer_value(gross_proceeds)
    row["gross_proceeds_volume_value"] = parse_integer_value(gross_proceeds)
    row["gross_proceeds_value_per_share"] = extract_price_per_share(gross_proceeds)

    capitalization = extract_field(body, ["Capitalization"])
    row["capitalization"] = capitalization
    row["capitalization_volume"] = parse_integer_value(capitalization)
    row["capitalization_volume_value"] = parse_integer_value(capitalization)
    row["capitalization_class"] = parse_currency_class(capitalization)

    escrow = extract_field(body, ["Escrowed Shares"])
    row["escrowed_shares"] = escrow
    row["escrowed_shares_value"] = parse_integer_value(escrow)
    row["escrowed_shares_class"] = parse_currency_class(escrow)

    row["transfer_agent"] = extract_field(body, ["Transfer Agent"])
    row["trading_symbol"] = extract_field(body, ["Trading Symbol"])
    row["cusip_number"] = extract_field(body, ["CUSIP Number"])
    row["sponsoring_member"] = extract_field(body, ["Sponsoring Member"])

    agent = extract_field(body, ["Agent"])
    row["agent"] = agent
    agent_option = extract_field(
        body, ["Agent Option", "Agent's Option", "Agents Option"]
    )
    row["agent_option"] = agent_option
    row["agent_option_value"] = parse_numeric_value(agent_option)
    row["agent_option_class"] = parse_currency_class(agent_option)
    row["agent_option_price_per_share"] = extract_price_per_share(agent_option)

    duration_months = extract_months(agent_option) or extract_months(body)
    row["agents_options_duration_months"] = duration_months

    return normalize_row(row)


def fetch_marked_rows():
    url = f"{SUPABASE_URL}/rest/v1/{VIEW_NAME}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    params: Dict[str, Any] = {
        "select": "id,company,ticker,composite_key,canonical_type,canonical_class,bulletin_date,tier,body_text,parser_profile,parser_status",
    }

    # se veio composite_key do workflow, filtra por ela
    if COMPOSITE_KEY:
        params["composite_key"] = f"eq.{COMPOSITE_KEY}"

    # exige que esteja marcado com o parser certo e em ready
    params["parser_profile"] = f"eq.{PARSER_PROFILE_ENV}"
    params["parser_status"] = "eq.ready"

    resp = requests.get(url, headers=headers, params=params, timeout=60)
    resp.raise_for_status()
    return resp.json()


def upsert_cpc_birth(rows: List[Dict[str, Any]]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{TABLE_NAME}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    resp = requests.post(url, headers=headers, data=json.dumps(rows), timeout=60)
    resp.raise_for_status()


def mark_done(ids: List[int]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/all_data"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    for id_ in ids:
        payload = {
            "parser_status": "done",
            "parser_parsed_at": datetime.utcnow().isoformat(),
        }
        resp = requests.patch(
            f"{url}?id=eq.{id_}", headers=headers, data=json.dumps(payload), timeout=60
        )
        resp.raise_for_status()


def main() -> None:
    records = fetch_marked_rows()
    print(f"{len(records)} registros marcados para CPC birth Unico.")

    rows_cpc: List[Dict[str, Any]] = []
    ids: List[int] = []
    for rec in records:
        row = parse_cpc_birth_unico(rec)
        if row:
            rows_cpc.append(row)
            ids.append(rec["id"])

    if not rows_cpc:
        print("Nada para inserir em cpc_birth.")
        return

    upsert_cpc_birth(rows_cpc)
    mark_done(ids)
    print("Concluído.")


if __name__ == "__main__":
    main()
