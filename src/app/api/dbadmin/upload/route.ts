import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Debug para garantir que variáveis estão chegando
console.log("🚀 SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log(
  "🚀 SUPABASE_KEY:",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "OK" : "MISSING"
);

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

      console.log(`📂 Tentando upload do arquivo: ${file.name} (${file.type})`);

      const { data, error } = await supabase.storage
        .from("uploads")
        .upload(filePath, buffer, {
          contentType: file.type || "text/plain",
          upsert: true, // garante que sobrescreve se já existir
        });

      if (error) {
        console.error("❌ Erro Supabase upload:", error.message, error);
        throw new Error(error.message);
      }

      console.log("✅ Upload concluído:", data);

      const { data: publicUrl } = supabase.storage
        .from("uploads")
        .getPublicUrl(filePath);

      uploaded.push({
        name: file.name,
        url: publicUrl.publicUrl,
      });
    }

    return NextResponse.json({
      success: true,
      count: uploaded.length,
      files: uploaded,
      message: "Arquivos enviados para o Supabase com sucesso!",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("🔥 Erro no upload:", errorMsg);
    return NextResponse.json(
      { success: false, error: errorMsg || "Erro interno" },
      { status: 500 }
    );
  }
}
