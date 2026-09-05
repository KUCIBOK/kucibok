/**
 * CollectorDashboard.jsx — Main shell for collector dashboard
 * Routes: Dashboard / Collection / Discovery / Followed Artists / Purchases / Delivery / Profile
 */

import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import { useLang } from '../../store/LangContext'
import { uiT } from '../../i18n/ui'
import DashboardSidebar from '../shared/DashboardSidebar'
import { EmailVerificationBanner } from '../shared/EmailVerificationBanner'
import { ProfileCompletionBanner } from '../shared/ProfileCompletionBanner'
import { Menu, ChevronRight, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'

/**
 * Collector Dashboard Shell
 * Provides sidebar navigation, banners, and main content area
 */
export default function CollectorDashboard() {
  const { user, buyerProfile, loading } = useAuth()
  const { lang } = useLang()
  const navigate = useNavigate()
  const location = useLocation()
  const [toggle, setToggle] = useState(false)
  const [cataloguePath, setCataloguePath] = useState('/africa/catalogue')
  const td = uiT[lang].dashboards.buyer

  useEffect(() => {
    const lastPortal = sessionStorage.getItem('kcb_portal')
    setCataloguePath(lastPortal === 'global' ? '/global/catalogue' : '/africa/catalogue')
  }, [])

  // Menu structure for collector dashboard
  const menuStructure = [
    {
      category: td.categories.myAccount,
      items: [
        {
          name: 'Dashboard',
          to: '/account',
        },
        {
          name: 'Ma Collection',
          to: '/account/collection',
        },
        {
          name: 'Découverte',
          to: '/account/discovery',
        },
        {
          name: 'Suivi & Alertes',
          to: '/account/followed-artists',
        },
        {
          name: 'Mes Achats',
          to: '/account/purchases',
        },
        {
          name: 'Logistique',
          to: '/account/delivery',
        },
        {
          name: 'Profil',
          to: '/account/profile',
        },
      ],
    },
  ]

  // Get current page title
  const getCurrentPageInfo = () => {
    const path = location.pathname
    if (path === '/account') return { category: td.categories.myAccount, page: 'Dashboard' }
    if (path === '/account/collection') return { category: td.categories.myAccount, page: 'Ma Collection' }
    if (path === '/account/discovery') return { category: td.categories.myAccount, page: 'Découverte' }
    if (path === '/account/followed-artists') return { category: td.categories.myAccount, page: 'Suivi & Alertes' }
    if (path === '/account/purchases') return { category: td.categories.myAccount, page: 'Mes Achats' }
    if (path === '/account/delivery') return { category: td.categories.myAccount, page: 'Logistique' }
    if (path === '/account/profile') return { category: td.categories.myAccount, page: 'Profil' }
    return { category: td.categories.myAccount, page: 'Dashboard' }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kcb-noir">
        <div className="w-8 h-8 border-2 border-kcb-or border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-kcb-noir">
      {/* Sticky top bar — mobile only */}
      <header className="lg:hidden sticky top-0 z-10 flex items-center justify-between px-4 h-14 bg-kcb-ardoise border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <button onClick={() => setToggle(true)} className="text-kcb-pierre hover:text-white p-1">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-white text-sm font-medium truncate">
            {getCurrentPageInfo().page}
          </span>
        </div>
        <Link to={cataloguePath}>
          <ShoppingBag className="w-5 h-5 text-kcb-or" />
        </Link>
      </header>

      {/* Sidebar */}
      <DashboardSidebar
        menuStructure={menuStructure}
        profile={buyerProfile}
        tab={-1}
        setTab={() => {}}
        toggle={toggle}
        setToggle={setToggle}
        cta={{
          to: cataloguePath,
          label: 'Catalogue',
          icon: <ShoppingBag className="w-4 h-4" />,
          className: 'bg-kcb-or text-kcb-noir hover:bg-kcb-bronze justify-center',
        }}
      />

      {/* Main content */}
      <main className="flex-1 px-4 md:px-8 py-6 overflow-y-auto min-w-0">
        <EmailVerificationBanner />
        <ProfileCompletionBanner setTab={() => navigate('/account/profile')} />
        {/* Breadcrumb — desktop only */}
        <div className="hidden lg:flex items-center gap-2 text-sm text-kcb-pierre mb-6">
          <span>{getCurrentPageInfo().category}</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-white font-medium">{getCurrentPageInfo().page}</span>
        </div>
        {/* Page content */}
        <Outlet />
      </main>
    </div>
  )
}
