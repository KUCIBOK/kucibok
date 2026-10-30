import { useState, useEffect, useCallback } from 'react'
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  ArrowUpRight,
  Filter,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { utils } from '../../api/useAPI'
import { KPICard, ErrorState } from '../ui'

/** Libellés lisibles pour les types de transaction */
const TYPE_LABELS = {
  artwork_sale: "Vente d'œuvre",
  subscription: 'Abonnement',
  commission: 'Commission',
}

/** Couleurs badge selon statut */
const STATUS_COLORS = {
  completed: 'bg-green-500/15 text-green-300 border border-green-500/30',
  pending: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30',
  failed: 'bg-red-500/15 text-red-300 border border-red-500/30',
}

/** Labels FR pour les statuts */
const STATUS_LABELS = {
  completed: 'Complétée',
  pending: 'En attente',
  failed: 'Échouée',
}

/**
 * Formate un montant avec séparateur de milliers + devise.
 *
 * @param {number} amount
 * @param {string} [currency="XOF"]
 * @returns {string}
 */
function formatAmount(amount, currency = 'XOF') {
  return `${amount.toLocaleString('fr-FR')} ${currency}`
}

/**
 * Retourne le mois au format "YYYY-MM" d'une date ISO.
 *
 * @param {string} dateStr
 * @returns {string}
 */
function toYearMonth(dateStr) {
  return dateStr.slice(0, 7)
}

/**
 * Retourne le libellé court du mois (ex: "Mar 2026").
 *
 * @param {string} yearMonth — format "YYYY-MM"
 * @returns {string}
 */
function formatMonthLabel(yearMonth) {
  const [year, month] = yearMonth.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
}

/**
 * Calcule les KPI agrégés à partir des transactions.
 *
 * @param {Array} transactions
 * @returns {{ gmv: number, commissions: number, countThisMonth: number, avgValue: number }}
 */
function computeKPIs(transactions) {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const completed = transactions.filter((t) => t.status === 'completed')
  const gmv = completed.reduce((sum, t) => sum + t.amount, 0)
  const commissions = completed.reduce((sum, t) => {
    return sum + (t.commission != null ? t.commission : t.amount * 0.1)
  }, 0)
  const countThisMonth = transactions.filter((t) => toYearMonth(t.created_at) === thisMonth).length
  const avgValue = completed.length > 0 ? Math.round(gmv / completed.length) : 0

  return { gmv, commissions, countThisMonth, avgValue }
}

/**
 * Calcule les données mensuelles des 6 derniers mois.
 *
 * @param {Array} transactions
 * @returns {Array<{ month: string, label: string, gmv: number, commissions: number, count: number }>}
 */
function computeMonthlyData(transactions) {
  const now = new Date()
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({ month: key, label: formatMonthLabel(key), gmv: 0, commissions: 0, count: 0 })
  }

  transactions.forEach((t) => {
    const key = toYearMonth(t.created_at)
    const entry = months.find((m) => m.month === key)
    if (!entry) return
    if (t.status === 'completed') {
      entry.gmv += t.amount
      entry.commissions += t.commission != null ? t.commission : t.amount * 0.1
    }
    entry.count += 1
  })

  return months
}

/**
 * Onglet Finance / Revenus du dashboard admin.
 * Charge les transactions depuis l'API et affiche KPIs, tableau, et historique mensuel.
 *
 * @returns {JSX.Element}
 */
export function RevenueTab() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMonth, setFilterMonth] = useState('all')

  const loadTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${utils.api}/transactions`, { ...utils.options })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      const list = Array.isArray(data) ? data : (data?.data ?? [])
      setTransactions(list)
      setLoadError(null)
    } catch (err) {
      setTransactions([])
      setLoadError(err.message === 'API error' ? 'Transactions indisponibles' : err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  // Months available for the filter dropdown
  const availableMonths = [...new Set(transactions.map((t) => toYearMonth(t.created_at)))]
    .sort()
    .reverse()

  // Filtered transactions (sorted newest first)
  const filtered = transactions
    .filter((t) => filterType === 'all' || t.type === filterType)
    .filter((t) => filterStatus === 'all' || t.status === filterStatus)
    .filter((t) => filterMonth === 'all' || toYearMonth(t.created_at) === filterMonth)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const kpis = computeKPIs(transactions)
  const monthlyData = computeMonthlyData(transactions)

  // Calcul du MoM réel à partir des données mensuelles
  const lastTwoMonths = monthlyData.slice(-2)
  const prevGmv = lastTwoMonths[0]?.gmv ?? 0
  const currGmv = lastTwoMonths[1]?.gmv ?? 0
  const momPct = prevGmv > 0 ? Math.round(((currGmv - prevGmv) / prevGmv) * 100) : null
  const maxGmv = Math.max(...monthlyData.map((m) => m.gmv), 1)

  return (
    <div className="space-y-6 pb-10">
      {loadError && <ErrorState title="Impossible de charger les transactions" error={loadError} onRetry={loadTransactions} />}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Revenus & Finance</h1>
          <p className="text-kcb-pierre mt-1">Suivi des transactions et performances financières</p>
        </div>
        <button
          onClick={loadTransactions}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-kcb-or hover:bg-kcb-bronze disabled:opacity-50 rounded-[4px] text-kcb-noir text-sm font-medium transition"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Actualiser
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={DollarSign}
          label="GMV (complétées)"
          value={formatAmount(kpis.gmv)}
          iconColor="text-green-400"
          iconBgColor="bg-green-900/20"
          trend={
            momPct !== null
              ? {
                  value: `${momPct >= 0 ? '+' : ''}${momPct}% MoM`,
                  direction: momPct >= 0 ? 'up' : 'down',
                }
              : undefined
          }
          loading={loading}
        />
        <KPICard
          icon={TrendingUp}
          label="Commissions perçues"
          value={formatAmount(Math.round(kpis.commissions))}
          iconColor="text-kcb-or"
          iconBgColor="bg-kcb-or/10"
          subtitle="10% sur ventes complétées"
          loading={loading}
        />
        <KPICard
          icon={ShoppingBag}
          label="Transactions ce mois"
          value={kpis.countThisMonth}
          iconColor="text-kcb-bronze"
          iconBgColor="bg-kcb-bronze/10"
          loading={loading}
        />
        <KPICard
          icon={ArrowUpRight}
          label="Valeur moyenne"
          value={formatAmount(kpis.avgValue)}
          iconColor="text-amber-400"
          iconBgColor="bg-amber-900/20"
          subtitle="Par transaction complétée"
          loading={loading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-[#13161e] border border-white/[0.06] rounded-[4px] p-4">
        <Filter className="w-4 h-4 text-kcb-pierre flex-shrink-0" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] text-white text-sm px-3 py-2 focus:outline-none focus:border-kcb-or transition"
        >
          <option value="all">Tous les types</option>
          <option value="artwork_sale">Ventes d'œuvres</option>
          <option value="subscription">Abonnements</option>
          <option value="commission">Commissions</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] text-white text-sm px-3 py-2 focus:outline-none focus:border-kcb-or transition"
        >
          <option value="all">Tous les statuts</option>
          <option value="completed">Complétées</option>
          <option value="pending">En attente</option>
          <option value="failed">Échouées</option>
        </select>

        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] text-white text-sm px-3 py-2 focus:outline-none focus:border-kcb-or transition"
        >
          <option value="all">Tous les mois</option>
          {availableMonths.map((m) => (
            <option key={m} value={m}>
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>

        <span className="text-kcb-pierre text-sm ml-auto">
          {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Transactions table */}
      <div className="bg-[#13161e] border border-white/[0.06] rounded-[4px] overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-kcb-or animate-spin" />
              <span className="ml-3 text-kcb-pierre">Chargement des transactions...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-kcb-pierre">
              Aucune transaction correspondant aux filtres.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-kcb-pierre text-left">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Œuvre / Objet</th>
                  <th className="px-4 py-3 font-medium text-right">Montant</th>
                  <th className="px-4 py-3 font-medium text-right">Commission</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const commission =
                    t.commission != null
                      ? t.commission
                      : t.status === 'completed'
                        ? Math.round(t.amount * 0.1)
                        : 0
                  return (
                    <tr
                      key={t._id}
                      className="border-b border-white/[0.06]/60 hover:bg-kcb-ardoise/30 transition"
                    >
                      <td className="px-4 py-3 text-kcb-sable whitespace-nowrap">
                        {new Date(t.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-kcb-sable">{TYPE_LABELS[t.type] ?? t.type}</td>
                      <td className="px-4 py-3 text-kcb-sable max-w-[160px] truncate">
                        {t.artworkTitle ?? <span className="text-kcb-pierre italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-white font-semibold text-right whitespace-nowrap">
                        {formatAmount(t.amount, t.currency)}
                      </td>
                      <td className="px-4 py-3 text-green-300 text-right whitespace-nowrap">
                        {commission > 0 ? (
                          formatAmount(commission, t.currency)
                        ) : (
                          <span className="text-kcb-pierre">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] ?? 'bg-kcb-ardoise text-kcb-sable'}`}
                        >
                          {STATUS_LABELS[t.status] ?? t.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Monthly revenue history (CSS bars — no Chart.js dependency) */}
      <div className="bg-[#13161e] border border-white/[0.06] rounded-[4px] p-6">
        <h2 className="text-white font-semibold text-lg mb-5">
          Revenus mensuels — 6 derniers mois
        </h2>
        <div className="space-y-4">
          {monthlyData.map((m) => (
            <div key={m.month}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-kcb-sable w-24">{m.label}</span>
                <span className="text-kcb-pierre text-xs">{m.count} tx</span>
                <span className="text-white font-medium ml-auto">{formatAmount(m.gmv)}</span>
                <span className="text-green-300 text-xs ml-4 w-28 text-right">
                  {m.commissions > 0 ? `+${formatAmount(Math.round(m.commissions))}` : '—'}
                </span>
              </div>
              <div className="h-2 bg-kcb-ardoise rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-kcb-or to-kcb-bronze rounded-full transition-all duration-500"
                  style={{ width: `${(m.gmv / maxGmv) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex gap-6 mt-5 text-xs text-kcb-pierre">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-kcb-or inline-block" /> GMV
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Commissions
          </span>
        </div>
      </div>
    </div>
  )
}

export default RevenueTab
