import { useState } from 'react'
import { useArtworkMutations } from '../../api/useArtworkMutationsQuery' /* ✨ React Query */
import { Camera, PenBox } from 'lucide-react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { useCategoryStore } from '../../store/CategoryStore'
import { Modal, Input, Select, Button, toast } from '../ui'

export function UpdateArtworkAction({ artwork }) {
  const [state, setState] = useState({
    modal: false,
  })

  return (
    <>
      <button
        title="Mettre à jour"
        className="rounded-[4px] p-2 text-white flex items-center bg-forest/90"
        onClick={() => setState({ ...state, modal: true })}
      >
        <PenBox className="w-4 h-4 text-white" />
      </button>

      {state?.modal && (
        <UpdateArtworkModal
          artwork={artwork}
          closeModal={() => setState({ ...state, modal: false })}
        />
      )}
    </>
  )
}

function UpdateArtworkModal({ artwork, closeModal }) {
  const { updateArtwork } = useArtworkMutations() /* ✨ React Query */
  const { categories } = useCategoryStore()
  const [state, setState] = useState({
    ...artwork,
    loading: false,
    error: '',
    show: artwork?.image,
  })
  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setState({ ...state, loading: true })

      // ✅ FIX: Only include editable fields (avoid sending system/non-editable fields)
      // Map camelCase to snake_case for DB column names
      const FIELD_MAPPING = {
        title: 'title',
        description: 'description',
        price: 'price',
        status: 'status',
        category: 'category',
        image: 'image',
        provenance: 'provenance',
        materials: 'materials',
        dimensions: 'dimensions',
        year: 'year',
        condition: 'condition',
        height: 'height',
        width: 'width',
        weight: 'weight',
        forSale: 'for_sale', // ← camelCase to snake_case
      }

      const charge = {}
      Object.entries(FIELD_MAPPING).forEach(([jsKey, dbKey]) => {
        if (jsKey in state && state[jsKey] !== undefined && state[jsKey] !== null) {
          charge[dbKey] = state[jsKey]
        }
      })

      const formData = new FormData()
      Object.keys(charge).forEach((key) => {
        formData.append(key, charge[key])
      })

      const updated = await updateArtwork(artwork?.id, formData)
      if (updated?.id) {
        toast.success('✓ Œuvre mise à jour')
        closeModal()
      } else {
        toast.error('× Erreur lors de la mise à jour')
        setState({ ...state, loading: false, error: updated?.error })
      }
    } catch (error) {
      toast.error('× Erreur serveur')
      setState({ ...state, loading: false })
    }
  }
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
  const categoryOptions = categories.map((cat) => ({ value: cat.title, label: cat.title }))

  return (
    <Modal isOpen={true} onClose={closeModal} title="Modifier l'œuvre" size="lg">
      <form
        onSubmit={handleSubmit}
        method="post"
        className="space-y-4 max-h-[70vh] overflow-y-auto"
      >
        {/* Image Upload */}
        <div className="flex flex-col items-center">
          {state?.image ? (
            <img
              src={state?.show}
              alt="Artwork"
              className="w-20 h-20 object-cover rounded-full mb-3 border border-white/[0.06]"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-kcb-or/10 mb-3 flex justify-center items-center border border-white/[0.06]">
              <Camera className="w-8 h-8 text-kcb-or" />
            </div>
          )}
          <button
            type="button"
            onClick={() => document.getElementById('image').click()}
            className="text-xs font-medium px-3 py-2 border border-white/[0.06] bg-kcb-ardoise hover:bg-kcb-ardoise rounded transition"
          >
            Modifier la photo
          </button>
          <input
            id="image"
            className="hidden"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>

        {/* Form Fields */}
        <Input
          label="Titre"
          value={state.title}
          onChange={(e) => setState({ ...state, title: e.target.value })}
          placeholder="Titre de l'œuvre"
          minLength={3}
          required
        />

        <Input
          label="Artiste"
          value={state.artist}
          onChange={(e) => setState({ ...state, artist: e.target.value })}
          placeholder="Nom de l'artiste"
          required
        />

        <Select
          label="Catégorie"
          options={categoryOptions}
          value={state.category}
          onChange={(value) => {
            const cat = categories.find((c) => c.title === value)
            setState({
              ...state,
              category: value,
              categoryId: cat?._id,
            })
          }}
          required
        />

        <Input
          label="Prix"
          type="number"
          value={state.price}
          onChange={(e) => setState({ ...state, price: e.target.value })}
          placeholder="Prix"
          min={1}
          required
        />

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-kcb-sable mb-2">Description</label>
          <ReactQuill
            theme="snow"
            value={state.description}
            onChange={(value) => setState({ ...state, description: value })}
            className="border border-white/[0.06] rounded-[4px] bg-white text-black"
            placeholder="Parlez-nous de votre œuvre"
          />
        </div>

        {/* Mensurations */}
        <div>
          <label className="block text-sm font-medium text-kcb-sable mb-2">Mensurations</label>
          <div className="grid grid-cols-3 gap-2">
            <Input
              type="number"
              value={state?.height}
              onChange={(e) => setState({ ...state, height: e.target.value })}
              placeholder="Hauteur (cm)"
              min={10}
              max={500}
            />
            <Input
              type="number"
              value={state?.width}
              onChange={(e) => setState({ ...state, width: e.target.value })}
              placeholder="Largeur (cm)"
              min={10}
              max={500}
            />
            <Input
              type="number"
              value={state?.weight}
              onChange={(e) => setState({ ...state, weight: e.target.value })}
              placeholder="Poids (kg)"
              min={1}
              max={1000}
            />
          </div>
        </div>

        {/* For Sale Checkbox */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="forSale"
            checked={state.forSale}
            onChange={(e) => setState({ ...state, forSale: e.target.checked })}
            className="w-4 h-4 accent-kcb-or"
          />
          <label htmlFor="forSale" className="text-sm text-kcb-sable">
            Mettre en vente
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={closeModal}>
            Annuler
          </Button>
          <Button type="submit" disabled={state.loading} loading={state.loading}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
