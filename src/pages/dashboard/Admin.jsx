import { useState } from 'react'
import { useAuth } from '../../store/AuthContext'
import { useLang } from '../../store/LangContext'
import { uiT } from '../../i18n/ui'
import { CURRENCIES } from '../../lib/currency'
import { ArtworksList } from '../../components/artworks/ArtworksList'
import { useDashboardStats } from '../../api/useDashboardArtworksQuery' /* ✨ React Query */
import {
  ChartColumn,
  CheckCheck,
  Clock,
  ContactRound,
  CreditCard,
  FileText,
  Gavel,
  Menu,
  Palette,
  Scan,
  Shield,
  ShoppingBag,
  TrendingUp,
  Truck,
  Users,
  Mail,
  GalleryHorizontalEnd,
  ChevronRight,
  LayoutDashboard,
  Settings,
  MessageSquare,
  X,
} from 'lucide-react'
import DashboardSidebar from '../../components/shared/DashboardSidebar'
import { BlogTab } from '../../components/admin/BlogTab'
import { UsersTab } from '../../components/users/UsersTab'
import { Analytics } from '../../components/admin/Analytics'
import { PlansTab } from '../../components/plans/PlansTab'
import { CategoryTab } from '../../components/category/CategoryTab'
import { LogsTab } from '../../components/logsComponents/LogsTab'
import { SubscriptionTab } from '../../components/subscriptions/SusbscriptionsTab'
import { Link } from 'react-router-dom'
import { AuctionTab } from '../../components/professional/AuctionTab'
import { useNumerisation } from '../../store/NumerisationStore'
import { NumerisationList } from '../../components/numerisation/NumeristionList'
import ClientsTab from '../../components/admin/ClientsTab'
import { CampainTab } from '../../components/admin/CampainTab'
import GalleriesTab from '../../components/admin/GalleriesTab'
import SupportTicketTab from '../../components/admin/SupportTicketTab'
import LogidooDashboard from '../../components/admin/LogidooDashboard'
import { AdminArtistsTab } from '../../components/admin/AdminArtistsTab'
export default function Admin() {
  const { pending, approved, rejected } = useDashboardStats() /* ✨ React Query */
  const { numerisations } = useNumerisation()
  const [toggle, setToggle] = useState(false)
  const { user, loading } = useAuth()
  const [tab, setTab] = useState(0)
  const [currency, setCurrency] = useState('EUR')
  const { lang } = useLang()
  const td = uiT[lang].dashboards.admin

  const menuStructure = [
    {
      category: td.categories.dashboard,
      icon: <LayoutDashboard className="w-4 h-4" />,
      items: [{ name: td.items.dashboard, icon: <TrendingUp className="w-4 h-4" />, index: 0 }],
    },
    {
      category: td.categories.artworkManagement,
      icon: <Palette className="w-4 h-4" />,
      items: [
        { name: td.items.pending, icon: <Clock className="w-4 h-4" />, index: 1 },
        { name: td.items.approved, icon: <CheckCheck className="w-4 h-4" />, index: 2 },
        { name: td.items.rejected, icon: <X className="w-4 h-4" />, index: 3 },
        { name: td.items.digitizations, icon: <Scan className="w-4 h-4" />, index: 5 },
        { name: td.items.auctions, icon: <Gavel className="w-4 h-4" />, index: 6 },
      ],
    },
    {
      category: td.categories.usersAndClients,
      icon: <Users className="w-4 h-4" />,
      items: [
        { name: td.items.users, icon: <Users className="w-4 h-4" />, index: 4 },
        { name: td.items.artists, icon: <Palette className="w-4 h-4" />, index: 17 },
        { name: td.items.clientPortfolio, icon: <ContactRound className="w-4 h-4" />, index: 7 },
        { name: td.items.scrapedGalleries, icon: <GalleryHorizontalEnd className="w-4 h-4" />, index: 16 },
      ],
    },
    {
      category: td.categories.marketingAndComms,
      icon: <Mail className="w-4 h-4" />,
      items: [
        { name: td.items.blogPosts, icon: <FileText className="w-4 h-4" />, index: 8 },
        { name: td.items.emailCampaigns, icon: <Mail className="w-4 h-4" />, index: 15 },
        { name: td.items.supportTickets, icon: <MessageSquare className="w-4 h-4" />, index: 10 },
      ],
    },
    {
      category: td.categories.operations,
      icon: <Settings className="w-4 h-4" />,
      items: [
        { name: td.items.logistics, icon: <Truck className="w-4 h-4" />, index: 9 },
        { name: td.items.categories, icon: <FileText className="w-4 h-4" />, index: 12 },
        { name: td.items.logs, icon: <ChartColumn className="w-4 h-4" />, index: 14 },
      ],
    },
    {
      category: td.categories.subscriptionsAndPlans,
      icon: <CreditCard className="w-4 h-4" />,
      items: [
        { name: td.items.plans, icon: <CreditCard className="w-4 h-4" />, index: 11 },
        { name: td.items.subscriptions, icon: <Users className="w-4 h-4" />, index: 13 },
      ],
    },
  ]

  const getCurrentPageInfo = () => {
    for (const menu of menuStructure) {
      const item = menu.items.find((i) => i.index === tab)
      if (item) {
        return { category: menu.category, page: item.name }
      }
    }
    return { category: td.breadcrumb.defaultCategory, page: td.breadcrumb.defaultPage }
  }

  const renderTab = () => {
    switch (tab) {
      case 0:
        return <Analytics currency={currency} />
      case 1:
        return <ArtworksList user={user} title={td.titles.pendingArtworks} artworks={pending} />
      case 2:
        return <ArtworksList user={user} title={td.titles.approvedArtworks} artworks={approved} />
      case 3:
        return <ArtworksList user={user} title={td.titles.rejectedArtworks} artworks={rejected} />
      case 4:
        return <UsersTab />
      case 5:
        return (
          <div>
            <h3 className="text-2xl text-white mb-4">{td.titles.deliveryRequests}</h3>
            <NumerisationList numerisations={numerisations} />
          </div>
        )
      case 6:
        return <AuctionTab />
      case 7:
        return <ClientsTab />
      case 8:
        return <BlogTab />
      case 9:
        return <LogidooDashboard />
      case 10:
        return (
          <div>
            <h3 className="text-2xl text-white mb-4">{td.titles.supportTickets}</h3>
            <SupportTicketTab />
          </div>
        )
      case 11:
        return <PlansTab />
      case 12:
        return <CategoryTab />
      case 13:
        return <SubscriptionTab />
      case 14:
        return <LogsTab />
      case 15:
        return <CampainTab />
      case 16:
        return <GalleriesTab />
      case 17:
        return <AdminArtistsTab />
      default:
        return (
          <div className="text-center text-kcb-pierre">
            {td.titles.featureUnavailable}
          </div>
        )
    }
  }
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kcb-noir">
        <div className="w-8 h-8 border-2 border-kcb-or border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen flex flex-col lg:flex-row bg-kcb-noir">
        {/* Sidebar */}
        <DashboardSidebar
          menuStructure={menuStructure}
          profile={user}
          tab={tab}
          setTab={setTab}
          toggle={toggle}
          setToggle={setToggle}
          cta={[
            {
              to: '/dashboard/artist',
              label: 'Vue Artiste',
              icon: <Palette className="w-4 h-4" />,
              className: 'bg-kcb-ardoise border border-white/[0.06] hover:bg-kcb-pierre',
            },
            {
              to: '/dashboard/advisor',
              label: 'Vue Advisor',
              icon: <TrendingUp className="w-4 h-4" />,
              className: 'bg-kcb-ardoise border border-white/[0.06] hover:bg-kcb-pierre',
            },
            {
              to: '/dashboard/curator',
              label: 'Vue Curateur',
              icon: <ShoppingBag className="w-4 h-4" />,
              className: 'bg-kcb-ardoise border border-white/[0.06] hover:bg-kcb-pierre',
            },
          ]}
        />
        {/* Main content */}
        <main className="flex-1 px-4 md:px-8 py-8 overflow-y-auto">
          {/* Breadcrumb + Currency switcher */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-kcb-pierre">
              <span>{getCurrentPageInfo().category}</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-white font-medium">{getCurrentPageInfo().page}</span>
            </div>
            {tab === 0 && (
              <div className="flex items-center gap-1 bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-1">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => setCurrency(c.code)}
                    className={`px-3 py-1 rounded text-xs font-medium transition ${
                      currency === c.code
                        ? 'bg-kcb-or text-kcb-noir'
                        : 'text-kcb-pierre hover:text-white'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:hidden flex justify-end mb-4">
            <button onClick={() => setToggle(!toggle)} className="text-kcb-pierre hover:text-white">
              <Menu className="w-6 h-6" />
              <span className="sr-only">Toggle menu</span>
            </button>
          </div>
          {renderTab()}
        </main>
      </div>
    </>
  )
}
