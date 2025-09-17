import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Pasta onde vamos salvar os arquivos enviados
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function POST(req: Request) {
  try {
    // Lê os arquivos enviados no body (FormData)
    const formData = await req.formData();
    const files = formData.getAll("files").filter(f => f instanceof File) as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: "Nenhum arquivo enviado." },
        { status: 400 }
      );
    }

    // Garante que a pasta existe
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const savedFiles: string[] = [];

    // Salva cada arquivo no disco
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const savePath = path.join(UPLOAD_DIR, file.name);
      await fs.writeFile(savePath, buffer);
      savedFiles.push(`/uploads/${file.name}`); // caminho público
    }

    return NextResponse.json({
      success: true,
      count: savedFiles.length,
      savedFiles,
      message: "✅ Arquivos salvos com sucesso!",
    });
  } catch (err: any) {
    console.error("❌ Erro no upload:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Erro interno" },
      { status: 500 }
    );
  }
}
