import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Body = {
  composite_key?: string;
  parser_profile?: string;
};

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const composite_key = (body.composite_key || "").trim();
    const parser_profile =
      (body.parser_profile || "events_information_circular_v1").trim();

    if (!composite_key) {
      return NextResponse.json(
        { error: "composite_key é obrigatório" },
        { status: 400 },
      );
    }

    // 1) Update all_data to running (server-side)
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const supabaseKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    await supabase.from("all_data").upsert(
      {
        composite_key,
        parser_profile,
        parser_status: "running",
        parser_parsed_at: null,
        parser_error: null,
      },
      { onConflict: "composite_key" },
    );

    // 2) Trigger GitHub Actions workflow_dispatch
    const token = requiredEnv("GITHUB_TOKEN"); // needs repo/workflow dispatch permissions
    const owner = process.env.GITHUB_OWNER || "hrosag";
    const repo = process.env.GITHUB_REPO || "jumineresearch";
    const workflowFile =
      process.env.GITHUB_WORKFLOW_INFORMATION_CIRCULAR ||
      "cpc_events_information_circular.yml";
    const ref = process.env.GITHUB_WORKFLOW_REF || "main";

    const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`;

    const ghRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref,
        inputs: {
          composite_key,
          parser_profile,
        },
      }),
    });

    if (!ghRes.ok) {
      const txt = await ghRes.text();
      // rollback to ready (optional)
      await supabase.from("all_data").upsert(
        {
          composite_key,
          parser_profile,
          parser_status: "ready",
          parser_error: txt || `GitHub dispatch failed (${ghRes.status})`,
        },
        { onConflict: "composite_key" },
      );

      return NextResponse.json(
        { error: "Falha ao disparar workflow", details: txt },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });

  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erro desconhecido" },
      { status: 500 },
    );
  }
}
