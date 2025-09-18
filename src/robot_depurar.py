import os
from datetime import datetime

import pandas as pd
from supabase import create_client

# ---------------------------------------------------------------------
# Variáveis de ambiente fornecidas pelo GitHub Actions
# ---------------------------------------------------------------------
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

# cria cliente Supabase com permissão de service key
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ---------------------------------------------------------------------
# Função que processa um único arquivo .txt e devolve lista de dicts
#   -> cada dict = uma linha para a tabela all_data
# ---------------------------------------------------------------------
def parse_txt(content: str, source_file: str) -> list[dict]:
    """
    Exemplo didático: assume que cada bloco de 2 linhas no TXT contém:
       1ª linha: nome da empresa
       2ª linha: ticker
    Ajuste esta função conforme a estrutura real dos boletins.
    """
    linhas = [l.strip() for l in content.splitlines() if l.strip()]
    registros = []
    block_id = 0
    for i in range(0, len(linhas), 2):
        try:
            company = linhas[i]
            ticker = linhas[i + 1] if i + 1 < len(linhas) else ""
        except IndexError:
            continue

        registros.append({
            "source_file": source_file,
            "block_id": block_id,
            "company": company,
            "ticker": ticker,
            "bulletin_type": "auto",            # ajuste conforme necessário
            "bulletin_date": datetime.utcnow().date().isoformat(),
            "tier": "parsed"
        })
        block_id += 1

    return registros

# ---------------------------------------------------------------------
# Função principal: lê todos os .txt no bucket "uploads" e grava no all_data
# ---------------------------------------------------------------------
def main():
    print("🚀 Iniciando depuração…")

    # lista arquivos no bucket "uploads"
    files = supabase.storage.from_("uploads").list()
    if not files:
        print("⚠️ Nenhum arquivo encontrado no bucket 'uploads'.")
        return

    total_registros = 0

    for f in files:
        if not f["name"].lower().endswith(".txt"):
            continue

        print(f"📂 Processando {f['name']}…")
        # baixa o conteúdo do arquivo
        data = supabase.storage.from_("uploads").download(f["name"])
        text = data.decode("utf-8")

        # faz o parse e monta os registros
        registros = parse_txt(text, f["name"])
        if not registros:
            print(f"⚠️ Nenhum registro extraído de {f['name']}.")
            continue

        # insere no Supabase
        supabase.table("all_data").insert(registros).execute()
        total_registros += len(registros)
        print(f"✅ {len(registros)} registro(s) inserido(s) de {f['name']}.")

    print(f"🏁 Concluído. Total de registros inseridos: {total_registros}")

# ---------------------------------------------------------------------
if __name__ == "__main__":
    main()
