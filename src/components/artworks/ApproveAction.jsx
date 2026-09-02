import { Check, X } from 'lucide-react'
import { memo, useState } from 'react'
import { useArtworkMutations } from '../../api/useArtworkMutationsQuery' /* ✨ React Query */
import { useAuth } from '../../store/AuthContext'
import { DataLoader } from '../loaders/PageLoader'
import { ConfirmDialog } from '../ui'
import { createLog } from '../../api/useLog'

export const ApproveAction = memo(function ApproveAction({ artwork }) {
  const { approveArtwork } = useArtworkMutations() /* ✨ React Query */
  const { user: adminUser } = useAuth()
  const [state, setState] = useState({
    loading: false,
    error: '',
    confirmApprove: false,
    confirmReject: false,
  })

  const setStatus = async (status) => {
    setState((prev) => ({ ...prev, loading: true, confirmApprove: false, confirmReject: false }))
    const updated = await approveArtwork(artwork?.id, status)
    if (updated?.id) {
      createLog({
        description:
          status === 'approved'
            ? `Approbation de l'œuvre "${artwork?.title}" (KCB: ${artwork?.kucibok_id || artwork?.id})`
            : `Rejet de l'œuvre "${artwork?.title}" (KCB: ${artwork?.kucibok_id || artwork?.id})`,
        userId: adminUser?.id,
      })
      setState((prev) => ({ ...prev, loading: false }))
    } else {
      setState((prev) => ({ ...prev, loading: false, error: updated?.error }))
    }
  }

  return (
    <>
      <div className="flex gap-2">
        {(artwork?.status == 'pending' || artwork?.status == 'rejected') && (
          <button
            title="Approuver"
            onClick={() => setState((prev) => ({ ...prev, confirmApprove: true }))}
            className="rounded-[4px] bg-green-600 hover:opacity-90 flex items-center gap-3 p-2"
          >
            {state?.loading ? <DataLoader /> : <Check className="w-5 h-5" />}
          </button>
        )}
        {(artwork?.status == 'pending' || artwork?.status == 'approved') && (
          <button
            title="Rejeter"
            onClick={() => setState((prev) => ({ ...prev, confirmReject: true }))}
            className="rounded-[4px] bg-red-900 hover:opacity-90 flex items-center gap-3 p-2"
          >
            {state?.loading ? <DataLoader /> : <X className="w-5 h-5" />}
          </button>
        )}
      </div>

      <ConfirmDialog
        isOpen={state.confirmApprove}
        onClose={() => setState((prev) => ({ ...prev, confirmApprove: false }))}
        onConfirm={() => setStatus('approved')}
        title="Approuver l'œuvre"
        message={`Approuver "${artwork?.title}" ? Elle sera visible sur la plateforme.`}
        confirmText="Approuver"
        variant="primary"
        loading={state.loading}
      />

      <ConfirmDialog
        isOpen={state.confirmReject}
        onClose={() => setState((prev) => ({ ...prev, confirmReject: false }))}
        onConfirm={() => setStatus('rejected')}
        title="Rejeter l'œuvre"
        message={`Rejeter "${artwork?.title}" ? L'artiste sera notifié.`}
        confirmText="Rejeter"
        variant="danger"
        loading={state.loading}
      />
    </>
  )
})
