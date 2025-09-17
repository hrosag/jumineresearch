import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // garante apenas arquivos válidos
    const files = formData
      .getAll("files")
      .filter((f): f is File => f instanceof File);

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: "Nenhum arquivo enviado." },
        { status: 400 }
      );
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const savedFiles: string[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const savePath = path.join(UPLOAD_DIR, file.name);
      await fs.writeFile(savePath, buffer);

      // caminho público (será servido do /public/uploads)
      savedFiles.push(`/uploads/${file.name}`);
    }

    return NextResponse.json({
      success: true,
      count: savedFiles.length,
      savedFiles,
      message: "Arquivos salvos com sucesso!",
    });
  } catch (err: unknown) {
    console.error("❌ Erro no upload:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Erro interno",
      },
      { status: 500 }
    );
  }
}
