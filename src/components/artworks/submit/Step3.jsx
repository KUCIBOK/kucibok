import { memo } from 'react'
import { useAuth } from '../../../store/AuthContext'
import { useArtist } from '../../../api/useArtistContextQuery'

export const Step3 = memo(function Step3({ formState, setFormState }) {
  const { user } = useAuth()
  const currencies = [
    // {name : "Euro", value : "EUR"},
    // {name : "Dollar", value : "USD"},
    // {name : "Livre Sterling", value : "GBP"},
    { name: 'Franc CFA (Ouest)', value: 'XOF' },
    // {name : "Franc CFA (Central)", value : "XAF"},
  ]
  const { myArtists } = useArtist()
  const handleSubmit = (e) => {
    e.preventDefault()
    if (formState.price > 100 && formState.currency) {
      setFormState({ ...formState, step: formState.step + 1 })
    }
  }
  return (
    <>
      <div>
        <div>
          <form onSubmit={handleSubmit} method="post" className="w-full">
            <div className="grid">
              <label htmlFor="price" className="text-xs text-white font-semibold">
                Prix
              </label>
              <input
                onChange={(e) => setFormState({ ...formState, price: e.target.value })}
                value={formState.price}
                type="number"
                min={1}
                className="rounded-[4px] bg-kcb-ardoise mt-1 border border-white/[0.06] p-2 text-sm"
                placeholder="Entrez le prix de l'oeuvre"
                required
              />
            </div>
            <div className="grid mt-4">
              <label htmlFor="currency" className="text-xs text-white font-semibold">
                Devise
              </label>
              <select
                onChange={(e) => setFormState({ ...formState, currency: e.target.value })}
                value={formState.currency}
                className="rounded-[4px] bg-kcb-ardoise mt-1 border border-white/[0.06] p-2 text-sm"
                required
              >
                {currencies.map((currency, index) => (
                  <option key={index} value={currency.value}>
                    {currency.name}
                  </option>
                ))}
              </select>
            </div>
            {user?.role == 'curator' && (
              <div className="grid mt-4">
                <label htmlFor="artist" className="text-xs text-white font-semibold">
                  Artiste
                </label>
                <select
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      artist: e.target.value,
                      artistId: myArtists.find((item) => item?.name == e.target.value)?.id,
                    })
                  }
                  name="artist"
                  id="artist"
                  className="rounded-[4px] bg-kcb-ardoise mt-1 border border-white/[0.06] p-2 text-sm"
                  required
                >
                  <option>Vos artistes</option>
                  {myArtists?.length > 0 ? (
                    myArtists?.map((artist, index) => (
                      <option key={index} value={artist?.name}>
                        {' '}
                        {artist?.name}{' '}
                      </option>
                    ))
                  ) : (
                    <option>Vous n'avez aucun artiste, ajoutez un artiste pour commencer</option>
                  )}
                </select>
              </div>
            )}
            <div className="flex justify-between mt-6">
              <button
                onClick={() => {
                  setFormState({ ...formState, step: formState.step - 1 })
                }}
                className="p-2 text-sm rounded-[4px] bg-kcb-ardoise border border-white/[0.06] text-white hover:bg-kcb-ardoise cursor-pointer"
                type="button"
              >
                Précédent
              </button>
              <button
                onClick={() => {
                  if (formState.image) {
                    setFormState({ ...formState, step: formState.step + 1 })
                  }
                }}
                className="p-2 text-sm rounded-[4px] bg-kcb-or text-white cursor-pointer"
                type="submit"
              >
                Suivant
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
})
