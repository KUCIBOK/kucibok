import { useEffect, useMemo, useState } from 'react'
import { Check, Image as ImageIcon, Search } from 'lucide-react'
import { utils } from '../../api/useAPI'

const PLACEHOLDER = '/images/placeholder-artwork.svg'

const read = async (path) => {
  try {
    const response = await fetch(`${utils.api}${path}`, { headers: utils.options.headers })
    if (!response.ok) return []
    const body = await response.json()
    return Array.isArray(body) ? body : body?.artworks || []
  } catch {
    return []
  }
}

/**
 * Choix des œuvres à expédier. Valable pour tous les rôles : les œuvres soumises par l'utilisateur
 * (artiste) et celles de sa collection (curateur, conseiller, collectionneur). Le serveur
 * revérifie que chaque œuvre appartient bien à l'utilisateur.
 */
export function ArtworkPicker({ value, onChange }) {
  const [artworks, setArtworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([read('/artworks/my'), read('/artworks/collection?limit=100')]).then(([mine, collection]) => {
      if (!active) return
      const unique = new Map()
      for (const artwork of [...mine, ...collection]) {
        if (artwork?.id && artwork.status !== 'rejected' && !unique.has(artwork.id)) unique.set(artwork.id, artwork)
      }
      setArtworks([...unique.values()])
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? artworks.filter((a) => String(a.title || '').toLowerCase().includes(needle)) : artworks
  }, [artworks, query])

  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs text-kcb-pierre">
          Œuvres à expédier <span className="text-red-400">*</span>
        </label>
        <span className="text-xs text-kcb-or">{value.length} sélectionnée(s)</span>
      </div>

      {artworks.length > 6 && (
        <div className="relative mb-2">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-kcb-pierre" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une œuvre"
            className="w-full bg-kcb-ardoise text-white border border-white/[0.06] rounded-[4px] pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-kcb-or"
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-kcb-pierre py-4">Chargement de vos œuvres…</p>
      ) : artworks.length === 0 ? (
        <p className="text-sm text-kcb-pierre bg-kcb-ardoise/60 rounded-[4px] p-3">
          Aucune œuvre disponible. Soumettez ou ajoutez d'abord une œuvre à votre collection pour
          pouvoir l'expédier.
        </p>
      ) : (
        <ul className="max-h-64 overflow-y-auto space-y-2 pr-1" role="listbox" aria-multiselectable="true" aria-label="Œuvres à expédier">
          {visible.map((artwork) => {
            const selected = value.includes(artwork.id)
            return (
              <li key={artwork.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => toggle(artwork.id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-[4px] border text-left transition ${selected ? 'border-kcb-or bg-kcb-or/10' : 'border-white/[0.06] bg-kcb-ardoise hover:bg-white/[0.04]'}`}
                >
                  {artwork.image ? (
                    <img src={artwork.image} alt="" onError={(e) => { e.currentTarget.src = PLACEHOLDER }} className="w-10 h-10 object-cover rounded-[4px] shrink-0" />
                  ) : (
                    <span className="w-10 h-10 rounded-[4px] bg-kcb-noir flex items-center justify-center shrink-0">
                      <ImageIcon className="w-4 h-4 text-kcb-pierre" />
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-white truncate">{artwork.title || 'Sans titre'}</span>
                    <span className="block text-xs text-kcb-pierre truncate">
                      {[artwork.kucibok_id, artwork.status === 'pending' ? 'en attente d\'approbation' : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${selected ? 'bg-kcb-or border-kcb-or' : 'border-white/20'}`}>
                    {selected && <Check className="w-3 h-3 text-kcb-noir" />}
                  </span>
                </button>
              </li>
            )
          })}
          {visible.length === 0 && <li className="text-sm text-kcb-pierre p-2">Aucun résultat.</li>}
        </ul>
      )}
    </div>
  )
}
