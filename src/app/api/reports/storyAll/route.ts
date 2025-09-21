import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { companies, startDate, endDate } = await req.json()

    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      return new NextResponse('Nenhuma empresa recebida', { status: 400 })
    }

    let bigStory = ''

    for (const comp of companies) {
      let query = supabase
        .from('all_data')
        .select('bulletin_date, bulletin_type, body_text')
        .eq('company', comp)
        .order('bulletin_date', { ascending: true })

      // filtro de datas
      if (startDate) query = query.gte('bulletin_date', startDate)
      if (endDate)   query = query.lte('bulletin_date', endDate)

      const { data, error } = await query
      if (error || !data?.length) continue

      const story = data
        .map(r => `${r.bulletin_date} — ${r.bulletin_type}\n${r.body_text}\n`)
        .join('\n--------------------------------\n')

      bigStory +=
        `\n\n=============================\n` +
        `${comp}\n` +
        `=============================\n` +
        `${story}\n`
    }

    if (!bigStory.trim()) {
      return new NextResponse('Nenhum boletim encontrado.', { status: 404 })
    }

    // Nome de arquivo com datas do filtro
    const safeStart = startDate ? startDate.replaceAll('-', '') : 'inicio'
    const safeEnd   = endDate   ? endDate.replaceAll('-', '')   : 'fim'
    const filename  = `stories_consolidado_${safeStart}_${safeEnd}.txt`

    return new NextResponse(bigStory, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (err) {
    console.error('Erro em storyAll POST:', err)
    return new NextResponse('Erro interno ao gerar stories consolidados', { status: 500 })
  }
}
