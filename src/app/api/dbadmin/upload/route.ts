import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    console.log("⬆️ UPLOAD chamado");

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    console.log(`📄 Total de arquivos recebidos: ${files.length}`);

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

      const name =
        (file as File & { name?: string }).name ??
        `sem_nome_${Date.now()}.txt`;

      console.log(`📂 Tentando upload: ${name}`);

      const { error } = await supabase.storage
        .from("uploads")
        .upload(name, buffer, {
          contentType: (file as File & { type?: string }).type ?? "text/plain",
          upsert: true,
        });

      if (error) {
        console.error("❌ Erro Supabase upload:", error.message);
        throw new Error(error.message);
      }

      const { data: publicUrl } = supabase.storage
        .from("uploads")
        .getPublicUrl(name);

      uploaded.push({ name, url: publicUrl.publicUrl });
    }

    console.log("✅ Upload concluído:", uploaded);
    return NextResponse.json({
      success: true,
      count: uploaded.length,
      files: uploaded,
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
