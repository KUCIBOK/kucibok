import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Activity,
  Briefcase,
  TrendingUp,
  Users,
  FileText,
  CreditCard,
  Menu,
  ChevronRight,
  LayoutDashboard,
  Settings,
  Heart,
} from 'lucide-react'
import { useAuth } from '../../store/AuthContext'
import { useLang } from '../../store/LangContext'
import { uiT } from '../../i18n/ui'
import DashboardSidebar from '../../components/shared/DashboardSidebar'
import { EmailVerificationBanner } from '../../components/shared/EmailVerificationBanner'
import { AdvisorOverview } from '../../components/advisor/AdvisorOverview'
import { AdvisorClients } from '../../components/advisor/AdvisorClients'
import { AdvisorDealPipeline } from '../../components/advisor/AdvisorDealPipeline'
import { AdvisorMarketIntelligence } from '../../components/advisor/AdvisorMarketIntelligence'
import { CuratorCatalogue } from '../../components/curator/CuratorCatalogue'
import { MyShortlist } from '../../components/curator/MyShortlist'
import { AdvisorReports } from '../../components/advisor/AdvisorReports'
import { AdvisorAbonnement } from '../../components/advisor/AdvisorAbonnement'
import { Profile } from '../../components/professional/Profile'

export default function Advisor() {
  const location = useLocation()
  const { user, advisorProfile, subscription, loading } = useAuth()
  const [tab, setTab] = useState(() => (location.search.includes('tab=sourcing') ? 7 : 0))
  const [toggle, setToggle] = useState(false)
  const { lang } = useLang()
  const td = uiT[lang].dashboards.advisor

  const menuStructure = [
    {
      category: td.categories.dashboard,
      icon: <LayoutDashboard className="w-4 h-4" />,
      items: [
        { name: td.items.view360, icon: <Activity className="w-4 h-4" />, index: 0 },
        { name: td.items.marketIntelligence, icon: <TrendingUp className="w-4 h-4" />, index: 3 },
      ],
    },
    {
      category: td.categories.portfolios,
      icon: <Briefcase className="w-4 h-4" />,
      items: [
        { name: td.items.clients, icon: <Users className="w-4 h-4" />, index: 1 },
        { name: td.items.dealPipeline, icon: <Briefcase className="w-4 h-4" />, index: 2 },
        { name: td.items.catalogue, icon: <FileText className="w-4 h-4" />, index: 7 },
        { name: 'My Shortlist', icon: <Heart className="w-4 h-4" />, index: 8 },
      ],
    },
    {
      category: td.categories.tools,
      icon: <FileText className="w-4 h-4" />,
      items: [{ name: td.items.reports, icon: <FileText className="w-4 h-4" />, index: 4 }],
    },
    {
      category: td.categories.account,
      icon: <Settings className="w-4 h-4" />,
      items: [
        { name: td.items.profile, icon: <Briefcase className="w-4 h-4" />, index: 5 },
        { name: td.items.subscription, icon: <CreditCard className="w-4 h-4" />, index: 6 },
      ],
    },
  ]

  const getCurrentPageInfo = () => {
    for (const menu of menuStructure) {
      const item = menu.items.find((i) => i.index === tab)
      if (item) return { category: menu.category, page: item.name }
    }
    return { category: td.breadcrumb.defaultCategory, page: td.breadcrumb.defaultPage }
  }

  const renderTab = () => {
    switch (tab) {
      case 0:
        return <AdvisorOverview setTab={setTab} />
      case 1:
        return <AdvisorClients />
      case 2:
        return <AdvisorDealPipeline />
      case 3:
        return <AdvisorMarketIntelligence />
      case 7:
        return <CuratorCatalogue />
      case 8:
        return <MyShortlist />
      case 4:
        return <AdvisorReports />
      case 5:
        return <Profile />
      case 6:
        return <AdvisorAbonnement />
      default:
        return <AdvisorOverview setTab={setTab} />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kcb-noir">
        <div className="w-8 h-8 border-2 border-kcb-or border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const pageInfo = getCurrentPageInfo()

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-kcb-noir">
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-10 flex items-center justify-between px-4 h-14 bg-kcb-ardoise border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <button onClick={() => setToggle(true)} className="text-kcb-pierre hover:text-white p-1">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-white text-sm font-medium truncate">{pageInfo.page}</span>
        </div>
        <span className="text-[10px] bg-kcb-or/10 text-kcb-or border border-kcb-or/20 px-2 py-0.5 rounded-[4px] font-semibold tracking-wide">
          ADVISOR
        </span>
      </header>

      {/* Sidebar */}
      <DashboardSidebar
        menuStructure={menuStructure}
        profile={advisorProfile}
        tab={tab}
        setTab={setTab}
        toggle={toggle}
        setToggle={setToggle}
        subscription={subscription}
        pricingPath="/global#pricing"
      />

      {/* Main content */}
      <main className="flex-1 px-4 md:px-8 py-6 overflow-y-auto min-w-0">
        <EmailVerificationBanner />

        {/* Breadcrumb — desktop */}
        <div className="hidden lg:flex items-center gap-2 text-sm text-kcb-pierre mb-6">
          <span>{pageInfo.category}</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-white font-medium">{pageInfo.page}</span>
          <span className="ml-auto text-[10px] bg-kcb-or/10 text-kcb-or border border-kcb-or/20 px-2 py-0.5 rounded-[4px] font-semibold tracking-wide">
            ADVISOR
          </span>
        </div>

        {renderTab()}
      </main>
    </div>
  )
}
