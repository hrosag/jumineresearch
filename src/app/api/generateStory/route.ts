import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { companies } = (await request.json()) as { companies: string[] }

    if (!companies?.length) {
      return NextResponse.json({ error: 'Nenhuma empresa informada' }, { status: 400 })
    }

    // Ajuste os campos conforme sua tabela:
    // no seu dump anterior o texto do boletim estava em "body_text"
    const { data, error } = await supabase
      .from('all_data')
      .select('company, ticker, bulletin_type, bulletin_date, body_text')
      .in('company', companies)
      .order('bulletin_date', { ascending: true })

    if (error) throw error

    const text = (data ?? []).map(row => {
      const date = row.bulletin_date
        ? new Date(row.bulletin_date + 'T00:00:00').toLocaleDateString('pt-BR')
        : ''
      return [
        `► ${date} — ${row.bulletin_type ?? ''}`,
        `${row.company ?? ''}${row.ticker ? ` (${row.ticker})` : ''}`,
        row.body_text ?? ''
      ].join('\n')
    }).join('\n------------------------------------------------------------\n\n')

    return new NextResponse(text || 'Sem dados para as empresas selecionadas.', {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="story.txt"'
      }
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro ao gerar story' }, { status: 500 })
  }
}
