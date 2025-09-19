// src/app/api/reports/story/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Conexão com o Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Esta rota atende GET /api/reports/story?company=XYZ
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')

  if (!company) {
    return NextResponse.json(
      { error: 'Parâmetro "company" é obrigatório' },
      { status: 400 }
    )
  }

  // Busca todos os boletins da empresa
  const { data, error } = await supabase
    .from('all_data')
    .select('bulletin_date, bulletin_type, body_text')
    .eq('company', company)
    .order('bulletin_date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Monta o “story” concatenando os boletins
  const story = (data ?? [])
    .map(
      r =>
        `${r.bulletin_date} — ${r.bulletin_type}\n${r.body_text}\n`
    )
    .join('\n--------------------------------\n')

  // devolve um .txt para download
  return new NextResponse(story, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${company.replace(/\s+/g, '_')}__story.txt"`
    }
  })
}
