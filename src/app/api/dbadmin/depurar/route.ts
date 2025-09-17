// src/app/api/dbadmin/depurar/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get("file");

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Nome do arquivo não informado" },
        { status: 400 }
      );
    }

    console.log(`🔍 Simulando depuração para o arquivo: ${file}`);

    // 👉 Aqui no futuro será chamada do Python (All_Data)
    await new Promise((resolve) => setTimeout(resolve, 2000)); // simulação de delay

    return NextResponse.json({
      success: true,
      message: `Arquivo ${file} processado com sucesso!`,
    });
  } catch (err: any) {
    console.error("🔥 Erro no depurar:", err.message || err);
    return NextResponse.json(
      { success: false, error: err.message || "Erro interno" },
      { status: 500 }
    );
  }
}
