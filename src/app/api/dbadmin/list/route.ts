import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase.storage.from("uploads").list("", {
      limit: 100,
      offset: 0,
      sortBy: { column: "created_at", order: "desc" },
    });

    if (error) {
      throw error;
    }

    const files = data.map((f) => {
      const { data: publicUrl } = supabase.storage
        .from("uploads")
        .getPublicUrl(f.name);

      return {
        name: f.name,
        url: publicUrl.publicUrl,
        status: "pendente", // default
      };
    });

    return NextResponse.json({ success: true, files });
  } catch (err: any) {
    console.error("❌ Erro ao listar arquivos:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Erro interno" },
      { status: 500 }
    );
  }
}
