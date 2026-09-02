import { Clock, Image, TrendingUp, Truck, Users } from 'lucide-react'
import { RewardsWidget } from './RewardsWidget'
import { useArtist } from '../../store/ArtistContext'
import { useMyArtworks } from '../../api/useAdminArtworksQuery' /* ✨ React Query */
import { Link } from 'react-router-dom'
import { ArtistTable } from '../artists/ArtistTable'
import { ArtworksList } from '../artworks/ArtworksList'
import { Bar, Pie } from 'react-chartjs-2'
import {
  ArcElement,
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { CreateCollection } from '../artworks/CreateCollection'
import { KPICard, SkeletonKPI, SkeletonChart, EmptyState } from '../ui'
import { useT } from '../../i18n'
import { artistT } from '../../i18n/artist'
import { useLang } from '../../store/LangContext'

export function Synthesis({ setTab }) {
  const { myArtworks, loading } = useMyArtworks() /* ✨ React Query */
  const t = useT(artistT).synthesis
  const { lang } = useLang()
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  const monthlySales = myArtworks
    ?.filter(
      (artwork) =>
        artwork.sold &&
        artwork.sold_price &&
        artwork.sold_at &&
        new Date(artwork.sold_at).getMonth() === currentMonth &&
        new Date(artwork.sold_at).getFullYear() === currentYear
    )
    .reduce((sum, artwork) => sum + Number(artwork.sold_price || 0), 0)

  const deliveredArtworks = myArtworks?.filter(
    (item) => item?.delivery_status === 'delivered' || item?.isDelivered === true
  )?.length
  const soldArtworksNumber = myArtworks?.filter((item) => item?.sold === true)?.length

  // Calcul du chiffre d'affaires pour chaque mois de l'année courante
  const monthlyRevenue = Array.from({ length: 12 }, (_, month) => {
    return (
      myArtworks
        ?.filter(
          (artwork) =>
            artwork.sold &&
            artwork.sold_price &&
            artwork.sold_at &&
            new Date(artwork.sold_at).getMonth() === month &&
            new Date(artwork.sold_at).getFullYear() === currentYear
        )
        .reduce((sum, artwork) => sum + Number(artwork.sold_price || 0), 0) || 0
    )
  })

  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const monthLabels = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2024, i, 1))
  )

  ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

  const barData = {
    labels: monthLabels,
    datasets: [
      {
        label: t.revenueDatasetLabel,
        data: monthlyRevenue,
        backgroundColor: 'rgba(45,106,79,0.7)',
        borderRadius: 6,
      },
    ],
  }

  const barOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => value.toLocaleString(),
          color: '#fff',
        },
        grid: { color: '#333' },
      },
      x: {
        ticks: { color: '#fff' },
        grid: { color: '#333' },
      },
    },
  }
  ChartJS.register(ArcElement)

  const soldCount = myArtworks?.filter((a) => a.sold)?.length || 0
  const forSaleCount = myArtworks?.filter((a) => a.status === 'approved' && a.for_sale)?.length || 0
  const pendingCount = myArtworks?.filter((a) => a.status === 'pending')?.length || 0

  const pieData = {
    labels: t.pieLabels,
    datasets: [
      {
        data: [soldCount, forSaleCount, pendingCount],
        backgroundColor: [
          'rgba(45,106,79,0.8)', // green for sold
          'rgba(201,168,76,0.8)', // gold for for sale
          'rgba(212,160,23,0.8)', // amber for pending
        ],
        borderWidth: 1,
      },
    ],
  }

  const pieOptions = {
    plugins: {
      legend: {
        labels: {
          color: '#fff',
          font: { size: 14 },
        },
      },
    },
    maintainAspectRatio: false,
  }

  if (loading) {
    return (
      <>
        {/* KPI skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full lg:px-2">
          <SkeletonKPI />
          <SkeletonKPI />
          <SkeletonKPI />
        </div>

        {/* Chart skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 my-4">
          <SkeletonChart height="h-52" />
          <SkeletonChart height="h-52" />
        </div>
        <SkeletonChart height="h-48" />
      </>
    )
  }

  return (
    <>
      {/* Statistiques synthétiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full lg:px-2">
        <KPICard
          icon={Image}
          label={t.kpi.totalArtworks}
          value={myArtworks?.length}
          iconColor="text-kcb-or"
          iconBgColor="bg-kcb-or/10"
        />

        <KPICard
          icon={TrendingUp}
          label={t.kpi.monthlySales}
          value={`${monthlySales?.toLocaleString(locale)} CFA`}
          iconColor="text-green-400"
          iconBgColor="bg-green-900/20"
        />

        <KPICard
          icon={Truck}
          label={t.kpi.delivered}
          value={`${deliveredArtworks}/${soldArtworksNumber}`}
          subtitle={t.kpi.deliveredSubtitle(
            (soldArtworksNumber > 0 ? (deliveredArtworks / soldArtworksNumber) * 100 : 0).toFixed(0)
          )}
          iconColor="text-kcb-or"
          iconBgColor="bg-kcb-or/10"
        />
      </div>

      {/* Actions rapides */}
      <div className="rounded-[4px] border border-white/[0.06] p-4 my-4">
        <h3 className="flex gap-2 items-center mb-3 text-sm font-semibold text-white">
          <Clock className="w-4 h-4 text-kcb-or" /> {t.quickActions}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="submit-artwork"
            className="rounded-[4px] border border-white/[0.06] p-3 flex flex-col items-center gap-2 hover:bg-white/[0.04] text-xs text-kcb-sable text-center transition"
          >
            <Image className="w-4 h-4" />
            {t.addArtwork}
          </Link>
          <CreateCollection />
        </div>
      </div>

      {/* Rewards widget */}
      <RewardsWidget onNavigate={() => setTab?.(10)} />

      {/* Graphiques et liste */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-4 shadow-sm overflow-hidden">
          <h3 className="text-sm font-semibold text-white mb-3">{t.monthlyRevenue}</h3>
          <div className="w-full overflow-x-auto">
            <Bar data={barData} options={barOptions} height={200} />
          </div>
        </div>
        <div className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-4 shadow-sm overflow-hidden">
          {myArtworks?.length === 0 ? (
            <EmptyState
              icon={Image}
              title={t.noArtwork}
              description={t.noArtworkDesc}
              actionLabel={t.noArtworkAction}
              onAction={() => {}}
            />
          ) : (
            <ArtworksList title={t.myArtworks} artworks={myArtworks?.slice(0, 5) || []} />
          )}
        </div>
      </div>

      {/* Pie chart */}
      <div className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-white mb-3">{t.catalogDistrib}</h3>
        <div className="h-48 md:h-56 flex items-center justify-center">
          <Pie data={pieData} options={pieOptions} />
        </div>
      </div>
    </>
  )
}
