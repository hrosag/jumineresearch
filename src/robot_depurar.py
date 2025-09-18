import os
from supabase import create_client
import pandas as pd

# Lê variáveis de ambiente do GitHub Actions
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def main():
    # TODO: aqui entra a lógica real de “depurar” os .txt
    # por enquanto só grava um registro de teste na tabela all_data
    supabase.table("all_data").insert({
        "source_file": "teste.txt",
        "block_id": 0,
        "company": "Dummy Co",
        "ticker": "DUM",
        "bulletin_type": "teste",
        "bulletin_date": "2025-09-18",
        "tier": "sandbox"
    }).execute()

if __name__ == "__main__":
    main()
