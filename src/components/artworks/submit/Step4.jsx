import { useArtworkMutations } from '../../api/useArtworkMutationsQuery' /* ✨ React Query */
import { useNavigate } from 'react-router-dom'
import { DataLoader } from '../../loaders/PageLoader'
import DOMPurify from 'dompurify'

export const Step4 = ({ formState, setFormState, user, profile }) => {
  const navigate = useNavigate()
  const { submitArtwork } = useArtworkMutations() /* ✨ React Query */
  const submit = async () => {
    try {
      setFormState({ ...formState, loading: true })
      let data = { ...formState }
      if (user?.role == 'artist') {
        data.artist = profile?.name || ''
        data.artistId = profile?.id || ''
      } else {
        data.artist = formState.artist
        data.artistId = null
      }
      delete data.step
      delete data.tag
      delete data.loading
      delete data.show
      delete data.error
      const formData = new FormData()
      Object.keys(data).forEach((key) => {
        if (key === 'tags' && Array.isArray(data[key])) {
          formData.append(key, JSON.stringify(data[key]))
        } else {
          formData.append(key, data[key])
        }
      })
      const artwork = await submitArtwork(formData)
      if (artwork?.error) {
        setFormState({ ...formState, loading: false, error: artwork.error })
        return
      }
      if (artwork?.id) {
        user?.role == 'artist' ? navigate('/dashboard/artist') : navigate('/dashboard/curator')
      }
      setFormState({ ...formState, loading: false })
    } catch (error) {
      setFormState({ ...formState, loading: false })
    }
  }

  return (
    <div className="bg-kcb-ardoise p-8 rounded-[4px] shadow-xl border border-white/[0.06] max-w-2xl mx-auto">
      <h4 className="text-xl font-bold text-white mb-6 tracking-tight text-center">
        Vérifiez votre soumission
      </h4>
      <div className="space-y-4">
        {/* Image */}
        <div className="pt-0 flex flex-col items-center">
          <span className="text-xs uppercase text-kcb-pierre tracking-widest mb-1">Image</span>
          {formState?.image && (
            <img
              src={formState?.show}
              alt="Artwork preview"
              className="max-h-[220px] rounded-[4px] object-contain border border-white/[0.06] shadow-md bg-kcb-ardoise"
            />
          )}
        </div>
        {/* Titre */}
        <div className="pt-6">
          <span className="text-xs uppercase text-kcb-pierre tracking-widest">Titre</span>
          <p className="text-lg font-semibold text-white mt-1">{formState?.title}</p>
        </div>
        {/* Description */}
        <div className="pt-6">
          <span className="text-xs uppercase text-kcb-pierre tracking-widest">Description</span>
          <div className="text-kcb-sable text-base mt-1 prose prose-invert max-w-none">
            <span
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formState?.description ?? '') }}
            ></span>
          </div>
        </div>
        {/* Mensurations */}
        <div className="pt-6">
          <span className="text-xs uppercase text-kcb-pierre tracking-widest">Mensurations</span>
          <p className="text-kcb-sable mt-1">
            {formState?.height} cm de haut, {formState?.width} cm de large, <br />
            pour {formState?.weight} kilogrammes.
          </p>
        </div>
        {/* Artiste */}
        <div className="pt-6">
          <span className="text-xs uppercase text-kcb-pierre tracking-widest">Artiste</span>
          <p className="text-kcb-sable mt-1">{formState?.artist}</p>
        </div>
        {/* Prix */}
        <div className="pt-6">
          <span className="text-xs uppercase text-kcb-pierre tracking-widest">Prix</span>
          <p className="text-kcb-sable mt-1">
            {formState?.price?.toLocaleString('fr-FR').replace(/\s/g, ' ')} {formState?.currency}
          </p>
        </div>
        {/* Tags */}
        <div className="pt-6">
          <span className="text-xs uppercase text-kcb-pierre tracking-widest">Mots-clés</span>
          <div className="flex flex-wrap gap-2 mt-2 min-h-[36px]">
            {formState?.tags.map((tag, index) => (
              <span
                key={tag}
                className="bg-kcb-ardoise border border-kcb-or/30 flex items-center gap-1 text-kcb-or rounded-[4px] px-3 py-1 text-xs font-semibold animate-fade-in shadow-sm group cursor-pointer transition-all"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      {formState?.error && (
        <p className="mt-6 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-[4px] px-3 py-2">
          {formState.error}
        </p>
      )}
      <div className="flex justify-between mt-10">
        <button
          onClick={() => {
            setFormState({ ...formState, step: formState?.step - 1 })
          }}
          className="p-2 text-sm rounded-[4px] bg-kcb-ardoise border border-white/[0.06] text-white hover:bg-kcb-ardoise transition-all shadow focus:outline-none focus:ring-2 focus:ring-kcb-or"
          type="button"
        >
          Précédent
        </button>
        <button
          disabled={formState?.loading}
          onClick={submit}
          className="p-2 text-sm rounded-[4px] bg-kcb-or text-white font-semibold hover:bg-kcb-or/90 transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-kcb-or disabled:opacity-50"
          type="button"
        >
          {formState?.loading ? <DataLoader /> : 'Soumettre'}
        </button>
      </div>
    </div>
  )
}
