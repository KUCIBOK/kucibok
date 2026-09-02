import { useState } from 'react'
import { useArtworkMutations } from '../../api/useArtworkMutationsQuery' /* ✨ React Query */
import { Pen } from 'lucide-react'
import { Modal, Input, Button, toast } from '../ui'
import { DataLoader } from '../loaders/PageLoader'

export function UpdateEtherscan({ artwork }) {
  const [state, setState] = useState({
    show: false,
    loading: false,
  })
  return (
    <>
      <button
        onClick={() => setState({ ...state, show: true })}
        className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 transition flex items-center justify-center"
        title="Modifier l’adresse blockchain"
        aria-label="Modifier l’adresse blockchain"
      >
        {state.loading ? (
          <DataLoader />
        ) : (
          // Ethereum logo SVG
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
            className="w-5 h-5 text-kcb-pierre hover:text-green-500 transition"
            fill="none"
          >
            <g>
              <polygon points="16,3 16,22.7 27,16.1" fill="currentColor" opacity="0.8" />
              <polygon points="16,3 5,16.1 16,22.7" fill="currentColor" opacity="0.5" />
              <polygon points="16,25 16,29 27,18.2" fill="currentColor" opacity="0.8" />
              <polygon points="16,29 16,25 5,18.2" fill="currentColor" opacity="0.5" />
            </g>
          </svg>
        )}
      </button>
      {state.show && (
        <EtherscanModal artwork={artwork} closeModal={() => setState({ ...state, show: false })} />
      )}
    </>
  )
}

function EtherscanModal({ artwork, closeModal }) {
  const [state, setState] = useState({
    loading: false,
    etherscan: '',
  })
  const { modifyEtherscan } = useArtworkMutations() /* ✨ React Query */

  const handleSubmit = async (e) => {
    e.preventDefault()
    setState({ ...state, loading: true })
    const updated = await modifyEtherscan(artwork?.id, state?.etherscan)
    if (updated?.id) {
      toast.success('✓ Adresse blockchain mise à jour')
      closeModal()
    } else {
      toast.error('× ' + (updated?.error || 'Erreur'))
    }
    setState({ ...state, loading: false })
  }

  return (
    <Modal isOpen={true} onClose={closeModal} title="Modifier l'adresse blockchain" size="sm">
      <div className="mb-4">
        <p className="text-xs text-kcb-pierre">
          Œuvre : <span className="font-medium text-white">{artwork?.title}</span>
        </p>
      </div>
      <form onSubmit={handleSubmit} method="post" className="space-y-4">
        <Input
          label="Adresse blockchain"
          value={state.etherscan}
          onChange={(e) => setState({ ...state, etherscan: e.target.value })}
          placeholder="Entrez l'adresse blockchain"
          minLength={5}
          required
        />

        <Button type="submit" disabled={state.loading} loading={state.loading} className="w-full">
          <Pen className="w-4 h-4 mr-2" />
          Enregistrer
        </Button>
      </form>
    </Modal>
  )
}
