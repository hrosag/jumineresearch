import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get("file");

    console.log("🔍 DEPURAR chamado");
    console.log("📌 Param file recebido:", file);

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Nome do arquivo não informado" },
        { status: 400 }
      );
    }

    console.log(`🔍 Simulando depuração para o arquivo: ${file}`);

    // futuro → chamar rotina Python
    await new Promise((resolve) => setTimeout(resolve, 2000));

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
