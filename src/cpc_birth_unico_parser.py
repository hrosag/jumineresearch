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
    """
    Conversão genérica para valores com casas decimais (ex.: preço por ação).
    Não deve ser usada para campos que precisam ser inteiros (volume, proceeds).
    """
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
    # fallback para texto depois do número
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
        r"\$\s*([0-9,.]+)\s*(?:per share|per common share)",
        text,
        re.IGNORECASE,
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
    Parser para NEW LISTING-CPC-SHARES 'Unico',
    alinhado com o parser v13b (planilha).
    rec vem da view vw_bulletins_with_canonical.
    """

    ctype = (rec.get("canonical_type") or "").upper()
    cclass = (rec.get("canonical_class") or "").capitalize()

    # apenas NEW LISTING-CPC-SHARES Unico
    if "NEW LISTING-CPC-SHARES" not in ctype or cclass != "Unico":
        return None

    row = {f: None for f in FIELDS}

    # campos básicos
    row["company_name"] = clean_space(
        rec.get("company_name", "") or rec.get("company", "")
    )
    row["ticker"] = clean_space(rec.get("ticker", ""))
    row["composite_key"] = rec["composite_key"]
    row["canonical_type"] = "NEW LISTING-CPC-SHARES"
    row["bulletin_date"] = rec.get("bulletin_date")
    row["tier"] = clean_space(rec.get("tier", ""))

    body = rec.get("body_text", "") or ""

    # -----------------------
    # Prospectus / Effective
    # -----------------------
    # "Prospectus dated September 26, 2008"
    m_prosp = re.search(
        r"Prospectus(?:.*)? dated ([A-Za-z]+\s+\d{1,2},\s*\d{4})",
        body,
        re.IGNORECASE | re.DOTALL,
    )
    prospectus_date = m_prosp.group(1) if m_prosp else None
    row["prospectus_date"] = prospectus_date
    row["prospectus_date_iso"] = normalize_date(prospectus_date)

    # "... effective September 29, 2008 ..."
    effs = re.findall(
        r"effective\s+([A-Za-z]+\s+\d{1,2},\s*\d{4})",
        body,
        flags=re.IGNORECASE,
    )
    effective_date = effs[-1] if effs else None
    row["effective_date"] = effective_date
    row["effective_date_iso"] = normalize_date(effective_date)

    # -----------------------
    # Commence Date
    # -----------------------
    line_m = re.search(r"(?mi)^\s*Commence Date:(.*)$", body)
    commence_date_raw: str | None = None
    if line_m:
        line = line_m.group(1)

        p1 = re.search(
            r"(?:on\s+)?(?:Mon|Tues|Tue|Wed|Thu|Thur|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*,?\s*([A-Za-z]+\s+\d{1,2}(?:,\s*\d{4}| \d{4}))",
            line,
            flags=re.IGNORECASE,
        )
        p2 = re.search(
            r"([A-Za-z]+\s+\d{1,2}(?:,\s*\d{4}| \d{4}))",
            line,
            flags=re.IGNORECASE,
        )
        p3 = re.search(
            r"([A-Za-z]+\s+\d{1,2})(?!,?\s*\d{4})",
            line,
            flags=re.IGNORECASE,
        )

        for p in (p1, p2, p3):
            if p:
                commence_date_raw = p.group(1).strip()
                break

    row["commence_date"] = commence_date_raw
    row["commence_date_iso"] = normalize_date(commence_date_raw)

    # -----------------------
    # Corporate Jurisdiction
    # -----------------------
    row["corporate_jurisdiction"] = extract_field(body, ["Corporate Jurisdiction"])

    # -----------------------
    # Gross Proceeds
    # -----------------------
    gp_match = re.search(
        r"gross proceeds.*?(?:were|was)\s*(\$\s?[\d,]+(?:\.\d{2})?)",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )
    gross_proceeds = gp_match.group(1) if gp_match else None
    row["gross_proceeds"] = gross_proceeds
    # valor numérico inteiro, sem .0
    row["gross_proceeds_value"] = parse_integer_value(gross_proceeds)

    sh_pr = re.search(
        r"\(([\d,]+)\s+common shares at \$?([\d\.]+)\s+per share\)",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if sh_pr:
        sh, pr = sh_pr.groups()
        # sh vem como "3,050,600" → manter assim no class_volume (texto)
        row["gross_proceeds_class"] = "common shares"
        row["gross_proceeds_class_volume"] = clean_space(sh)
        row["gross_proceeds_volume_value"] = parse_integer_value(sh)
        row["gross_proceeds_value_per_share"] = parse_numeric_value(pr)
    else:
        row["gross_proceeds_class"] = parse_currency_class(gross_proceeds)
        vol_int = parse_integer_value(gross_proceeds)
        if vol_int is not None:
            row["gross_proceeds_class_volume"] = f"{vol_int:,}"
            row["gross_proceeds_volume_value"] = vol_int
        else:
            row["gross_proceeds_class_volume"] = None
            row["gross_proceeds_volume_value"] = None
        row["gross_proceeds_value_per_share"] = extract_price_per_share(gross_proceeds)

    # -----------------------
    # Capitalization
    # -----------------------
    capitalization = extract_field(body, ["Capitalization"])
    row["capitalization"] = capitalization

    ios_match = re.search(
        r"([\d,]+)\s+common shares are issued and outstanding",
        body,
        flags=re.IGNORECASE,
    )
    if ios_match:
        ios = ios_match.group(1)
        # ios vem como "5,390,600" → manter assim no volume (texto)
        row["capitalization_volume"] = clean_space(ios)
        row["capitalization_volume_value"] = parse_integer_value(ios)
        row["capitalization_class"] = "common shares"
    else:
        vol_int = parse_integer_value(capitalization)
        if vol_int is not None:
            row["capitalization_volume"] = f"{vol_int:,}"
            row["capitalization_volume_value"] = vol_int
        else:
            row["capitalization_volume"] = None
            row["capitalization_volume_value"] = None
        row["capitalization_class"] = parse_currency_class(capitalization)

    # -----------------------
    # Escrowed Shares
    # -----------------------
    escrow_line = extract_field(body, ["Escrowed Shares"])
    qty_str = None
    escrow_class = None

    if escrow_line:
        # ex.: "2,340,000 common shares"
        m_esc = re.search(r"([\d,]+)\s+(.+)", escrow_line)
        if m_esc:
            qty_str = m_esc.group(1)
            escrow_class = m_esc.group(2).strip()
        else:
            qty_str = escrow_line

    row["escrowed_shares"] = qty_str
    row["escrowed_shares_value"] = parse_integer_value(qty_str)
    row["escrowed_shares_class"] = escrow_class or (
        parse_currency_class(escrow_line) if escrow_line else None
    )

    # -----------------------
    # Transfer Agent / Trading Symbol / CUSIP / Sponsoring / Agent
    # -----------------------
    ta_raw = re.search(r"(?mi)^\s*Transfer Agent:\s*(.+)$", body)
    ta = ta_raw.group(1).strip() if ta_raw else None
    if ta:
        ta = re.sub(r"\s*\(.*?\)\s*$", "", ta).strip()
    row["transfer_agent"] = ta

    ts = re.search(r"(?mi)^\s*Trading Symbol:\s*([A-Z0-9\.\-]+)", body)
    row["trading_symbol"] = ts.group(1).strip() if ts else clean_space(
        rec.get("ticker", "")
    )

    cu = re.search(r"(?mi)^\s*CUSIP Number:\s*([A-Z0-9 ]+)", body)
    row["cusip_number"] = cu.group(1).strip() if cu else None

    sm = re.search(r"(?mi)^\s*Sponsoring Member:\s*(.+)$", body)
    row["sponsoring_member"] = sm.group(1).strip() if sm else None

    ag = re.search(r"(?mi)^\s*Agent:\s*(.+)$", body)
    row["agent"] = ag.group(1).strip() if ag else None

    # -----------------------
    # Agent's Options
    # -----------------------
    if re.search(r"Agent's Options:\s*none", body, re.IGNORECASE):
        row["agent_option"] = "none"
        row["agent_option_value"] = 0
        row["agent_option_class"] = None
        row["agent_option_price_per_share"] = None
        row["agents_options_duration_months"] = 0
    else:
        ao_block_match = re.search(
            r"Agent's Options:\s*(.+?)(?:\n\n|$)",
            body,
            flags=re.IGNORECASE | re.DOTALL,
        )
        ao_block = ao_block_match.group(1) if ao_block_match else ""

        # quantidade de opções
        qty_match = re.search(
            r"([\d,]+)\s+(?:non[ -]?transferable|transferable)\s+"
            r"(?:stock options|options|Agent's Options)",
            ao_block,
            flags=re.IGNORECASE,
        )
        qty_str = qty_match.group(1) if qty_match else None

        row["agent_option"] = qty_str
        row["agent_option_value"] = parse_integer_value(qty_str)

        # classe das opções
        klass_match = re.search(
            r"\b((?:non[ -]?transferable|transferable)\s+"
            r"(?:stock options|options|Agent's Options))",
            ao_block,
            flags=re.IGNORECASE,
        )
        row["agent_option_class"] = (
            klass_match.group(1).strip() if klass_match else None
        )

        # preço por ação
        price_match = re.search(
            r"(?:one|each)\s+(?:common\s+)?share\s+"
            r"(?:at|at an exercise price of|exercisable at)\s*"
            r"\$([\d\.]+)\s+per\s+(?:common\s+)?share",
            ao_block,
            flags=re.IGNORECASE,
        )
        row["agent_option_price_per_share"] = (
            float(price_match.group(1)) if price_match else None
        )

        # duração
        dur_match = re.search(
            r"(?:for|for a period of|for up to|up to|exercisable for)"
            r"(?:\s+a\s+period\s+of)?\s+(\d{1,3})\s*months?",
            ao_block,
            flags=re.IGNORECASE,
        )
        if dur_match:
            row["agents_options_duration_months"] = int(dur_match.group(1))
        else:
            row["agents_options_duration_months"] = (
                extract_months(ao_block) or extract_months(body)
            )

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

    if COMPOSITE_KEY:
        params["composite_key"] = f"eq.{COMPOSITE_KEY}"

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
    # se tiver unique em composite_key, isso evita 409
    params = {"on_conflict": "composite_key"}
    resp = requests.post(
        url, headers=headers, params=params, data=json.dumps(rows), timeout=60
    )

    if not resp.ok:
        print("Erro ao inserir em cpc_birth:", resp.status_code, resp.text)
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


def main() -> None:
    records = fetch_marked_rows()
    ids_all: List[int] = [r.get(\"id\") for r in records if r.get(\"id\") is not None]

    if ids_all:
        mark_running([int(x) for x in ids_all])

    print(f"{len(records)} registros marcados para CPC birth Unico.")

    rows_cpc: List[Dict[str, Any]] = []
    ids: List[int] = []
    for rec in records:
        rid = rec.get("id")
        try:
            row = parse_cpc_birth_unico(rec)
            if row:
                rows_cpc.append(row)
                ids.append(rec["id"])

        except Exception as e:
            if rid is not None:
                print("Erro ao processar registro; marcando error:", rid, str(e))
                mark_error(int(rid))
    if not rows_cpc:
        print("Nada para inserir em cpc_birth.")
        return

    upsert_cpc_birth(rows_cpc)
    mark_done(ids)
    print("Concluído.")

if __name__ == "__main__":
    main()
