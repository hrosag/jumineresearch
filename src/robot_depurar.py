import os, re, unicodedata
import pandas as pd
import requests
from datetime import datetime      # <<< ADIÇÃO >>>
from supabase import create_client

# ---------------------------------------------------------------------
# Variáveis de ambiente fornecidas pelo GitHub Actions
# ---------------------------------------------------------------------
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
BUCKET = "uploads"

# ---------------------------------------------------------------------
# Regex e padrões – exatamente como no Python_Depurar original
# ---------------------------------------------------------------------
BULLETIN_TYPE_RE = re.compile(r'BULLETIN TYPE:\s*(.+)', re.IGNORECASE)
BULLETIN_DATE_RE = re.compile(r'BULLETIN DATE:\s*(.+)', re.IGNORECASE)
TIER_RE          = re.compile(r'(TSX Venture Tier\s+\d+ Company|NEX Company)', re.IGNORECASE)
BLOCK_SPLITTER   = re.compile(r'\nTSX-X\s*\n\s*_+\s*\n|\n_{5,}\n', re.IGNORECASE)

HEADER_PATTERNS = [
    re.compile(r'^(.+?)\s*\(\s*"?([A-Z0-9][A-Z0-9\.\-]*)"?\s*\)$', re.IGNORECASE),
    re.compile(r'^(.+?)\s*\(\s*(?:TSXV|TSX[-\s]?V)\s*:\s*([A-Z0-9][A-Z0-9\.\-]*)\s*\)$', re.IGNORECASE)
]
TICK_ANYWHERE = [
    re.compile(r'"([A-Z0-9][A-Z0-9\.\-]*)"'),
    re.compile(r'\(TSXV:\s*([A-Z0-9][A-Z0-9\.\-]*)\)')
]

# ---------------------------------------------------------------------
# <<< ADIÇÃO >>> Funções de normalização
# ---------------------------------------------------------------------
def normalize_date(raw: str) -> str | None:
    """Converte várias formas de data para DD/MM/AAAA."""
    if not raw:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%Y"):
        try:
            d = datetime.strptime(raw.strip(), fmt)
            return d.strftime("%d/%m/%Y")
        except ValueError:
            continue
    return raw.strip()

def normalize_tier(raw: str) -> str | None:
    """Reduz descrição longa para Tier 1, Tier 2 ou Nex."""
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
    lines = [ln.strip() for ln in body.splitlines() if ln.strip()]
    for ln in lines[:5]:
        for pat in HEADER_PATTERNS:
            m = pat.match(ln)
            if m:
                return m.group(1).strip(), m.group(2).strip().upper()
    for pat in TICK_ANYWHERE:
        m = pat.search(body)
        if m:
            return None, m.group(1).strip().upper()
    return None, None

def parse_one_block(b: str, source_file: str, block_id: int) -> dict:
    body = normalize_text(b)
    company, ticker = extract_company_ticker(body)
    mtype = BULLETIN_TYPE_RE.search(body)
    mdate = BULLETIN_DATE_RE.search(body)
    mtier = TIER_RE.search(body)
    return {
        # <<< ADIÇÃO >>> — só nome limpo do arquivo
        "source_file": source_file.split("-")[-1],
        "block_id": block_id,
        "company": company,
        "ticker": ticker,
        "bulletin_type": mtype.group(1).strip() if mtype else None,
        # <<< ADIÇÃO >>> normalização de data e tier
        "bulletin_date": normalize_date(mdate.group(1)) if mdate else None,
        "tier": normalize_tier(mtier.group(1)) if mtier else None,
        "body_text": body,
        # composite_key para upsert idempotente
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
