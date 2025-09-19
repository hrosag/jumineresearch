import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company");
  if (!company) {
    return NextResponse.json({ error: "Empresa não informada" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("all_data")
    .select("bulletin_date, body_text")
    .eq("company", company)
    .order("bulletin_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const story = (data ?? [])
    .map(r => `=== ${r.bulletin_date} ===\n${r.body_text}\n`)
    .join("\n\n");

  return new NextResponse(story, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": `attachment; filename="${company}__story.txt"`
    }
  });
}
