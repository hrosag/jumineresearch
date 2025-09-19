// src/app/api/reports/story/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'

// -----------------------------------------------------------------------------
// Conexão com o Supabase
// -----------------------------------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * GET /api/reports/story
 *  - ?company=EMPRESA          → retorna um único .txt
 *  - ?multi=EMP1,EMP2,EMP3     → retorna um .zip com vários .txt
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const company = searchParams.get('company')
  const multi = searchParams.get('multi')

  // ---------------------------------------------------------------------------
  // MODO SINGLE: apenas 1 empresa -> gera 1 TXT
  // ---------------------------------------------------------------------------
  if (company) {
    const { data, error } = await supabase
      .from('all_data')
      .select('bulletin_date, bulletin_type, body_text')
      .eq('company', company)
      .order('bulletin_date', { ascending: true })

    if (error) return new NextResponse(error.message, { status: 500 })
    if (!data?.length) return new NextResponse('No bulletins found', { status: 404 })

    const story = data
      .map(r => `${r.bulletin_date} — ${r.bulletin_type}\n${r.body_text}\n`)
      .join('\n--------------------------------\n')

    const safe = company.replace(/[^a-z0-9]/gi, '_')
    const lastDate = data[data.length - 1].bulletin_date ?? 'unknown'
    const filename = `${safe}__story_until_${lastDate}.txt`

    return new NextResponse(story, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  }

  // ---------------------------------------------------------------------------
  // MODO MULTI: várias empresas -> gera 1 ZIP com vários TXT
  // ---------------------------------------------------------------------------
  if (multi) {
    const companies = multi.split(',').map(s => s.trim()).filter(Boolean)
    if (!companies.length) return new NextResponse('No companies', { status: 400 })

    const zip = new JSZip()

    for (const comp of companies) {
      const { data, error } = await supabase
        .from('all_data')
        .select('bulletin_date, bulletin_type, body_text')
        .eq('company', comp)
        .order('bulletin_date', { ascending: true })

      // Se der erro ou não houver boletins, pula esta empresa
      if (error || !data?.length) continue

      const story = data
        .map(r => `${r.bulletin_date} — ${r.bulletin_type}\n${r.body_text}\n`)
        .join('\n--------------------------------\n')

      const safe = comp.replace(/[^a-z0-9]/gi, '_')
      const lastDate = data[data.length - 1].bulletin_date ?? 'unknown'
      zip.file(`${safe}__story_until_${lastDate}.txt`, story)
    }

    // ✅ Gera um ArrayBuffer e devolve como Blob (compatível com Edge Runtime)
    const content = await zip.generateAsync({ type: 'arraybuffer' })
    const blob = new Blob([content], { type: 'application/zip' })

    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="stories.zip"'
      }
    })
  }

  // Nenhum parâmetro fornecido
  return new NextResponse('Missing company or multi', { status: 400 })
}
