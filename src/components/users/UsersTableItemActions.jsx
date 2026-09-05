import { useState } from 'react'
import { useUsersContext } from '../../store/UsersStore'
import { useAuth } from '../../store/AuthContext'
import { LockOpen, Lock, Trash2 } from 'lucide-react'
import { DataLoader } from '../loaders/PageLoader'
import { ConfirmDialog } from '../ui'
import { createLog } from '../../api/useLog'

export function UserTableItemActions({ user }) {
  const isActive = user?.isActive ?? user?.is_active ?? false
  const { setStatus, deleteUser } = useUsersContext()
  const { user: adminUser } = useAuth()
  const [state, setState] = useState({
    loading: false,
    confirmDelete: false,
    confirmSuspend: false,
  })

  const handleDeleteUser = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, confirmDelete: false }))
      await deleteUser(user?._id)
      createLog({
        description: `Suppression de l'utilisateur "${user?.name}" (${user?.email}) — rôle : ${user?.role}`,
        userId: adminUser?._id,
      })
      setState((prev) => ({ ...prev, loading: false }))
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false }))
    }
  }

  const handleSetStatus = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, confirmSuspend: false }))
      await setStatus(user?._id)
      createLog({
        description: isActive
          ? `Suspension de l'utilisateur "${user?.name}" (${user?.email})`
          : `Réactivation de l'utilisateur "${user?.name}" (${user?.email})`,
        userId: adminUser?._id,
      })
      setState((prev) => ({ ...prev, loading: false }))
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false }))
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        {isActive ? (
          <button
            onClick={() => setState((prev) => ({ ...prev, confirmSuspend: true }))}
            className="rounded-full bg-kcb-ardoise p-2 hover:bg-kcb-ardoise transition flex items-center justify-center shadow-none border-none"
            title="Suspendre"
          >
            {state?.loading ? <DataLoader /> : <Lock className="w-4 h-4 text-kcb-or" />}
          </button>
        ) : (
          <button
            onClick={() => setState((prev) => ({ ...prev, confirmSuspend: true }))}
            className="rounded-full bg-kcb-ardoise p-2 hover:bg-kcb-ardoise transition flex items-center justify-center shadow-none border-none"
            title="Réactiver"
          >
            {state?.loading ? <DataLoader /> : <LockOpen className="w-4 h-4 text-green-500" />}
          </button>
        )}
        <button
          onClick={() => setState((prev) => ({ ...prev, confirmDelete: true }))}
          className="rounded-full bg-kcb-ardoise p-2 hover:bg-kcb-ardoise transition flex items-center justify-center shadow-none border-none"
          title="Supprimer"
        >
          {state?.loading ? <DataLoader /> : <Trash2 className="w-4 h-4 text-red-500" />}
        </button>
      </div>

      <ConfirmDialog
        isOpen={state.confirmDelete}
        onClose={() => setState((prev) => ({ ...prev, confirmDelete: false }))}
        onConfirm={handleDeleteUser}
        title="Supprimer l'utilisateur"
        message={`Supprimer définitivement "${user?.name}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        variant="danger"
        loading={state.loading}
      />

      <ConfirmDialog
        isOpen={state.confirmSuspend}
        onClose={() => setState((prev) => ({ ...prev, confirmSuspend: false }))}
        onConfirm={handleSetStatus}
        title={isActive ? "Suspendre l'utilisateur" : "Réactiver l'utilisateur"}
        message={
          isActive
            ? `Suspendre "${user?.name}" ? Il ne pourra plus se connecter.`
            : `Réactiver le compte de "${user?.name}" ?`
        }
        confirmText={isActive ? 'Suspendre' : 'Réactiver'}
        variant={isActive ? 'danger' : 'primary'}
        loading={state.loading}
      />
    </>
  )
}
