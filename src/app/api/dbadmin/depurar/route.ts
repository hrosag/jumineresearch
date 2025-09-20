// src/app/api/dbadmin/depurar/route.ts
import { NextRequest, NextResponse } from "next/server";

// <<< AJUSTE >>> trocamos `any` por tipos corretos (NextRequest, NextResponse)
export async function POST(_req: NextRequest) {
  try {
    const res = await fetch(
      "https://api.github.com/repos/hrosag/jumineresearch/actions/workflows/depurar.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main", // branch de disparo
        }),
      }
    );

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ success: false, error: txt }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    // <<< AJUSTE >>> tipagem sem any → convertemos para string
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
