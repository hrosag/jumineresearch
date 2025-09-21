'use client'

import { Suspense } from 'react'
import ViewAllData from './ViewAllData'

export default function Page() {
  return (
    <Suspense fallback={<p>Carregando visualização…</p>}>
      <ViewAllData />
    </Suspense>
  )
}
