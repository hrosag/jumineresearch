import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// DEBUG: conferir se as variáveis estão chegando no Vercel
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
    const files = formData.getAll("files") as Blob[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: "Nenhum arquivo enviado." },
        { status: 400 }
      );
    }

    const uploaded: { name: string; url: string }[] = [];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 👇 Evita `any` usando indexação de objeto
      const name =
        (file as Blob & { name?: string }).name ??
        `sem_nome_${Date.now()}.txt`;

      const type =
        (file as Blob & { type?: string }).type ?? "text/plain";

      const filePath = `${Date.now()}-${name}`;

      console.log(`📂 Tentando upload do arquivo: ${name} (${type})`);

      const { error } = await supabase.storage
        .from("uploads")
        .upload(filePath, buffer, {
          contentType: type,
          upsert: true,
        });

      if (error) {
        console.error("❌ Erro Supabase upload:", error.message, error);
        throw new Error(error.message);
      }

      const { data: publicUrl } = supabase.storage
        .from("uploads")
        .getPublicUrl(filePath);

      uploaded.push({
        name,
        url: publicUrl.publicUrl,
      });
    }

    return NextResponse.json({
      success: true,
      count: uploaded.length,
      files: uploaded,
      message: "Arquivos enviados para o Supabase com sucesso!",
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro interno";
    console.error("🔥 Erro no upload:", errorMsg);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
