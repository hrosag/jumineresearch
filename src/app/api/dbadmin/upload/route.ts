import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Inicializa Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: "Nenhum arquivo enviado." },
        { status: 400 }
      );
    }

    const uploaded: { name: string; url: string }[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = `${Date.now()}-${file.name}`;

      const { data, error } = await supabase.storage
        .from("uploads") // bucket
        .upload(filePath, buffer, {
          contentType: file.type,
        });

      if (error) {
        throw new Error(error.message);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("uploads").getPublicUrl(filePath);

      uploaded.push({ name: file.name, url: publicUrl });
    }

    return NextResponse.json({
      success: true,
      count: uploaded.length,
      files: uploaded,
      message: "Arquivos enviados para o Supabase com sucesso!",
    });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Erro interno inesperado";

    console.error("❌ Erro no upload:", err);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
