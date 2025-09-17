import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get("file"); // deve vir como "uploads/arquivo.txt"

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Nome do arquivo não informado" },
        { status: 400 }
      );
    }

    console.log(`🔍 Simulando depuração para o arquivo (path completo): ${file}`);

    // Aqui no futuro será chamada a rotina Python (All_Data)
    await new Promise((resolve) => setTimeout(resolve, 2000)); // delay simulado

    return NextResponse.json({
      success: true,
      message: `Arquivo ${file} processado com sucesso!`,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("🔥 Erro no depurar:", errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage || "Erro interno" },
      { status: 500 }
    );
  }
}
