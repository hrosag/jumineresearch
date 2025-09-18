import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json(
        { success: false, error: "Nenhum arquivo enviado" },
        { status: 400 }
      );
    }

    const uploaded: { name: string; url: string }[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());

      // nome único para evitar sobrescrita
      const uniqueName = `${Date.now()}-${file.name}`;

      const { error } = await supabase.storage
        .from("uploads")
        .upload(uniqueName, buffer, {
          contentType: file.type || "text/plain",
          upsert: false, // não sobrescreve
        });

      if (error) {
        console.error("❌ Erro no upload:", error.message);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }

      // gera URL pública
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/uploads/${uniqueName}`;
      uploaded.push({ name: uniqueName, url });
    }

    return NextResponse.json({
      success: true,
      count: uploaded.length,
      files: uploaded,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("🔥 Erro inesperado no /upload:", errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
