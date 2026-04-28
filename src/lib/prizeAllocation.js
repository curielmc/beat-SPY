// Pure resolver: maps a prize-pool allocation spec + final ranking → concrete payouts.
//
// `buckets` is an array of bucket specs; each spec has:
//   - eligibility: 'top_n' | 'top_n_who_beat_benchmark' | 'all_who_beat_benchmark' | 'place'
//   - n: number (for top_n / top_n_who_beat_benchmark)
//   - place_range: [from, to] (for 'place')
//   - exclude_ranks: number[] of ranks to exclude from candidate pool
//   - allocation: { type: 'percent_of_pool' | 'fixed_amount', value: number }
//   - split: 'winner_take_all' | 'weighted_by_rank' | 'equal_split'
//   - weights: number[] (for weighted_by_rank)
//
// `ranking` is an array of { user_id, final_rank, final_return_pct, beat_benchmark }
//   sorted ascending by final_rank.
//
// Returns { payouts: [{user_id, amount}], unfilled: [{bucket, unallocated}] }.
export function resolvePrizeBuckets(buckets, ranking, poolAmount) {
  const payouts = []
  const unfilled = []

  for (const bucket of buckets) {
    const allocation = bucket.allocation
    const bucketAmount = allocation.type === 'fixed_amount'
      ? Number(allocation.value)
      : (Number(allocation.value) / 100) * poolAmount

    const candidates = selectCandidates(bucket, ranking)
    if (candidates.length === 0) {
      unfilled.push({ bucket, unallocated: bucketAmount })
      continue
    }

    const splits = splitAmount(bucket, bucketAmount, candidates)
    for (const s of splits) payouts.push(s)
  }

  return { payouts: mergePayouts(payouts), unfilled }
}

function selectCandidates(bucket, ranking) {
  const exclude = new Set(bucket.exclude_ranks || [])
  const pool = ranking.filter(r => !exclude.has(r.final_rank))
  switch (bucket.eligibility) {
    case 'top_n':
      return pool.slice(0, bucket.n)
    case 'top_n_who_beat_benchmark':
      return pool.filter(r => r.beat_benchmark).slice(0, bucket.n)
    case 'all_who_beat_benchmark':
      return pool.filter(r => r.beat_benchmark)
    case 'place': {
      const [a, b] = bucket.place_range || [bucket.n, bucket.n]
      return pool.filter(r => r.final_rank >= a && r.final_rank <= b)
    }
    default:
      return []
  }
}

function splitAmount(bucket, bucketAmount, candidates) {
  if (bucket.split === 'winner_take_all') {
    // Among tied top-rank candidates, equal split. Otherwise winner takes all.
    if (candidates.length === 0) return []
    const topRank = candidates[0].final_rank
    const tied = candidates.filter(c => c.final_rank === topRank)
    if (tied.length > 1) {
      const each = round2(bucketAmount / tied.length)
      return tied.map(c => ({ user_id: c.user_id, amount: each }))
    }
    return [{ user_id: candidates[0].user_id, amount: bucketAmount }]
  }
  if (bucket.split === 'weighted_by_rank') {
    const weights = bucket.weights || []
    const effectiveWeights = candidates.map((_, i) => Number(weights[i] ?? 0))
    const totalW = effectiveWeights.reduce((a, b) => a + b, 0)
    if (totalW === 0) {
      // No usable weights — degrade to equal split
      const each = round2(bucketAmount / candidates.length)
      return candidates.map(c => ({ user_id: c.user_id, amount: each }))
    }
    return candidates.map((c, i) => ({
      user_id: c.user_id,
      amount: round2((effectiveWeights[i] / totalW) * bucketAmount)
    }))
  }
  // equal_split
  const each = round2(bucketAmount / candidates.length)
  return candidates.map(c => ({ user_id: c.user_id, amount: each }))
}

function mergePayouts(list) {
  const m = new Map()
  for (const p of list) m.set(p.user_id, round2((m.get(p.user_id) || 0) + p.amount))
  return [...m.entries()].map(([user_id, amount]) => ({ user_id, amount }))
}

function round2(n) { return Math.round(n * 100) / 100 }
