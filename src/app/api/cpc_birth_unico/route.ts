import { NextResponse } from "next/server";

const GITHUB_REPO = "hrosag/jumineresearch";
const WORKFLOW_FILE = "cpc_birth_unico.yml";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const composite_key = body?.composite_key as string | undefined;
    const parser_profile =
      (body?.parser_profile as string | undefined) ?? "cpc_birth";

    if (!composite_key) {
      return NextResponse.json(
        { success: false, error: "composite_key obrigatório" },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    const githubToken = process.env.GITHUB_TOKEN;

    if (!supabaseUrl || !serviceKey || !githubToken) {
      return NextResponse.json(
        { success: false, error: "Variáveis de ambiente faltando (SUPABASE_URL / SUPABASE_SERVICE_KEY / GITHUB_TOKEN)." },
        { status: 500 },
      );
    }

    // 1) Marca no Supabase que esse boletim será parseado com esse parser
    const supabaseResp = await fetch(
      `${supabaseUrl}/rest/v1/all_data?composite_key=eq.${encodeURIComponent(
        composite_key,
      )}`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          parser_profile,
          parser_status: "ready",
          parser_parsed_at: null,
        }),
      },
    );

    if (!supabaseResp.ok) {
      const txt = await supabaseResp.text();
      return NextResponse.json(
        {
          success: false,
          error: `Erro ao atualizar all_data: ${txt}`,
        },
        { status: 500 },
      );
    }

    // 2) Dispara o workflow no GitHub Actions
    const ghResp = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
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

    if (!ghResp.ok) {
      const txt = await ghResp.text();
      return NextResponse.json(
        { success: false, error: `Erro ao disparar workflow: ${txt}` },
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
