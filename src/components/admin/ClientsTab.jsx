import { useState } from 'react'
import { useAllClients, useDeleteClientMutation } from '../../api/useClientsQuery'
import { Edit, Trash2, Plus } from 'lucide-react'
import { Button, EmptyState, Skeleton } from '../ui'

/**
 * ClientsTab — Admin clients management (reactive with React Query)
 *
 * Displays all clients with actions: edit, delete
 * Phase 5: Implement ClientsModal for create/edit
 */

const ClientsTab = () => {
  const { clients, loading } = useAllClients()
  const deleteClientMutation = useDeleteClientMutation()
  const [selectedClient, setSelectedClient] = useState(null)

  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce client?')) {
      deleteClientMutation.mutate(id)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-white/[0.06] rounded-[4px] p-4 animate-pulse">
            <Skeleton width="w-64" height="h-4" className="mb-2" />
            <Skeleton width="w-48" height="h-3" />
          </div>
        ))}
      </div>
    )
  }

  if (!clients || clients.length === 0) {
    return (
      <EmptyState
        icon={Plus}
        title="Aucun client trouvé"
        description="Les clients apparaîtront ici une fois qu'ils auront été ajoutés."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Gestion des clients ({clients.length})</h3>
        <Button variant="primary" icon={Plus} onClick={() => {}}>
          Ajouter un client
        </Button>
      </div>

      <div className="border border-white/[0.06] rounded-[4px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-kcb-noir-deep border-b border-white/[0.06]">
                <th className="px-4 py-3 text-left text-sm font-medium text-kcb-pierre">Nom</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-kcb-pierre">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-kcb-pierre">Rôle</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-kcb-pierre">Téléphone</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-kcb-pierre">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr
                  key={client.id || client._id}
                  className="border-b border-white/[0.06] hover:bg-kcb-noir-deep/50 transition"
                >
                  <td className="px-4 py-3 text-sm text-white font-medium">
                    {client.name || client.full_name || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-kcb-pierre">{client.email || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-block px-2 py-1 rounded-[4px] text-xs font-medium bg-kcb-or/20 text-kcb-or">
                      {client.role || 'client'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-kcb-pierre">{client.phone || 'N/A'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setSelectedClient(client)}
                        className="p-2 hover:bg-white/[0.06] rounded-[4px] transition text-kcb-pierre hover:text-white"
                        title="Éditer"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(client.id || client._id)}
                        disabled={deleteClientMutation.isPending}
                        className="p-2 hover:bg-red-900/20 rounded-[4px] transition text-kcb-pierre hover:text-red-400 disabled:opacity-50"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ClientsTab
