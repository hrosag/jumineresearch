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

    // Dispara workflow do GitHub que roda o script Python
    const ghResp = await fetch(
      "https://api.github.com/repos/hrosag/jumineresearch/actions/workflows/depurar.yml/dispatches",
      {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
        },
        body: JSON.stringify({
          ref: "main",
          inputs: { file }  // <- input definido no depurar.yml
        }),
      }
    );

    if (!ghResp.ok) {
      const text = await ghResp.text();
      throw new Error(`Falha ao disparar workflow: ${text}`);
    }

    return NextResponse.json({
      success: true,
      message: `Workflow de depuração disparado para ${file}`,
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
