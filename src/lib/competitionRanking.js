// Standard competition ranking ("1224"): ties share rank, next rank skips.
// Spec §6.2 step 4: tied final_return_pct values must receive equal rank.
// Mutates each entry by assigning `final_rank`.
export function assignRanks(enriched) {
  let rank = 1
  for (let i = 0; i < enriched.length; i++) {
    if (i > 0 && enriched[i].final_return_pct < enriched[i - 1].final_return_pct) {
      rank = i + 1
    }
    enriched[i].final_rank = rank
  }
  return enriched
}
