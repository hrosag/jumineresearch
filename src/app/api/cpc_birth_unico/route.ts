import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const composite_key = body?.composite_key as string | undefined;
    const parser_profile = (body?.parser_profile as string | undefined) ?? "cpc_birth";

    if (!composite_key) {
      return NextResponse.json(
        { success: false, error: "composite_key obrigatório" },
        { status: 400 },
      );
    }

    const res = await fetch(
      "https://api.github.com/repos/hrosag/jumineresearch/actions/workflows/cpc_birth_unico.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            composite_key,
            parser_profile,
          },
        }),
      },
    );

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        { success: false, error: txt },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}
