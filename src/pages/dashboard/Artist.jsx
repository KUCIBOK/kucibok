import {
  ChartColumn,
  Image,
  Menu,
  Plus,
  TrendingUp,
  User,
  Truck,
  Shield,
  Users,
  MessageSquare,
  DollarSign,
  Bell,
  ChevronRight,
  LayoutDashboard,
  Package,
  Settings,
  Gift,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../../store/LangContext'
import { uiT } from '../../i18n/ui'
import DashboardSidebar from '../../components/shared/DashboardSidebar'
import { EmailVerificationBanner } from '../../components/shared/EmailVerificationBanner'
import { ProfileCompletionBanner } from '../../components/shared/ProfileCompletionBanner'
import { ArtworksList } from '../../components/artworks/ArtworksList'
import { useAuth } from '../../store/AuthContext'
import { useMyArtworks } from '../../api/useAdminArtworksQuery' /* ✨ React Query */
import { Profile } from '../../components/artist/Profile'
import { Analytics } from '../../components/artist/Analytics'
import { Synthesis } from '../../components/artist/Synthesis'
import { DeliveryTab } from '../../components/delivery/DeliveryTab'
import { ClientsTab } from '../../components/artist/ClientsTab'
import { InsuranceTab } from '../../components/insurance/InsuranceTab'
import SupportTicketUser from '../../components/support/SupportTicketUser'
import ArtistSales from '../../components/artist/ArtistSales'
import ArtistNotifications from '../../components/artist/ArtistNotifications'
import { ArtistCertificationTab } from '../../components/artist/ArtistCertificationTab'
import { RewardsHub } from '../../components/artist/RewardsHub'

export default function Artist() {
  const { user, artistProfile, loading } = useAuth()
  const [toggle, setToggle] = useState(false)
  const { myArtworks, loading: artworksLoading } = useArtworks()
  const [tab, setTab] = useState(0)
  const { lang } = useLang()
  const td = uiT[lang].dashboards.artist

  const menuStructure = [
    {
      category: td.categories.dashboard,
      icon: <LayoutDashboard className="w-4 h-4" />,
      items: [
        { name: td.items.overview, icon: <TrendingUp className="w-4 h-4" />, index: 0 },
        { name: td.items.analytics, icon: <ChartColumn className="w-4 h-4" />, index: 4 },
      ],
    },
    {
      category: td.categories.artworksAndSales,
      icon: <Package className="w-4 h-4" />,
      items: [
        { name: td.items.artworks, icon: <Image className="w-4 h-4" />, index: 1 },
        { name: td.items.certifications, icon: <Shield className="w-4 h-4" />, index: 9 },
        { name: td.items.sales, icon: <DollarSign className="w-4 h-4" />, index: 5 },
      ],
    },
    {
      category: td.categories.clientsAndComms,
      icon: <Users className="w-4 h-4" />,
      items: [
        // ❌ DISABLED: /api/clients/all route doesn't exist (TODO: implement backend routes)
        // { name: td.items.clients, icon: <Users className="w-4 h-4" />, index: 3 },
        { name: td.items.notifications, icon: <Bell className="w-4 h-4" />, index: 6 },
        { name: td.items.support, icon: <MessageSquare className="w-4 h-4" />, index: 7 },
      ],
    },
    {
      category: td.categories.operations,
      icon: <Settings className="w-4 h-4" />,
      items: [{ name: td.items.logistics, icon: <Truck className="w-4 h-4" />, index: 2 }],
    },
    {
      category: td.categories.account,
      icon: <User className="w-4 h-4" />,
      items: [{ name: td.items.profile, icon: <User className="w-4 h-4" />, index: 8 }],
    },
    {
      category: td.categories.rewards,
      icon: <Gift className="w-4 h-4" />,
      items: [{ name: td.items.rewards, icon: <Gift className="w-4 h-4" />, index: 10 }],
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
        return <Synthesis setTab={setTab} />
      case 1:
        // ✅ Show loading state while artworks are being fetched
        if (artworksLoading && (!myArtworks || myArtworks.length === 0)) {
          return (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-kcb-or border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-kcb-pierre">Chargement de vos œuvres...</p>
              </div>
            </div>
          )
        }
        return (
          <ArtworksList
            user={user}
            title={td.titles.artworkSubmission}
            artworks={myArtworks}
          />
        )
      case 2:
        return <DeliveryTab />
      case 3:
        return <ClientsTab />
      case 4:
        return (
          <Analytics
            user={user}
            title={td.titles.artworkAnalytics}
            artistProfile={artistProfile}
            artworks={myArtworks}
          />
        )
      case 5:
        return <ArtistSales />
      case 6:
        return <ArtistNotifications />
      case 7:
        return <SupportTicketUser />
      case 8:
        return <Profile />
      case 9:
        return <ArtistCertificationTab />
      case 10:
        return <RewardsHub />
      default:
        return null
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
        {/* Sticky top bar — mobile only */}
        <header className="lg:hidden sticky top-0 z-10 flex items-center justify-between px-4 h-14 bg-kcb-ardoise border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setToggle(true)}
              className="text-kcb-pierre hover:text-white p-1"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-white text-sm font-medium truncate">
              {getCurrentPageInfo().page}
            </span>
          </div>
          <Link to="submit-artwork">
            <Plus className="w-5 h-5 text-kcb-or" />
          </Link>
        </header>

        {/* Sidebar */}
        <DashboardSidebar
          menuStructure={menuStructure}
          profile={artistProfile}
          tab={tab}
          setTab={setTab}
          toggle={toggle}
          setToggle={setToggle}
          cta={{
            to: 'submit-artwork',
            label: td.cta,
            icon: <Plus className="w-4 h-4" />,
            className: 'bg-kcb-or text-kcb-noir hover:bg-kcb-bronze',
          }}
        />

        {/* Main content */}
        <main className="flex-1 px-4 md:px-8 py-6 overflow-y-auto min-w-0">
          <EmailVerificationBanner />
          <ProfileCompletionBanner setTab={setTab} />
          {/* Breadcrumb — desktop only */}
          <div className="hidden lg:flex items-center gap-2 text-sm text-kcb-pierre mb-6">
            <span>{getCurrentPageInfo().category}</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white font-medium">{getCurrentPageInfo().page}</span>
          </div>
          {renderTab()}
        </main>
      </div>
    </>
  )
}
