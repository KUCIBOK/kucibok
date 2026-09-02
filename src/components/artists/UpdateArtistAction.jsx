import { AlertCircle, Camera, PenBox, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DataLoader } from '../loaders/PageLoader'
import { useArtist } from '../../api/useArtistContextQuery'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'

export function UpdateArtistAction({ artist }) {
  const [state, setState] = useState({
    updateArtist: false,
  })
  return (
    <>
      <button
        onClick={() => setState({ ...state, updateArtist: true })}
        className="flex p-2 gap-2 items-center border bg-green-600 border-border rounded-[4px]"
      >
        <PenBox className="w-4 h-4 text-white font-bold mx-auto" />
        <p className="mx-auto text-sm">Modifier</p>
      </button>
      {state?.updateArtist && (
        <Modal artist={artist} closeModal={() => setState({ ...state, updateArtist: false })} />
      )}
    </>
  )
}

function Modal({ closeModal, artist }) {
  const { update } = useArtist()
  const [state, setState] = useState({
    ...artist,
    countries: [],
    loading: false,
    error: '',
    show: artist?.image,
  })
  useEffect(() => {
    const fetchCountries = async () => {
      const response = await fetch('/data/countries.json')
      const data = await response.json()
      setState({ ...state, countries: data })
    }
    fetchCountries()
  }, [])
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setState({ ...state, show: reader.result, image: file })
      }
      reader.readAsDataURL(file)
    }
  }
  const handleUpdateArtist = async (e) => {
    e.preventDefault()
    if (state?.biography?.length < 20) {
      setState({ ...state, error: 'Remplissez la biographie' })
      return
    }
    setState({ ...state, loading: true })
    try {
      const charge = { ...state }
      delete charge.loading
      delete charge.countries
      delete charge.error
      delete charge.show
      const formData = new FormData()
      Object.keys(charge).forEach((key) => {
        formData.append(key, charge[key])
      })
      formData.delete('socials')
      formData.append('facebook', charge.socials.facebook)
      formData.append('twitter', charge.socials.twitter)
      formData.append('instagram', charge.socials.instagram)
      const updated = await update(artist?.id, formData)
      if (updated?.id) {
        closeModal()
      }
      setState({ ...state, loading: false, error: artist?.error })
    } catch (error) {
      setState({ ...state, loading: false })
    }
  }
  return (
    <>
      <div className="w-screen h-screen flex z-999 justify-center items-center bg-stone-950/80 fixed top-0 left-0">
        <div className="rounded-[4px] border border-border bg-kcb-noir h-7/9 py-6 px-4 w-13/15 xl:w-4/9 animate-scale-up overflow-auto">
          <div className="flex justify-between items-start mb-4">
            <p className="text-lg font-serif font-bold">Mettre l'artiste à jour</p>
            <button onClick={() => closeModal()}>
              <X className="w-4 " />
            </button>
          </div>
          {state?.error && (
            <div className="rounded-[4px] flex gap-3 p-4 bg-red-700/60 border border-red-500 text-white-900">
              <AlertCircle className="w-5 h-5" /> {state?.error}
            </div>
          )}
          <form
            onSubmit={handleUpdateArtist}
            method="post"
            className="flex flex-col gap-4 overflow-auto"
          >
            <div>
              {state?.image ? (
                <img
                  src={state?.show}
                  alt="Profile"
                  className="w-32 h-32 object-cover rounded-full mb-4 mx-auto"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-kcb-or/30 mb-4 flex justify-center items-center mx-auto">
                  <Camera className="w-10 text-kcb-or h-10 " />
                </div>
              )}
              <div className="mx-auto text-center flex flex-col">
                <button
                  type="button"
                  onClick={() => document.getElementById('profile-image').click()}
                  className="border border-border bg-kcb-ardoise w-1/2 mx-auto rounded-[4px] text-sm text-white font-medium px-4 py-2 my-2"
                >
                  Modifier la photo
                </button>
                <input
                  id="profile-image"
                  className=""
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="name" className="text-white font-semibold text-[16px] ">
                Nom complet
              </label>
              <input
                required
                onChange={(e) => setState({ ...state, name: e.target.value })}
                value={state?.name}
                minLength={5}
                id="name"
                name="name"
                type="text"
                className="border border-border rounded-[4px] bg-stone-700/90 px-4 py-2 font-normal text-[16px]"
                placeholder="Nom complet de l'artiste"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="username" className="text-white font-semibold text-[16px] ">
                Nom d'utilisateur
              </label>
              <input
                required
                onChange={(e) => setState({ ...state, username: e.target.value })}
                value={state?.username}
                minLength={5}
                id="username"
                name="username"
                type="text"
                className="border border-border rounded-[4px] bg-stone-700/90 px-4 py-2 font-normal text-[16px]"
                placeholder="Pseudo"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="country">Pays</label>
              <select
                name="country"
                onChange={(e) => setState({ ...state, country: e.target.value })}
                value={state.country}
                id="country"
                className="w-full border border-white/[0.06]/70  bg-kcb-ardoise rounded-[4px] mt-[5px] py-[7px] px-2"
                required
              >
                {state?.countries?.map((country, index) => (
                  <option key={index} value={country.name}>
                    {' '}
                    {country.name}{' '}
                  </option>
                ))}
              </select>
            </div>
            <div className="">
              <label htmlFor="biography" className="font-serif text-white font-medium text-lg">
                Biographie
              </label>
              <ReactQuill
                theme="snow"
                value={state.biography}
                onChange={(value) => setState({ ...state, biography: value })}
                className="border bg-white text-black border-background rounded-[4px] my-2"
                placeholder="Parlez-nous de lui"
              />
            </div>
            <div className="">
              <label htmlFor="portfolio" className="font-serif text-white font-medium text-lg">
                Portfolio (facultatif){' '}
              </label>
              <input
                onChange={(e) => setState({ ...state, portfolio: e.target.value })}
                value={state?.portfolio}
                name="portfolio"
                id="portfolio"
                cols="30"
                rows="5"
                className="w-full border border-border rounded-[4px] bg-kcb-noir px-3 py-2 text-white mt-2"
                placeholder="Lien de votre portfolio"
              />
            </div>

            <div className="flex items-center justify-end gap-4">
              <button
                onClick={() => closeModal()}
                className="border border-border rounded-[4px] px-4 py-2"
              >
                Annuler
              </button>
              <button type="submit" className="rounded-[4px] px-4 py-2.5 bg-green-600">
                {state?.loading ? <DataLoader /> : 'Modifer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
