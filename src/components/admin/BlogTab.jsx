import { Plus } from 'lucide-react'
import { useBlog } from '../../api/useBlogQuery'
import { useState, useEffect } from 'react'
import { BlogTable } from './BlogTable'
import { useAuth } from '../../store/AuthContext'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { Modal, Input, Button, toast } from '../ui'

export function BlogTab() {
  const { blogPosts, archive } = useBlog()
  const [showModal, setShowModal] = useState(false)
  // Track initial load: the context starts with empty arrays and populates
  // asynchronously. We consider loading done once either array has data OR
  // a short settle window has elapsed (500 ms) to avoid infinite skeleton.
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (blogPosts.length > 0 || archive.length > 0) {
      setLoading(false)  
      return
    }
    const timer = setTimeout(() => setLoading(false), 500)
    return () => clearTimeout(timer)
  }, [blogPosts, archive])

  return (
    <>
      <div className="rounded-[4px] p-4 md:p-6 mb-6 shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Gestion des articles</h2>
          <button
            onClick={() => setShowModal(true)}
            className="rounded bg-kcb-or/90 hover:bg-kcb-or px-3 py-2 text-kcb-noir text-xs md:text-sm font-medium flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        </div>
        <div className="mb-6">
          <h3 className="text-base font-semibold text-kcb-sable mb-2">Articles publiés</h3>
          <BlogTable posts={blogPosts} loading={loading} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-kcb-sable mb-2">Articles archivés</h3>
          <BlogTable posts={archive} loading={loading} />
        </div>
      </div>
      {showModal && <AddPostModal closeModal={() => setShowModal(false)} />}
    </>
  )
}

function AddPostModal({ closeModal }) {
  const { addPost } = useBlog()
  const { user } = useAuth()
  const [state, setState] = useState({
    title: '',
    excerpt: '',
    image: '',
    content: '',
    authorId: user?.id,
    tags: [],
    tag: '',
    loading: false,
    show: '',
  })

  const handleAddPost = async (e) => {
    e.preventDefault()
    try {
      if (state?.tags?.length > 0) {
        setState({ ...state, loading: true })
        const charge = { ...state }
        delete charge.loading
        delete charge.tag
        delete charge.show
        const formData = new FormData()
        Object.keys(charge).forEach((key) => {
          if (key === 'image') {
            formData.append('image', charge?.image, charge?.image?.filename)
            return
          }
          formData.append(key, charge[key])
        })
        const added = await addPost(formData)
        if (added?.id || added?._id) {
          toast.success('✓ Article créé avec succès')
          closeModal()
        } else {
          toast.error('× ' + (added?.error || 'Erreur lors de la création'))
        }
        setState({ ...state, loading: false })
      } else {
        toast.error('× Ajoutez au moins un mot-clé')
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

  return (
    <Modal isOpen={true} onClose={closeModal} title="Ajouter un article" size="md">
      <form onSubmit={handleAddPost} className="space-y-4 max-h-[70vh] overflow-y-auto">
        <Input
          label="Titre"
          value={state.title}
          onChange={(e) => setState({ ...state, title: e.target.value })}
          placeholder="Titre de l'article"
          minLength={5}
          required
        />

        <Input
          label="Extrait"
          value={state.excerpt}
          onChange={(e) => setState({ ...state, excerpt: e.target.value })}
          placeholder="Extrait de l'article"
          minLength={5}
          required
        />

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-kcb-sable mb-2">Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full px-3 py-2 bg-kcb-ardoise border border-white/[0.06] rounded-[4px] text-kcb-sable text-sm"
            required
          />
          {state?.show && (
            <div className="mt-2 flex justify-center">
              <img src={state.show} alt="aperçu" className="rounded-[4px] h-20 object-contain" />
            </div>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-kcb-sable mb-2">Mots-clés</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={state.tag}
              onChange={(e) => setState({ ...state, tag: e.target.value })}
              placeholder="Mot-clé (max 12 caractères)"
              minLength={3}
              maxLength={12}
              className="flex-1 px-3 py-2 bg-kcb-ardoise border border-white/[0.06] rounded-[4px] text-white text-sm"
            />
            <button
              type="button"
              onClick={() => {
                if (state.tag.length > 0 && state.tags.length < 5) {
                  setState({ ...state, tags: [...state.tags, state.tag], tag: '' })
                }
              }}
              className="px-3 py-2 bg-kcb-or hover:bg-kcb-or/90 text-kcb-noir rounded-[4px] transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap mt-2 gap-2">
            {state.tags.map((tag, index) => (
              <span
                key={index}
                className="bg-kcb-bronze/50 text-kcb-noir rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-2"
              >
                {tag}
                <button
                  type="button"
                  onClick={() =>
                    setState({ ...state, tags: state.tags.filter((item) => item !== tag) })
                  }
                  className="ml-1 text-xs text-white/70 hover:text-red-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Content Editor */}
        <div>
          <label className="block text-sm font-medium text-kcb-sable mb-2">Contenu</label>
          <ReactQuill
            theme="snow"
            value={state.content}
            onChange={(value) => setState({ ...state, content: value })}
            className="border border-white/[0.06] rounded-[4px] bg-white text-black"
            placeholder="Contenu de votre article"
          />
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
