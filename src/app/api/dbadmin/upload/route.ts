import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export async function POST(req: Request) {
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Variaveis do Supabase nao configuradas." },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: "Nenhum arquivo recebido." },
        { status: 400 }
      );
    }

    const uploaded: Array<{
      name: string;
      path: string;
      size: number;
      originalName: string;
    }> = [];

    for (const file of files) {
      const sanitizedName = file.name.replace(/[\\/]/g, "_").trim();

      if (!sanitizedName) {
        return NextResponse.json(
          { success: false, error: "Nome de arquivo invalido." },
          { status: 400 }
        );
      }

      const uniqueName = `${randomUUID()}-${sanitizedName}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { data, error } = await supabase.storage
        .from("uploads")
        .upload(uniqueName, buffer, {
          cacheControl: "3600",
          contentType: file.type || "text/plain",
          upsert: false,
        });

      if (error) {
        console.error(`Erro ao enviar ${uniqueName}:`, error.message);
        return NextResponse.json(
          {
            success: false,
            error: `Erro ao enviar ${uniqueName}: ${error.message}`,
          },
          { status: 500 }
        );
      }

      uploaded.push({
        name: uniqueName,
        path: data?.path ?? uniqueName,
        size: file.size,
        originalName: file.name,
      });
    }

    return NextResponse.json({
      success: true,
      count: uploaded.length,
      files: uploaded,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Erro inesperado no upload:", message);
    return NextResponse.json(
      { success: false, error: message || "Erro interno" },
      { status: 500 }
    );
  }
}
