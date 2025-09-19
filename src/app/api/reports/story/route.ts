import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const company = req.nextUrl.searchParams.get('company')
  if (!company) {
    return new NextResponse('Missing company', { status: 400 })
  }

  const { data, error } = await supabase
    .from('all_data')
    .select('bulletin_date, bulletin_type, body_text')
    .eq('company', company)
    .order('bulletin_date', { ascending: true })

  if (error) return new NextResponse(error.message, { status: 500 })
  if (!data || data.length === 0) {
    return new NextResponse('No bulletins found', { status: 404 })
  }

  // Concatena boletins
  const story = data
    .map(r =>
      `${r.bulletin_date} — ${r.bulletin_type ?? ''}\n${r.body_text ?? ''}\n`
    )
    .join('\n--------------------------------\n')

  // último boletim para compor o nome do arquivo
  const lastDate = data[data.length - 1].bulletin_date ?? 'unknown'
  const safeName = company.replace(/[^a-z0-9]/gi, '_')
  const filename = `${safeName}__story_until_${lastDate}.txt`

  return new NextResponse(story, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}
