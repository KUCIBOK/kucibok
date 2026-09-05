import { Award, Download, Eye, Loader2 } from 'lucide-react'
import { memo, useState } from 'react'
import { utils } from '../../api/useAPI'
import { useToast } from '../../store/ToastContext'
import { useCertificate } from '../../api/useNotifications'

/**
 * Colonne Certificat dans le tableau des œuvres.
 * - Œuvre non approuvée → "—"
 * - Approuvée + certificat existant → icônes Voir + Télécharger (signed URL à la demande)
 * - Approuvée + pas de certificat + admin → bouton "Générer"
 * - Approuvée + pas de certificat + autre rôle → "En attente"
 */
export const GenerateCertificateAction = memo(function GenerateCertificateAction({ artwork, user, onGenerated }) {
  const { makeToast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [fetching, setFetching] = useState(false)
  const { generate: notifyCertificate } = useCertificate()

  // Supporte snake_case (DB) et camelCase (ancien mapping) et certificate_url direct
  const [localCertPath, setLocalCertPath] = useState(
    artwork?.certificate_path ?? artwork?.certificatePath ?? null
  )

  const artworkId = artwork?._id || artwork?.id

  /** Récupère une signed URL fraîche depuis le backend puis ouvre/télécharge. */
  const openCert = async (download = false) => {
    setFetching(true)
    try {
      const res = await fetch(`${utils.api}/certificates/url/${artworkId}`, { ...utils.options })
      const body = await res.json()
      const url = body?.data?.certificate_url
      if (!url) {
        makeToast('Erreur', 'danger', body?.error || 'Lien introuvable')
        return
      }
      if (download) {
        const a = document.createElement('a')
        a.href = url
        a.download = `certificat-${artworkId}.pdf`
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      makeToast('Erreur', 'danger', err.message)
    } finally {
      setFetching(false)
    }
  }

  /** Génère le certificat PDF (admin uniquement). */
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`${utils.api}/certificates/generate`, {
        ...utils.options,
        method: 'POST',
        body: JSON.stringify({ artwork_id: artworkId }),
      })
      const body = await res.json()
      if (!res.ok) {
        makeToast('Erreur', 'danger', body?.error || 'Échec de la génération')
        return
      }
      const data = body?.data ?? body
      // Met à jour le state local pour basculer immédiatement sur Eye/Download
      setLocalCertPath(data?.certificate_path ?? `artworks/${data?.kucibok_id ?? artworkId}.pdf`)
      makeToast('Certificat généré', 'success', artwork?.title)
      onGenerated?.(data)

      // Notify admin of new certificate generation
      try {
        await notifyCertificate(
          artworkId,
          artwork?.artist || 'Unknown',
          artwork?.title || 'Untitled',
          artwork?.dimensions || '',
          artwork?.medium || '',
          artwork?.year || new Date().getFullYear()
        )
      } catch (notifErr) {
        console.warn('Certificate notification failed:', notifErr)
      }
    } catch (err) {
      makeToast('Erreur', 'danger', err.message)
    } finally {
      setGenerating(false)
    }
  }

  if (artwork?.status !== 'approved') {
    return <span className="text-kcb-pierre text-xs">—</span>
  }

  if (localCertPath) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => openCert(false)}
          disabled={fetching}
          title="Voir le certificat"
          className="p-1 rounded text-kcb-or hover:text-kcb-bronze transition disabled:opacity-50"
        >
          {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
        </button>
        {(user?.role === 'admin' || user?.role === 'artist' || user?.role === 'curator') && (
          <button
            onClick={() => openCert(true)}
            disabled={fetching}
            title="Télécharger le certificat PDF"
            className="p-1 rounded text-green-400 hover:text-green-300 transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  if (user?.role === 'admin' || user?.role === 'artist') {
    return (
      <button
        onClick={handleGenerate}
        disabled={generating}
        title="Générer le certificat PDF"
        className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-kcb-or/10 border border-kcb-or/30 text-kcb-or hover:bg-kcb-or/20 transition disabled:opacity-50 whitespace-nowrap"
      >
        {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Award className="w-3 h-3" />}
        {generating ? '...' : 'Générer'}
      </button>
    )
  }

  return <span className="text-kcb-pierre italic text-xs">En attente</span>
})
