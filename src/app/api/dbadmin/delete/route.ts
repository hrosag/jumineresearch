import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get("file"); // vem como "uploads/arquivo.txt"

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Nome do arquivo não informado" },
        { status: 400 }
      );
    }

    // 🔑 remove prefixo "uploads/" antes de enviar pro Supabase
    const relativePath = file.replace(/^uploads\//, "");

    console.log(`🗑️ Tentando deletar arquivo: ${relativePath}`);

    const { error } = await supabase.storage
      .from("uploads")
      .remove([relativePath]);

    if (error) {
      console.error("❌ Erro ao deletar:", error.message);
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      message: `Arquivo ${relativePath} removido com sucesso!`,
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : String(err);
    console.error("🔥 Erro no delete:", errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage || "Erro interno" },
      { status: 500 }
    );
  }
}
