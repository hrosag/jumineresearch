import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // usando anon (já tem policy criada)
);

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get("file");

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Nome do arquivo não informado" },
        { status: 400 }
      );
    }

    // caminho completo no bucket
    const fullPath = file.startsWith("uploads/") ? file : `uploads/${file}`;

    console.log("🗑️ Tentando deletar arquivo do bucket:", fullPath);

    const { data, error } = await supabase.storage
      .from("uploads")
      .remove([fullPath]);

    if (error) {
      console.error("❌ Erro ao deletar:", error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log("✅ Delete result:", data);

    return NextResponse.json({
      success: true,
      message: `✅ Arquivo ${fullPath} removido com sucesso!`,
      data,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("🔥 Erro no delete:", errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage || "Erro interno" },
      { status: 500 }
    );
  }
}
