import { utils } from './useAPI'

export async function downloadArtistPortfolio() {
  const response = await fetch(`${utils.api}/certificates/portfolio`, utils.options)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.error || 'Impossible de générer le portfolio')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'portfolio-kucibok.pdf'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
