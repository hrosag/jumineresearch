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
    # Ex.: "Prospectus dated September 26, 2008"
    m_prosp = re.search(
        r"Prospectus(?:.*)? dated ([A-Za-z]+\s+\d{1,2},\s*\d{4})",
        body,
        re.IGNORECASE | re.DOTALL,
    )
    prospectus_date = m_prosp.group(1) if m_prosp else None
    row["prospectus_date"] = prospectus_date
    row["prospectus_date_iso"] = normalize_date(prospectus_date)

    # Ex.: "... Commission effective September 29, 2008 ..."
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
    # Linha inteira após "Commence Date:"
    line_m = re.search(r"(?mi)^\s*Commence Date:(.*)$", body)
    commence_date_raw: str | None = None
    if line_m:
        line = line_m.group(1)

        # tenta extrair só o trecho "December 24, 2008"
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
    # Ex.: "The gross proceeds ... were $305,060 (3,050,600 common shares at $0.10 per share)."
    gp_match = re.search(
        r"gross proceeds.*?(?:were|was)\s*(\$\s?[\d,]+(?:\.\d{2})?)",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )
    gross_proceeds = gp_match.group(1) if gp_match else None
    row["gross_proceeds"] = gross_proceeds
    row["gross_proceeds_value"] = parse_numeric_value(gross_proceeds)

    sh_pr = re.search(
        r"\(([\d,]+)\s+common shares at \$?([\d\.]+)\s+per share\)",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if sh_pr:
        sh, pr = sh_pr.groups()
        # classe / volume de ações da oferta
        row["gross_proceeds_class"] = "common shares"
        row["gross_proceeds_class_volume"] = parse_integer_value(sh)
        row["gross_proceeds_volume_value"] = parse_integer_value(sh)
        row["gross_proceeds_value_per_share"] = parse_numeric_value(pr)
    else:
        # fallback genérico
        row["gross_proceeds_class"] = parse_currency_class(gross_proceeds)
        row["gross_proceeds_class_volume"] = parse_integer_value(gross_proceeds)
        row["gross_proceeds_volume_value"] = parse_integer_value(gross_proceeds)
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
        row["capitalization_volume"] = parse_integer_value(ios)
        row["capitalization_volume_value"] = parse_integer_value(ios)
        row["capitalization_class"] = "common shares"
    else:
        row["capitalization_volume"] = parse_integer_value(capitalization)
        row["capitalization_volume_value"] = parse_integer_value(capitalization)
        row["capitalization_class"] = parse_currency_class(capitalization)

    # -----------------------
    # Escrowed Shares
    # -----------------------
    escrow = extract_field(body, ["Escrowed Shares"])
    row["escrowed_shares"] = escrow
    row["escrowed_shares_value"] = parse_integer_value(escrow)
    row["escrowed_shares_class"] = parse_currency_class(escrow)

    # -----------------------
    # Transfer Agent / Trading Symbol / CUSIP / Sponsoring / Agent
    # -----------------------
    ta_raw = re.search(
        r"(?mi)^\s*Transfer Agent:\s*(.+)$",
        body,
    )
    ta = ta_raw.group(1).strip() if ta_raw else None
    if ta:
        ta = re.sub(r"\s*\(.*?\)\s*$", "", ta).strip()
    row["transfer_agent"] = ta

    ts = re.search(
        r"(?mi)^\s*Trading Symbol:\s*([A-Z0-9\.\-]+)",
        body,
    )
    row["trading_symbol"] = ts.group(1).strip() if ts else clean_space(
        rec.get("ticker", "")
    )

    cu = re.search(
        r"(?mi)^\s*CUSIP Number:\s*([A-Z0-9 ]+)",
        body,
    )
    row["cusip_number"] = cu.group(1).strip() if cu else None

    sm = re.search(
        r"(?mi)^\s*Sponsoring Member:\s*(.+)$",
        body,
    )
    row["sponsoring_member"] = sm.group(1).strip() if sm else None

    ag = re.search(
        r"(?mi)^\s*Agent:\s*(.+)$",
        body,
    )
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

        # texto completo, se quiser guardar
        row["agent_option"] = clean_space(ao_block) if ao_block else None

        # quantidade de opções
        qty_match = re.search(
            r"([\d,]+)\s+(?:non[ -]?transferable|transferable)\s+"
            r"(?:stock options|options|Agent's Options)",
            ao_block,
            flags=re.IGNORECASE,
        )
        qty = qty_match.group(1) if qty_match else None
        row["agent_option_value"] = parse_integer_value(qty)

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

        # duração (meses)
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

    # normalização final (None vs strings vazias, etc.)
    return normalize_row(row)
