import { NextResponse } from "next/server";

export async function POST() {
  try {
    const res = await fetch(
      "https://api.github.com/repos/hrosag/jumineresearch/actions/workflows/cpc_birth_unico.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, // mesmo token do depurar
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }), // mesmo branch que você já usa
      }
    );

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ success: false, error: txt }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
