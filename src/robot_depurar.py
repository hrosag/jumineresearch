import os, re, unicodedata
import pandas as pd
import requests
from datetime import datetime
from supabase import create_client

# ---------------------------------------------------------------------
# Variáveis de ambiente fornecidas pelo GitHub Actions
# ---------------------------------------------------------------------
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
BUCKET = "uploads"

# ---------------------------------------------------------------------
# Regex e padrões
# ---------------------------------------------------------------------
BULLETIN_DATE_RE = re.compile(r'(BULLETIN DATE|NOTICE DATE):\s*(.+)', re.IGNORECASE)
TIER_RE          = re.compile(r'(TSX Venture Tier\s+\d+ Company|NEX Company)', re.IGNORECASE)
BLOCK_SPLITTER   = re.compile(r'\nTSX-X\s*\n\s*_+\s*\n|\n_{5,}\n', re.IGNORECASE)

# Mantidos para fallback
HEADER_PATTERNS = [
    re.compile(r'^(.+?)\s*\(\s*"?([A-Z0-9][A-Z0-9\.\-]*)"?\s*\)$', re.IGNORECASE),
    re.compile(r'^(.+?)\s*\(\s*(?:TSXV|TSX[-\s]?V)\s*:\s*([A-Z0-9][A-Z0-9\.\-]*)\s*\)$', re.IGNORECASE)
]

TICK_ANYWHERE = [
    re.compile(r'"([A-Z0-9][A-Z0-9\.\-]*)"'),
    re.compile(r'\(TSXV:\s*([A-Z0-9][A-Z0-9\.\-]*)\)')
]

# ---------------------------------------------------------------------
# Funções de normalização
# ---------------------------------------------------------------------
def normalize_date(raw: str) -> str | None:
    """Converte datas para YYYY-MM-DD (ISO, compatível com Postgres DATE)."""
    if not raw:
        return None
    raw = raw.strip().replace("  ", " ")
    formats = [
        "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%Y",
        "%d-%b-%Y", "%B %d, %Y", "%b %d, %Y"
    ]
    for fmt in formats:
        try:
            d = datetime.strptime(raw, fmt)
            return d.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None

def normalize_tier(raw: str) -> str | None:
    if not raw:
        return None
    txt = raw.lower()
    if "tier 1" in txt:
        return "Tier 1"
    if "tier 2" in txt:
        return "Tier 2"
    if "nex" in txt:
        return "Nex"
    return raw.strip()

# ---------------------------------------------------------------------
# Funções auxiliares
# ---------------------------------------------------------------------
def normalize_text(s: str) -> str:
    if s is None: return ""
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()

def parse_blocks(txt: str):
    t = txt.replace("\r\n", "\n").replace("\r", "\n")
    return [b.strip() for b in BLOCK_SPLITTER.split(t) if b.strip()]

def extract_company_ticker(body: str):
    """
    Extrai o nome da empresa e o primeiro ticker encontrado.
    - Remove seções do tipo [formerly ...]
    - Company = tudo antes da primeira aspa
    - Ticker = apenas o primeiro encontrado entre aspas
    """
    lines = [ln.strip() for ln in body.splitlines() if ln.strip()]
    if not lines:
        return None, None

    header = lines[0]

    # Remove brackets [formerly ...]
    header_clean = re.sub(r"\[formerly.*?\]", "", header, flags=re.IGNORECASE).strip()

    # Captura tickers entre aspas
    tickers = re.findall(r'"([A-Z0-9\.\-]+)"', header_clean)

    # Nome da empresa = antes da primeira aspa
    company = header_clean.split('"')[0].strip()

    # Apenas o primeiro ticker
    ticker = tickers[0].strip().upper() if tickers else None

    return company if company else None, ticker

def extract_bulletin_type(body: str) -> str | None:
    """Captura todas as linhas da seção BULLETIN TYPE/NOTICE TYPE até o próximo cabeçalho."""
    lines = body.splitlines()
    capturing = False
    collected = []
    for ln in lines:
        if ln.upper().startswith("BULLETIN TYPE:") or ln.upper().startswith("NOTICE TYPE:"):
            capturing = True
            collected.append(ln.split(":", 1)[1].strip())
            continue
        if capturing:
            if re.match(r"^[A-Z ]+:", ln):  # próxima seção
                break
            collected.append(ln.strip())
    if not collected:
        return None
    return " ".join(collected).replace(" ,", ",").strip()

def parse_one_block(b: str, source_file: str, block_id: int) -> dict:
    body = normalize_text(b)
    company, ticker = extract_company_ticker(body)
    mdate = BULLETIN_DATE_RE.search(body)
    mtier = TIER_RE.search(body)
    return {
        "source_file": source_file.split("-")[-1],
        "block_id": block_id,
        "company": company,
        "ticker": ticker,
        "bulletin_type": extract_bulletin_type(body),
        "bulletin_date": normalize_date(mdate.group(2)) if mdate else None,
        "tier": normalize_tier(mtier.group(1)) if mtier else None,
        "body_text": body,
        "composite_key": f"{source_file.split('-')[-1]}-{block_id}"
    }

# ---------------------------------------------------------------------
# Pipeline principal
# ---------------------------------------------------------------------
def main():
    print("🚀 Iniciando depuração dos arquivos do bucket…")

    files = supabase.storage.from_(BUCKET).list()
    if not files:
        print("⚠️ Nenhum arquivo encontrado no bucket 'uploads'.")
        return

    rows = []
    for f in files:
        if not f["name"].lower().endswith(".txt"):
            continue

        url = supabase.storage.from_(BUCKET).get_public_url(f["name"])
        print(f"📂 Processando {f['name']}")
        resp = requests.get(url)
        resp.raise_for_status()
        txt = resp.text

        for i, b in enumerate(parse_blocks(txt), start=1):
            rows.append(parse_one_block(b, f["name"], i))

    if not rows:
        print("⚠️ Nenhum bloco processado.")
        return

    df = pd.DataFrame(rows)
    print(f"✅ Total de blocos processados: {len(df)}")

    data = df.to_dict(orient="records")
    res = supabase.table("all_data").upsert(
        data,
        on_conflict=["composite_key"]
    ).execute()

    if getattr(res, "error", None):
        print("❌ Erro no upsert:", res.error)
    else:
        print("🚀 Upsert concluído com sucesso!")

if __name__ == "__main__":
    main()
