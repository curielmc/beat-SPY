export function getCanonicalUrl(locationLike) {
  if (!locationLike?.hostname) return null
  if (locationLike.hostname !== 'www.beat-snp.com') return null
  return `https://beat-snp.com${locationLike.pathname || '/'}${locationLike.search || ''}${locationLike.hash || ''}`
}
