import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    console.log("📂 LIST chamado");

    const { data, error } = await supabase.storage.from("uploads").list("", {
      limit: 100,
      offset: 0,
      sortBy: { column: "created_at", order: "desc" },
    });

    if (error) throw error;

    console.log("📦 Arquivos retornados pelo Supabase:", data);

    const files = data.map((f) => {
      const { data: publicUrl } = supabase.storage
        .from("uploads")
        .getPublicUrl(f.name);

      return {
        name: f.name,
        path: f.name, // caminho relativo dentro do bucket
        url: publicUrl.publicUrl,
        status: "pendente",
      };
    });

    return NextResponse.json({ success: true, files });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("❌ Erro ao listar arquivos:", errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage || "Erro interno" },
      { status: 500 }
    );
  }
}
