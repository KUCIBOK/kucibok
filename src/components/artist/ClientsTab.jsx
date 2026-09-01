import { Users, Lock } from 'lucide-react'

/**
 * ClientsTab (Artist) — DISABLED in Phase 0
 *
 * This component was using ClientContext which caused the 0→300 jump bug.
 * The feature is temporarily disabled and will be reimplemented in Phase 5
 * with proper state management (React Query).
 *
 * TODO: Reimplement with React Query in Phase 5
 */

export const ClientsTab = ({ user }) => {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <Lock className="w-16 h-16 text-kcb-pierre mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-bold text-white mb-2">Feature désactivée</h3>
        <p className="text-kcb-pierre mb-1">
          La gestion des clients a été temporairement désactivée
        </p>
        <p className="text-sm text-kcb-pierre">
          ℹ️ Réimplémentation prévue en Phase 5 avec React Query
        </p>
      </div>
    </div>
  )
}

export default ClientsTab
