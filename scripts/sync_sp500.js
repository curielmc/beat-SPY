import 'dotenv/config'
import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

const FMP_BASE = 'https://financialmodelingprep.com/api/v3'
const FMP_KEY = process.env.VITE_FMP_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY // Need service key for bulk upsert if RLS is strict

if (!FMP_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing environment variables. Need VITE_FMP_API_KEY, VITE_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function syncSP500() {
  console.log('🔄 Fetching S&P 500 constituents from FMP...')
  const res = await fetch(`${FMP_BASE}/sp500_constituent?apikey=${FMP_KEY}`)
  if (!res.ok) throw new Error('FMP fetch failed')
  const data = await res.json()

  console.log(`✅ Found ${data.length} constituents. Syncing to database...`)

  const rows = data.map(item => ({
    symbol: item.symbol,
    name: item.name,
    sector: item.sector,
    sub_sector: item.subSector || item.sub_sector || null
  }))

  const { error } = await supabase
    .from('sp500_constituents')
    .upsert(rows, { onConflict: 'symbol' })

  if (error) {
    console.error('❌ Database upsert failed:', error)
  } else {
    console.log('🎉 S&P 500 constituents successfully synced to database!')
  }
}

syncSP500().catch(err => {
  console.error('Error syncing:', err)
  process.exit(1)
})
