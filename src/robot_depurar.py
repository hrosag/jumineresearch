import json
import os
import re
from datetime import datetime
from typing import Iterable

import requests


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
    "parse_version",
]


INPUT_JSON = "cpc_birth_unico_input.json"
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
TABLE_NAME = "cpc_birth"
PARSE_VERSION = "cpc_birth_unico_v1"


DATE_FORMATS: list[str] = [
    "%Y-%m-%d",
    "%d-%m-%Y",
    "%Y/%m/%d",
    "%d/%m/%Y",
    "%d-%b-%Y",
    "%B %d, %Y",
    "%b %d, %Y",
]


def clean_space(value: str | None) -> str:
    if value is None:
        return ""
    return re.sub(r"[ \t]+", " ", value).strip()


def normalize_date(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = clean_space(raw)
    raw = re.sub(r",(\d{4})", r", \1", raw)
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_numeric_value(text: str | None) -> float | None:
    if not text:
        return None
    m = re.search(r"([-+]?[0-9][0-9,]*\.?[0-9]*)", text)
    if not m:
        return None
    cleaned = m.group(1).replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_integer_value(text: str | None) -> int | None:
    if not text:
        return None
    m = re.search(r"([0-9][0-9,]*)", text)
    if not m:
        return None
    try:
        return int(m.group(1).replace(",", ""))
    except ValueError:
        return None


def parse_currency_class(text: str | None) -> str | None:
    if not text:
        return None
    upper = text.upper()
    if "CAD" in upper or "C$" in upper:
        return "CAD"
    if "USD" in upper or "US$" in upper or "U$" in upper:
        return "USD"
    if "$" in text:
        return "CAD"
    return None


def extract_field(body: str, labels: Iterable[str]) -> str | None:
    for label in labels:
        pattern = re.compile(rf"{label}\s*:\s*(.+)", re.IGNORECASE)
        m = pattern.search(body)
        if m:
            return clean_space(m.group(1))
    return None


def extract_price_per_share(text: str | None) -> float | None:
    if not text:
        return None
    m = re.search(r"\$\s*([0-9][0-9,]*\.?[0-9]*)\s*(?:per|/)?\s*(?:share|unit)?", text, re.IGNORECASE)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


def extract_months(text: str | None) -> int | None:
    if not text:
        return None
    m = re.search(r"([0-9]{1,3})\s*month", text, re.IGNORECASE)
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def normalize_row(row: dict) -> dict:
    normalized: dict = {}
    for key, value in row.items():
        if isinstance(value, str):
            cleaned = clean_space(value)
            normalized[key] = cleaned if cleaned else None
        else:
            normalized[key] = value
    return normalized


def parse_cpc_birth_unico(rec: dict) -> dict | None:
    ctype = (rec.get("canonical_type") or "").upper()
    cclass = (rec.get("canonical_class") or "").capitalize()
    if "NEW LISTING-CPC-SHARES" not in ctype or cclass != "Unico":
        return None

    row = {field: None for field in FIELDS}

    row["company_name"] = clean_space(rec.get("company_name", "") or rec.get("company", ""))
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

    commence_date = extract_field(body, ["Commence Date", "Commence Trading Date"])
    row["commence_date"] = commence_date
    row["commence_date_iso"] = normalize_date(commence_date)

    gross_proceeds_text = extract_field(body, ["Gross Proceeds"])
    row["gross_proceeds"] = gross_proceeds_text
    row["gross_proceeds_value"] = parse_numeric_value(gross_proceeds_text)
    row["gross_proceeds_class"] = parse_currency_class(gross_proceeds_text)
    row["gross_proceeds_class_volume"] = None
    row["gross_proceeds_volume_value"] = parse_integer_value(gross_proceeds_text)
    row["gross_proceeds_value_per_share"] = extract_price_per_share(gross_proceeds_text)

    row["corporate_jurisdiction"] = extract_field(body, ["Corporate Jurisdiction", "Incorporation"])

    capitalization_text = extract_field(body, ["Capitalization"])
    row["capitalization"] = capitalization_text
    row["capitalization_volume"] = None
    row["capitalization_volume_value"] = parse_integer_value(capitalization_text)
    row["capitalization_class"] = None

    escrowed_text = extract_field(body, ["Escrowed Shares", "Escrow"])
    row["escrowed_shares"] = escrowed_text
    row["escrowed_shares_value"] = parse_integer_value(escrowed_text)
    row["escrowed_shares_class"] = None

    row["transfer_agent"] = extract_field(body, ["Transfer Agent"])
    row["trading_symbol"] = extract_field(body, ["Trading Symbol", "Symbol"])
    row["cusip_number"] = extract_field(body, ["CUSIP", "CUSIP Number"])
    row["sponsoring_member"] = extract_field(body, ["Sponsoring Member"])

    agent_text = extract_field(body, ["Agent"])
    row["agent"] = agent_text

    agent_option_text = extract_field(body, ["Agent's Option", "Agents' Option", "Agent Option"])
    row["agent_option"] = agent_option_text
    row["agent_option_value"] = parse_numeric_value(agent_option_text)
    row["agent_option_class"] = None
    row["agent_option_price_per_share"] = extract_price_per_share(agent_option_text)
    row["agents_options_duration_months"] = extract_months(agent_option_text)

    row["parse_version"] = PARSE_VERSION

    return normalize_row(row)


def load_records_from_json(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    records: list[dict] = []
    for rec in data:
        ctype = (rec.get("canonical_type") or "").upper()
        cclass = (rec.get("canonical_class") or "").capitalize()
        status = (rec.get("parser_status") or "").lower()
        if "NEW LISTING-CPC-SHARES" in ctype and cclass == "Unico" and status != "done":
            records.append(rec)
    return records


def upsert_cpc_birth(rows: list[dict]):
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados; pulando upsert.")
        return

    url = f"{SUPABASE_URL}/rest/v1/{TABLE_NAME}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    batch_size = 100
    for i in range(0, len(rows), batch_size):
        chunk = rows[i : i + batch_size]
        resp = requests.post(url, headers=headers, data=json.dumps(chunk))
        resp.raise_for_status()
        print(f"Upsert cpc_birth {i}–{i+len(chunk)-1} OK")


def main():
    records = load_records_from_json(INPUT_JSON)
    print(f"{len(records)} registros de entrada para CPC birth (Unico).")

    rows: list[dict] = []
    for rec in records:
        row = parse_cpc_birth_unico(rec)
        if row:
            rows.append(row)

    print(f"{len(rows)} linhas parseadas; enviando para Supabase...")
    upsert_cpc_birth(rows)
    print("Concluído.")


if __name__ == "__main__":
    main()
