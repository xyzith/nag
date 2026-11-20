export function megabytes(rssKb: number): string {
  return `${Math.round(rssKb / 1024)}M`
}

export function elapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours}h${minutes % 60}m` : `${Math.floor(hours / 24)}d${hours % 24}h`
}

export function shortArgs(args: string, width: number): string {
  const flat = args.replace(/\s+/g, ' ')
  return flat.length <= width ? flat : `${flat.slice(0, Math.max(1, width - 1))}…`
}
