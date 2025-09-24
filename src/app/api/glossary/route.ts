import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // ⚠️ precisa ser a service_key (privada)
);

// 🔹 Criar item
export async function POST(req: Request) {
  const body = await req.json();
  const { data, error } = await supabase.from("glossary").insert(body).select();

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(data);
}

// 🔹 Atualizar item
export async function PUT(req: Request) {
  const body = await req.json();
  const { id, ...updates } = body;

  const { data, error } = await supabase.from("glossary").update(updates).eq("id", id).select();

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(data);
}

// 🔹 Deletar item
export async function DELETE(req: Request) {
  const { id } = await req.json();
  const { error } = await supabase.from("glossary").delete().eq("id", id);

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
