export function getCanonicalUrl(locationLike) {
  if (!locationLike?.hostname) return null
  
  const host = locationLike.hostname.toLowerCase()
  // If we are on the Vercel preview/production URL or the WWW version, redirect to apex
  const isVercel = host.includes('beat-spy.vercel.app')
  const isWww = host === 'www.beat-snp.com'
  
  if (isVercel || isWww) {
    return `https://beat-snp.com${locationLike.pathname || '/'}${locationLike.search || ''}${locationLike.hash || ''}`
  }
  
  return null
}
