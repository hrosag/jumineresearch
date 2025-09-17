import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// cria client do supabase usando variáveis do .env.local
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

      // faz upload no bucket "uploads"
      const { error } = await supabase.storage
        .from("uploads")
        .upload(filePath, buffer, {
          contentType: file.type,
        });

      if (error) throw error;

      // gera link público
      const { data } = supabase.storage
        .from("uploads")
        .getPublicUrl(filePath);

      uploaded.push({
        name: file.name,
        url: data.publicUrl,
      });
    }

    return NextResponse.json({
      success: true,
      count: uploaded.length,
      files: uploaded,
      message: "✅ Arquivos enviados com sucesso para o Supabase!",
    });
  } catch (err: any) {
    console.error("❌ Erro no upload:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Erro interno" },
      { status: 500 }
    );
  }
}
