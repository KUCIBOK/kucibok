import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Image,
  Palette,
  TrendingUp,
  Truck,
  BarChart3,
  Target,
  Award,
  DollarSign,
  ArrowUp,
  ArrowDown,
  Clock,
  AlertCircle,
  CheckCircle,
  Package,
  Zap,
} from 'lucide-react'
import { fmtMoney } from '../../lib/currency'
import { useAuth } from '../../store/AuthContext'
import { useArtist } from '../../store/ArtistContext'
import { useMyArtworks } from '../../api/useAdminArtworksQuery' /* ✨ React Query */
import { AddArtistAction } from './AddArtistAction'
import { Link } from 'react-router-dom'
import { ArtworksList } from '../artworks/ArtworksList'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
  ArcElement,
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { CreateCollection } from '../artworks/CreateCollection'
import { KPICard, SkeletonKPI, SkeletonChart, EmptyState } from '../ui'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
)

const MONTH_LABELS = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Aoû',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
]

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}

const CHART_GRID_COLOR = 'rgba(255,255,255,0.04)'
const CHART_TICK_COLOR = '#9AA0AC'

export function Synthesis() {
  const { curatorProfile } = useAuth()
  const { myArtists, loading: artistsLoading } = useArtist()
  const { data: myArtworks = [], isLoading: artworksLoading } = useMyArtworks() /* ✨ React Query */
  const isLoading = artistsLoading || artworksLoading || myArtists == null || myArtworks == null

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const artworks = myArtworks ?? []
  const artists = myArtists ?? []

  const soldArtworks = useMemo(() => artworks.filter((a) => a.sold), [artworks])
  const forSaleArtworks = useMemo(
    () => artworks.filter((a) => a.status === 'approved' && a.for_sale && !a.sold),
    [artworks]
  )
  const pendingArtworks = useMemo(() => artworks.filter((a) => a.status === 'pending'), [artworks])
  const inTransitArtworks = useMemo(
    () => artworks.filter((a) => a.delivery_status === 'in_transit'),
    [artworks]
  )

  const totalRevenue = useMemo(
    () => soldArtworks.reduce((s, a) => s + Number(a.sold_price || 0), 0),
    [soldArtworks]
  )

  const monthlySales = useMemo(
    () =>
      artworks
        .filter(
          (a) =>
            a.sold &&
            a.sold_at &&
            new Date(a.sold_at).getMonth() === currentMonth &&
            new Date(a.sold_at).getFullYear() === currentYear
        )
        .reduce((s, a) => s + Number(a.sold_price || 0), 0),
    [artworks, currentMonth, currentYear]
  )

  const avgPrice = soldArtworks.length > 0 ? totalRevenue / soldArtworks.length : 0
  const conversionRate = artworks.length > 0 ? (soldArtworks.length / artworks.length) * 100 : 0
  const deliveredCount = artworks.filter(
    (a) => a.delivery_status === 'delivered' || a.isDelivered
  ).length

  const artworksWithROI = useMemo(
    () =>
      artworks
        .filter((a) => a.sold && a.estimated_price && a.sold_price)
        .map((a) => ({
          title: a.title || 'Sans titre',
          roi:
            ((Number(a.sold_price) - Number(a.estimated_price)) / Number(a.estimated_price || 1)) *
            100,
        }))
        .sort((a, b) => b.roi - a.roi),
    [artworks]
  )
  const bestROI = artworksWithROI[0]

  const monthlyRevenue = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) =>
        artworks
          .filter(
            (a) =>
              a.sold &&
              a.sold_at &&
              new Date(a.sold_at).getMonth() === m &&
              new Date(a.sold_at).getFullYear() === currentYear
          )
          .reduce((s, a) => s + Number(a.sold_price || 0), 0)
      ),
    [artworks, currentYear]
  )

  const avgMonthly = monthlyRevenue.reduce((a, b) => a + b, 0) / 12
  const revenueGrowth = monthlyRevenue[currentMonth] > avgMonthly ? 5 : -3

  const artistsData = useMemo(
    () =>
      artists
        .map((artist) => {
          const sales = artworks.filter((a) => a.artist_id === artist.id && a.sold)
          return {
            name: artist.name,
            salesCount: sales.length,
            totalSales: sales.reduce((s, a) => s + Number(a.sold_price || 0), 0),
          }
        })
        .sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, 8),
    [artists, artworks]
  )

  // ── chart configs ──

  const barData = {
    labels: MONTH_LABELS,
    datasets: [
      {
        label: 'CA (XOF)',
        data: monthlyRevenue,
        backgroundColor: '#C9A84C',
        borderRadius: 4,
        borderColor: '#C9A84C',
      },
    ],
  }
  const barOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: CHART_TICK_COLOR, callback: (v) => (v / 1000000).toFixed(1) + 'M' },
        grid: { color: CHART_GRID_COLOR },
      },
      x: { ticks: { color: CHART_TICK_COLOR }, grid: { color: CHART_GRID_COLOR } },
    },
  }

  const donutData = {
    labels: ['Vendues', 'En vente', 'En attente', 'En transit'],
    datasets: [
      {
        data: [
          soldArtworks.length,
          forSaleArtworks.length,
          pendingArtworks.length,
          inTransitArtworks.length,
        ],
        backgroundColor: ['#C9A84C', '#8B6914', '#4A4E5A', '#6B7280'],
        borderWidth: 0,
      },
    ],
  }
  const donutOptions = {
    plugins: {
      legend: { labels: { color: CHART_TICK_COLOR, font: { size: 12 } } },
    },
    maintainAspectRatio: false,
    cutout: '65%',
  }

  const lineData = {
    labels: MONTH_LABELS,
    datasets: [
      {
        label: 'Tendance',
        data: monthlyRevenue,
        borderColor: '#C9A84C',
        backgroundColor: 'rgba(201,168,76,0.06)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#C9A84C',
        pointRadius: 4,
      },
    ],
  }
  const lineOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: CHART_TICK_COLOR, callback: (v) => (v / 1000000).toFixed(1) + 'M' },
        grid: { color: CHART_GRID_COLOR },
      },
      x: { ticks: { color: CHART_TICK_COLOR }, grid: { color: CHART_GRID_COLOR } },
    },
  }

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonKPI key={i} />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonKPI key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonChart height="h-64" />
          <SkeletonChart height="h-64" />
        </div>
        <SkeletonChart height="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-kcb-ardoise border border-white/[0.06] rounded-[4px] px-5 py-4"
      >
        <div>
          <h1 className="font-playfair text-xl text-white">
            {greeting}
            {curatorProfile?.name ? `, ${curatorProfile.name.split(' ')[0]}` : ''}.
          </h1>
          <p className="text-kcb-pierre text-sm mt-0.5">
            {artworks.length} œuvre{artworks.length !== 1 ? 's' : ''} &middot; {artists.length}{' '}
            artiste{artists.length !== 1 ? 's' : ''} &middot; {soldArtworks.length} vente
            {soldArtworks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {pendingArtworks.length > 0 && (
            <div className="flex items-center gap-2 bg-kcb-or/10 border border-kcb-or/20 rounded-[4px] px-3 py-1.5 text-xs text-kcb-or">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {pendingArtworks.length} en attente de validation
            </div>
          )}
          <Link
            to="add-artwork"
            className="flex items-center gap-2 bg-kcb-or text-kcb-noir px-4 py-2 rounded-[4px] text-xs font-semibold hover:bg-kcb-bronze transition"
          >
            <Image className="w-3.5 h-3.5" />
            Ajouter une œuvre
          </Link>
        </div>
      </motion.div>

      {/* KPI row 1 */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <motion.div variants={fadeUp}>
          <KPICard
            icon={Palette}
            label="Mes artistes"
            value={artists.length}
            iconColor="text-kcb-bronze"
            iconBgColor="bg-kcb-bronze/10"
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <KPICard
            icon={Image}
            label="Oeuvres totales"
            value={artworks.length}
            iconColor="text-kcb-or"
            iconBgColor="bg-kcb-or/10"
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <KPICard
            icon={TrendingUp}
            label="CA ce mois"
            value={fmtMoney(monthlySales, 'XOF', { compact: true })}
            trend={{
              value: revenueGrowth > 0 ? `+${revenueGrowth}%` : `${revenueGrowth}%`,
              direction: revenueGrowth > 0 ? 'up' : 'down',
            }}
            iconColor="text-kcb-or"
            iconBgColor="bg-kcb-or/10"
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <KPICard
            icon={Truck}
            label="Livrées / Vendues"
            value={`${deliveredCount}/${soldArtworks.length}`}
            subtitle={`${soldArtworks.length > 0 ? ((deliveredCount / soldArtworks.length) * 100).toFixed(0) : 0}% livrées`}
            iconColor="text-kcb-bronze"
            iconBgColor="bg-kcb-bronze/10"
          />
        </motion.div>
      </motion.div>

      {/* KPI row 2 */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          {
            label: 'Revenue total',
            value: fmtMoney(totalRevenue, 'XOF', { compact: true }),
            sub: 'Toutes ventes',
            icon: DollarSign,
            color: 'text-kcb-or',
          },
          {
            label: 'Prix moyen',
            value: fmtMoney(avgPrice, 'XOF', { compact: true }),
            sub: 'Par œuvre vendue',
            icon: Target,
            color: 'text-kcb-bronze',
          },
          {
            label: 'Taux conversion',
            value: `${conversionRate.toFixed(1)}%`,
            sub: `${soldArtworks.length} / ${artworks.length} œuvres`,
            icon: ArrowUp,
            color: 'text-kcb-or',
          },
          {
            label: 'Meilleur ROI',
            value: bestROI ? `${bestROI.roi.toFixed(1)}%` : '—',
            sub: bestROI?.title ?? 'Aucune vente',
            icon: Award,
            color: bestROI && bestROI.roi >= 0 ? 'text-kcb-or' : 'text-kcb-pierre',
          },
        ].map((kpi, i) => (
          <motion.div
            key={i}
            variants={fadeUp}
            className="bg-kcb-ardoise rounded-[4px] p-4 border border-white/[0.06]"
          >
            <div className="flex justify-between items-center mb-2">
              <p className="text-kcb-pierre text-xs">{kpi.label}</p>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-kcb-pierre mt-1 truncate">{kpi.sub}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Artwork pipeline */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-4"
      >
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-kcb-or" />
          Pipeline des œuvres
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'En attente',
              count: pendingArtworks.length,
              border: 'border-kcb-or/30',
              text: 'text-kcb-or',
              bg: 'bg-kcb-or/5',
              icon: Clock,
            },
            {
              label: 'En vente',
              count: forSaleArtworks.length,
              border: 'border-kcb-bronze/30',
              text: 'text-kcb-bronze',
              bg: 'bg-kcb-bronze/5',
              icon: Zap,
            },
            {
              label: 'Vendues',
              count: soldArtworks.length,
              border: 'border-white/10',
              text: 'text-white',
              bg: 'bg-white/5',
              icon: CheckCircle,
            },
            {
              label: 'En transit',
              count: inTransitArtworks.length,
              border: 'border-kcb-pierre/20',
              text: 'text-kcb-pierre',
              bg: 'bg-kcb-pierre/5',
              icon: Truck,
            },
          ].map((s) => (
            <div key={s.label} className={`border rounded-[4px] p-3 ${s.border} ${s.bg}`}>
              <div className={`flex items-center justify-between mb-1 ${s.text}`}>
                <span className="text-xs">{s.label}</span>
                <s.icon className="w-3.5 h-3.5 opacity-60" />
              </div>
              <p className={`text-2xl font-bold ${s.text}`}>{s.count}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.34 }}
        className="bg-kcb-ardoise rounded-[4px] p-4 border border-white/[0.06]"
      >
        <h3 className="text-sm font-semibold text-white mb-3">Actions rapides</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <AddArtistAction />
          <Link
            to="add-artwork"
            className="rounded-[4px] border border-white/[0.06] p-3 flex flex-col items-center gap-2 hover:bg-white/[0.04] cursor-pointer transition text-kcb-pierre hover:text-white"
          >
            <Image className="w-4 h-4" />
            <span className="text-xs text-center">Ajouter une œuvre</span>
          </Link>
          <CreateCollection />
        </div>
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-kcb-ardoise rounded-[4px] p-4 border border-white/[0.06]"
        >
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-kcb-or" />
            Chiffre d'affaires mensuel
          </h3>
          <Bar data={barData} options={barOptions} height={220} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.44 }}
          className="bg-kcb-ardoise rounded-[4px] p-4 border border-white/[0.06]"
        >
          <h3 className="text-sm font-semibold text-white mb-4">Répartition des œuvres</h3>
          <div className="h-[220px]">
            <Doughnut data={donutData} options={donutOptions} />
          </div>
        </motion.div>
      </div>

      {/* Trend + inline forecast */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-kcb-ardoise rounded-[4px] p-4 border border-white/[0.06]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-kcb-bronze" />
            Tendance des ventes
          </h3>
          <div className="flex items-center gap-4">
            {['Mois +1', 'Mois +2', 'Mois +3'].map((label, i) => {
              const projected = avgMonthly * (1 + (revenueGrowth / 100) * (i + 1))
              return (
                <div key={i} className="text-center">
                  <p className="text-xs font-semibold text-kcb-or">
                    {fmtMoney(projected, 'XOF', { compact: true })}
                  </p>
                  <p className="text-xs text-kcb-pierre">{label}</p>
                </div>
              )
            })}
          </div>
        </div>
        <Line data={lineData} options={lineOptions} height={180} />
        <p className="text-xs text-kcb-pierre mt-3">
          Prévisions basées sur une croissance de {revenueGrowth > 0 ? '+' : ''}
          {revenueGrowth}% / mois
        </p>
      </motion.div>

      {/* Top artists + Recent artworks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="bg-kcb-ardoise rounded-[4px] p-4 border border-white/[0.06]"
        >
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-kcb-or" />
            Top artistes par CA
          </h3>
          {artistsData.length > 0 ? (
            <div className="space-y-3">
              {artistsData.slice(0, 6).map((artist, idx) => {
                const maxSales = artistsData[0].totalSales || 1
                const pct = (artist.totalSales / maxSales) * 100
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="w-4 text-xs text-kcb-pierre text-right shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{artist.name}</p>
                      <div className="h-1 rounded-full bg-white/[0.06] mt-1">
                        <div className="h-1 rounded-full bg-kcb-or" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-kcb-or">
                        {fmtMoney(artist.totalSales, 'XOF', { compact: true })}
                      </p>
                      <p className="text-xs text-kcb-pierre">
                        {artist.salesCount} vente{artist.salesCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={Palette}
              title="Aucun artiste"
              description="Ajoutez votre premier artiste pour commencer."
            />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-kcb-ardoise rounded-[4px] p-4 border border-white/[0.06] overflow-auto"
        >
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Image className="w-4 h-4 text-kcb-bronze" />
            Œuvres récentes
          </h3>
          {artworks.length > 0 ? (
            <ArtworksList title="" artworks={artworks.slice(0, 5)} />
          ) : (
            <EmptyState
              icon={Image}
              title="Aucune œuvre"
              description="Soumettez votre première œuvre pour la voir ici."
            />
          )}
        </motion.div>
      </div>

      {/* ROI Analysis */}
      {artworksWithROI.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="bg-kcb-ardoise rounded-[4px] p-4 border border-white/[0.06]"
        >
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-kcb-or" />
            Analyse ROI par œuvre (Top 10)
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {artworksWithROI.slice(0, 10).map((artwork, idx) => (
              <div
                key={idx}
                className="bg-kcb-noir/50 rounded-[4px] p-3 flex justify-between items-center"
              >
                <p className="text-sm text-white truncate flex-1">
                  {idx + 1}. {artwork.title}
                </p>
                <div
                  className={`flex items-center gap-1 ml-3 shrink-0 ${artwork.roi >= 0 ? 'text-kcb-or' : 'text-red-400'}`}
                >
                  {artwork.roi >= 0 ? (
                    <ArrowUp className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5" />
                  )}
                  <span className="text-sm font-semibold">{artwork.roi.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
