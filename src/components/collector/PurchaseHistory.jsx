/**
 * PurchaseHistory.jsx — Purchase history / transactions
 * Distinct from collection: only platform purchases, not digitized works
 */

import { useState } from 'react'
import { usePurchaseHistory } from '../../api/usePurchaseHistoryQuery'
import { Download, Eye } from 'lucide-react'

const STATUS_LABELS = {
  paid: { label: 'Payé', color: 'bg-green-900/20 text-green-300' },
  pending: { label: 'En attente', color: 'bg-yellow-900/20 text-yellow-300' },
  refunded: { label: 'Remboursé', color: 'bg-red-900/20 text-red-300' },
}

export default function PurchaseHistory() {
  const [filters, setFilters] = useState({
    status: '',
    from_date: '',
    to_date: '',
  })

  const { data, isLoading, error } = usePurchaseHistory(filters)
  const transactions = data?.transactions || []

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Mes Achats</h1>
        <p className="text-kcb-pierre">
          {data?.count || 0} achat{data?.count !== 1 ? 's' : ''} effectué{data?.count !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-3 py-2 bg-kcb-noir border border-white/[0.06] rounded-[4px] text-white text-sm focus:outline-none focus:border-kcb-or"
          >
            <option value="">Statut: Tous</option>
            <option value="paid">Payé</option>
            <option value="pending">En attente</option>
            <option value="refunded">Remboursé</option>
          </select>
          <input
            type="date"
            value={filters.from_date}
            onChange={(e) => handleFilterChange('from_date', e.target.value)}
            className="px-3 py-2 bg-kcb-noir border border-white/[0.06] rounded-[4px] text-white text-sm focus:outline-none focus:border-kcb-or"
          />
          <input
            type="date"
            value={filters.to_date}
            onChange={(e) => handleFilterChange('to_date', e.target.value)}
            className="px-3 py-2 bg-kcb-noir border border-white/[0.06] rounded-[4px] text-white text-sm focus:outline-none focus:border-kcb-or"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-kcb-or border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-900 rounded-[4px] p-4 text-red-300 text-sm">
          {error.message}
        </div>
      )}

      {!isLoading && transactions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-kcb-pierre mb-4">Aucune transaction trouvée</p>
          <p className="text-sm text-kcb-sable">Explorez le catalogue pour faire un achat</p>
        </div>
      )}

      {/* Transactions Table */}
      {transactions.length > 0 && (
        <div className="overflow-x-auto">
          <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-white/[0.06] bg-kcb-noir">
                <tr>
                  <th className="text-left px-4 py-3 text-kcb-pierre font-medium">Date</th>
                  <th className="text-left px-4 py-3 text-kcb-pierre font-medium">Œuvre</th>
                  <th className="text-left px-4 py-3 text-kcb-pierre font-medium">Artiste</th>
                  <th className="text-right px-4 py-3 text-kcb-pierre font-medium">Montant</th>
                  <th className="text-center px-4 py-3 text-kcb-pierre font-medium">Statut</th>
                  <th className="text-center px-4 py-3 text-kcb-pierre font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => {
                  const statusInfo = STATUS_LABELS[transaction.status] || STATUS_LABELS.pending
                  return (
                    <tr
                      key={transaction.id}
                      className="border-b border-white/[0.06] hover:bg-kcb-noir transition"
                    >
                      <td className="px-4 py-3 text-white">
                        {new Date(transaction.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-white truncate max-w-xs">
                        {transaction.artwork_title}
                      </td>
                      <td className="px-4 py-3 text-kcb-pierre">{transaction.artist_name}</td>
                      <td className="px-4 py-3 text-right text-kcb-or font-medium">
                        ${transaction.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block text-xs font-medium px-2 py-1 rounded ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          {transaction.receipt_url && (
                            <a
                              href={transaction.receipt_url}
                              download
                              className="p-1 text-kcb-or hover:bg-kcb-noir rounded transition"
                              title="Télécharger le reçu"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            className="p-1 text-kcb-pierre hover:text-kcb-or hover:bg-kcb-noir rounded transition"
                            title="Voir détails"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
