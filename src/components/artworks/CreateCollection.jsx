import { FolderClosed, Image, Plus, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DataLoader } from '../loaders/PageLoader'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { useAuth } from '../../store/AuthContext'
import { useArtist } from '../../store/ArtistContext'
import { useCategoryStore } from '../../store/CategoryStore'
import { useCollections } from '../../store/CollectionStore'
import { useArtworkMutations } from '../../api/useArtworkMutationsQuery' /* ✨ React Query */

export function CreateCollection() {
  const [state, setState] = useState(false)
  return (
    <>
      <button
        onClick={() => {
          setState(true)
        }}
        className="rounded-[4px] border p-4 grid place-items-center gap-2 hover:bg-kcb-ardoise cursor-pointer"
      >
        <FolderClosed className="w-4 h-4 mx-auto" /> Ajouter une collection
      </button>
      {state && <AddCollectionModal closeModal={() => setState(false)} />}
    </>
  )
}

function AddCollectionModal({ closeModal }) {
  const { user, artistProfile, curatorProfile } = useAuth()
  const [state, setState] = useState({
    title: '',
    description: '',
    tags: [],
    artist: user?.role == 'artist' ? artistProfile?.name : '',
    userId: user?._id,
    artistId: user?.role == 'artist' ? artistProfile?._id : '',

    artworks: [],

    tag: '',
    loading: false,
    error: '',
  })
  const { myArtists } = useArtist()
  const { addCollection } = useCollections()
  const { submitArtwork } = useArtworkMutations() /* ✨ React Query */
  const artworkModel = {
    title: '',
    description: '',
    image: null,
    tags: [],
    price: '',
    forSale: true,
    currency: 'XOF',
    category: '',
    categoryId: '',
    artist: user?.role == 'artist' ? user?.name : '',
    artistId: user?.role == 'artist' ? artistProfile?._id : state?.artistId,
    userId: user?._id,
    forBid: false,
    height: '',
    width: '',
    weight: '',
    tag: '',
    show: '',
  }
  const handleSubmit = async function (e) {
    e.preventDefault()
    setState({ ...state, loading: true })
    try {
      if (state.description.length < 20)
        setState({ ...state, error: 'Remplissez la description (min 20)' })
      if (state.artworks.length == 0) setState({ ...state, error: 'Ajoutez au moins une oeuvre' })
      if (state.tags.length == 0) setState({ ...state, error: 'Ajoutez au moins un mot clé' })
      // Vérifier que chaque oeuvre a une image
      const missingImage = state.artworks.some((artwork) => !artwork.image)
      if (missingImage) {
        setState({ ...state, error: 'Chaque oeuvre doit avoir une image' })
        setTimeout(() => setState((s) => ({ ...s, error: '' })), 3000)
        setState((s) => ({ ...s, loading: false }))
        return
      }
      const charge = { ...state, artworkCount: state.artworks.length }
      delete charge.artworks
      delete charge.tag
      delete charge.loading
      delete charge.error
      const collection = await addCollection(charge)
      if (collection?._id) {
        for (const [index, artwork] of state.artworks.entries()) {
          const charge = {
            ...artwork,
            edition: JSON.stringify({
              number: index + 1,
              total: state?.artworks?.length,
            }),
          }
          delete charge.show
          const formData = new FormData()
          Object.entries(charge).forEach(([key, value]) => {
            if (key === 'image' && value instanceof File) {
              formData.append('image', value, value?.filename)
            } else if (value !== undefined && value !== null) {
              formData.append(key, value)
            }
          })
          formData.append('collectionId', collection._id)
          await submitArtwork(formData)
        }
        setState((s) => ({ ...s, loading: false }))
        closeModal()
      }
    } catch (error) {
      setState({ ...state, error: error.message, loading: false })
    }
  }
  return (
    <>
      <div
        className={`fixed bg-stone-950/80 z-90 h-screen w-screen top-0 left-0 animate-fade-in flex items-center justify-center`}
      >
        <div className="fixed z-100 bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-6 w-9/10 lg:w-3/7 h-7/9 animate-scale-up overflow-auto">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-playfair  text-lg text-center font-semi-bold tracking-tight text-white">
                {' '}
                Ajouter une collection d'oeuvres{' '}
              </p>
            </div>
            <button onClick={() => closeModal()}>
              {' '}
              <X className="w-4 h-4" />{' '}
            </button>
          </div>

          <div className="lg:flex py-4 gap-5">
            <form onSubmit={handleSubmit} method="post" className="py-4 w-full">
              {state?.error && <p className="text-red-100"> {state?.error} </p>}
              <div className="flex flex-col gap-1">
                <label htmlFor="description" className="text-sm text-white font-semibold">
                  Titre de la collection
                </label>
                <input
                  onChange={(e) => setState({ ...state, title: e.target.value })}
                  value={state.title}
                  type="text"
                  placeholder="Série Horizons urbains 2023"
                  className="py-1.5 px-3 rounded-[4px] shadow-lg border text-white"
                  required
                  minLength={10}
                />
              </div>
              <div className="flex flex-col mt-4">
                <label htmlFor="description" className="text-sm text-white font-semibold">
                  Description
                </label>
                <ReactQuill
                  theme="snow"
                  value={state.description}
                  onChange={(value) => setState({ ...state, description: value })}
                  className="border bg-white text-black border-background rounded-[4px] my-4"
                  placeholder="Décrivez le thème et l'intention artistique de votre collection..."
                />
              </div>
              {user?.role == 'curator' ||
                (user?.role == 'buyer' && (
                  <div className="grid mt-4">
                    <label htmlFor="artist" className="text-sm text-white font-semibold">
                      Artiste
                    </label>
                    <select
                      onChange={(e) =>
                        setState({
                          ...state,
                          artist: e.target.value,
                          artistId: myArtists.find((item) => item?.name == e.target.value)?._id,
                          artworks: state.artworks.map((item) => ({
                            ...item,
                            artist: e.target.value,
                            artistId: myArtists.find((item) => item?.name == e.target.value)?._id,
                          })),
                        })
                      }
                      name="artist"
                      id="artist"
                      className="rounded-[4px] bg-kcb-ardoise mt-1 border border-white/[0.06] px-3 py-1.5"
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
                        <option disabled>
                          Vous n'avez aucun artiste, ajoutez un artiste pour commencer
                        </option>
                      )}
                    </select>
                  </div>
                ))}
              <div className="flex flex-col mt-4">
                <label htmlFor="tags" className="text-sm text-white font-semibold">
                  Mots-clés
                </label>
                <div className="flex gap-1">
                  <input
                    onChange={(e) => setState({ ...state, tag: e.target.value })}
                    value={state.tag}
                    type="text"
                    className="w-full rounded-[4px] bg-kcb-ardoise mt-1 border border-white/[0.06] px-3 py-2"
                    placeholder="Ajoutez des mots-clés"
                    minLength={3}
                    maxLength={12}
                  />
                  <button
                    onClick={() => {
                      if (state.tag.length > 3 && state.tags.length < 5) {
                        setState({ ...state, tags: [...state.tags, state.tag], tag: '' })
                      }
                    }}
                    type="button"
                    className="bg-gray-300/20 text-white shadow-lg px-4 rounded-[4px]"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap">
                  {state.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="bg-kcb-ardoise flex animate-slide-left items-center gap-2 text-white rounded-full px-3 py-1 text-sm font-semibold mt-2 mr-2"
                    >
                      {tag}{' '}
                      <span
                        onClick={() =>
                          setState({ ...state, tags: state.tags.filter((item) => !(item == tag)) })
                        }
                        className="text-xs cursor-pointer"
                      >
                        x
                      </span>{' '}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between items-center my-4">
                  <p className="sm:text-xs md:text-md font-serif font-semibold text-white">
                    Oeuvres de la collection {state?.artworks?.length}{' '}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setState({ ...state, artworks: [...(state?.artworks ?? []), artworkModel] })
                    }}
                    className="rounded-[4px] p-2 bg-kcb-pierre/30 text-white text-xs flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4 text-white" />
                    Ajouter une oeuvre
                  </button>
                </div>
                <ArtworkShortList state={state} setState={setState} />
              </div>

              <div className="flex justify-end items-center gap-4 mt-8">
                <button className="border py-2 px-3 rounded-[4px]" onClick={() => closeModal()}>
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-[4px] bg-green-600 hover:opacity-90 flex items-center gap-3 py-2 px-3"
                >
                  {state?.loading ? (
                    <DataLoader />
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Ajouter
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

function ArtworkShortList({ state, setState }) {
  return (
    <>
      {state?.artworks?.length > 0 ? (
        state?.artworks?.map((artwork, index) => (
          <div key={index}>
            <ArtworkShortListItem
              setFormState={setState}
              formState={state}
              artwork={artwork}
              index={index}
            />
          </div>
        ))
      ) : (
        <div className="flex flex-col border rounded-[4px] py-6">
          <Image className="w-10 h-10 mx-auto" />
          <p className="font-serif text-white text-lg mx-auto">Aucune oeuvre ajoutée</p>
          <p className="mx-auto text-center text-xs">
            Commencez par ajouter des oeuvres à votre collection
          </p>
        </div>
      )}
    </>
  )
}

function ArtworkShortListItem({ setFormState, formState, artwork, index }) {
  const { categories } = useCategoryStore()
  const [state, setState] = useState({ ...artwork })
  useEffect(() => {
    setFormState((prev) => ({
      ...prev,
      artworks: formState.artworks.map((item, idx) => {
        if (idx == index) {
          return state
        }
        return item
      }),
    }))
  }, [state])
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setState({ ...state, image: file, show: reader.result })
      }
      reader.readAsDataURL(file)
    }
  }
  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }
  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setState({ ...state, show: reader.result, image: file })
      }
      reader.readAsDataURL(file)
    }
  }
  return (
    <>
      <form className="rounded-[4px] bg-kcb-ardoise my-4 shadow-lg">
        <div>
          {state?.image ? (
            <>
              <img
                src={state.show}
                alt={state.title}
                className="h-1/2 w-full rounded-t-lg h-80 object-cover"
              />
            </>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => document.getElementById('artwork-image').click()}
              className="flex justify-center items-center bg-gray-400/70 rounded-t-lg h-80"
            >
              <div className="flex flex-col">
                <Upload className="w-8 h-8 text-white mx-auto" />
                <p className="text-sm mx-auto">Cliquez pour ajouter une image</p>
                <input
                  className="bg-kcb-ardoise w-1/2 text-sm mx-auto rounded-[4px] border border-white/[0.06] px-3 py-1.5 cursor-pointer text-white font-medium"
                  id="artwork-image"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex flex-col gap-1">
            <label className="text-white text-sm font-semibold" htmlFor="title">
              Titre*
            </label>
            <input
              onChange={(e) => setState({ ...state, title: e.target.value })}
              value={state.title}
              type="text"
              className="py-1 5 px-4 border rounded-[4px] bg-kcb-noir"
              minLength={5}
              required
              placeholder="Titre de l'oeuvre"
            />
          </div>
          <div className="flex flex-col gap-1 mt-2">
            <label className="text-white text-sm font-semibold" htmlFor="description">
              Description*
            </label>
            <textarea
              onChange={(e) => setState({ ...state, description: e.target.value })}
              className="py-1 5 px-4 border rounded-[4px] bg-kcb-noir"
              minLength={5}
              required
              placeholder="Description de l'oeuvre"
            />
          </div>
          <div className="flex flex-col mt-4">
            <label htmlFor="category" className="text-sm text-white font-semibold">
              Catégorie
            </label>
            <select
              required
              onChange={(e) =>
                setState({
                  ...state,
                  category: e.target.value,
                  categoryId: categories.find((item) => item.title == e.target.value)._id,
                })
              }
              value={formState.category}
              name="category"
              id="category"
              className="rounded-[4px] bg-kcb-ardoise mt-1 border border-white/[0.06] px-3 py-1.5"
            >
              <option>Catégorie</option>
              {categories.map((category, index) => (
                <option key={index} value={category.name}>
                  {' '}
                  {category.name}{' '}
                </option>
              ))}
            </select>
          </div>

          <div className="flex mt-4">
            <label htmlFor="forSale">
              <input
                onChange={(e) => setState({ ...state, forSale: e.target.checked })}
                checked={state.forSale}
                type="checkbox"
                id="forSale"
                className="mr-2"
              />
              En vente ?
            </label>
          </div>

          <div>
            <label htmlFor="mensurations">Mensurations</label>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              <input
                className="w-full rounded-[4px] bg-kcb-ardoise mt-1 border border-white/[0.06] px-3 py-1.5"
                min={10}
                max={500}
                onChange={(e) => setState({ ...state, height: e.target.value })}
                name="height"
                type="number"
                placeholder="Taille de l'oeuvre en cm"
              />
              <input
                className="w-full rounded-[4px] bg-kcb-ardoise mt-1 border border-white/[0.06] px-3 py-1.5"
                min={10}
                max={500}
                onChange={(e) => setState({ ...state, width: e.target.value })}
                name="width"
                type="number"
                placeholder="Largeur de l'oeuvre cm"
              />
              <input
                className="w-full rounded-[4px] bg-kcb-ardoise mt-1 border border-white/[0.06] px-3 py-1.5"
                min={1}
                max={1000}
                onChange={(e) => setState({ ...state, weight: e.target.value })}
                name="weight"
                type="number"
                placeholder="Poids de l'oeuvre en kg"
              />
            </div>
          </div>

          <div className="grid">
            <label htmlFor="price" className="text-sm text-white font-semibold">
              Prix
            </label>
            <input
              onChange={(e) => setState({ ...state, price: e.target.value })}
              value={state.price}
              type="number"
              min={1}
              className="rounded-[4px] bg-kcb-ardoise mt-1 border border-white/[0.06] px-3 py-1.5"
              placeholder="Entrez le prix de l'oeuvre"
              required
            />
          </div>

          <div className="flex flex-col mt-4">
            <label htmlFor="tags" className="text-sm text-white font-semibold">
              Mots-clés*
            </label>
            <div className="flex gap-1">
              <input
                onChange={(e) => setState({ ...state, tag: e.target.value })}
                value={state.tag}
                type="text"
                className="w-full rounded-[4px] bg-kcb-ardoise mt-1 border border-white/[0.06] px-3 py-1.5"
                placeholder="Ajoutez des mots-clés"
                minLength={3}
                maxLength={12}
              />
              <button
                onClick={() => {
                  if (state.tag.length >= 3 && state.tags.length < 5) {
                    setState({ ...state, tags: [...state.tags, state.tag], tag: '' })
                  }
                }}
                type="button"
                className="bg-kcb-or text-white px-3 rounded-[4px]"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap">
              {state.tags.map((tag, index) => (
                <span
                  key={index}
                  className="bg-kcb-pierre/50 flex animate-slide-left items-center gap-2 text-white rounded-full px-3 py-1 text-sm font-semibold mt-2 mr-2"
                >
                  {tag}{' '}
                  <span
                    onClick={() =>
                      setState({ ...state, tags: state.tags.filter((item) => !(item == tag)) })
                    }
                    className="text-xs cursor-pointer"
                  >
                    x
                  </span>{' '}
                </span>
              ))}
            </div>
            <div className="flex my-4">
              <button
                onClick={() =>
                  setFormState({
                    ...formState,
                    artworks: formState.artworks.filter((item, idx) => idx != index),
                  })
                }
                type="button"
                className="p-2 bg-red-900 rounded-[4px]"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  )
}
