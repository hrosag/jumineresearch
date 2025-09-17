import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get("file"); // agora deve vir como "uploads/arquivo.txt"

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Nome do arquivo não informado" },
        { status: 400 }
      );
    }

    console.log(`🗑️ Tentando deletar arquivo: ${file}`);

    const { error } = await supabase.storage
      .from("uploads")
      .remove([file]); // já recebe o path completo

    if (error) {
      console.error("❌ Erro ao deletar:", error.message);
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      message: `Arquivo ${file} removido com sucesso!`,
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
