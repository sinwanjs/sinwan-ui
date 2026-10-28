function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** Candidates that contain `input` (or vice versa) or are a few edits away, closest first. */
export function closeMatches(input: string, candidates: readonly string[], limit = 5): string[] {
  const needle = input.toLowerCase();
  const maxDistance = Math.max(2, Math.floor(needle.length / 3));
  return candidates
    .map((candidate) => {
      const lower = candidate.toLowerCase();
      const contains = lower.includes(needle) || needle.includes(lower);
      return { candidate, distance: contains ? 0 : editDistance(needle, lower) };
    })
    .filter((match) => match.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate))
    .slice(0, limit)
    .map((match) => match.candidate);
}
