import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { utils } from '../../api/useAPI'
import { useAdminStats } from '../../api/useAdminStatsQuery' /* ✨ React Query */
import { fmtMoney, XOF_PER_EUR } from '../../lib/currency'
import { SkeletonKPI, SkeletonChart } from '../ui'
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Zap,
  Check,
  Pause,
  RefreshCw,
  TrendingUp,
  Users,
  Package,
  BarChart2,
} from 'lucide-react'
import { useT } from '../../i18n'
import { adminT } from '../../i18n/admin'

// ─── Périodes ────────────────────────────────────────────────────────────────
const PERIODS = [
  { key: '2025', label: '2025', short: 'Exercice 2025' },
  { key: 'q1_2026', label: 'Q1 2026', short: 'Jan–Mar 2026' },
  { key: 'q2_2026', label: 'Q2 2026', short: 'Avr–Juin 2026' },
  { key: 'current_month', label: 'Mois courant', short: 'Mai 2026' },
  { key: 'all_time', label: 'Tout', short: 'Historique complet' },
]

// ─── Référence 2025 — SYSCOHADA officiel ────────────────────────────────────
const YEAR_2025 = {
  ca_annual: 102430,
  charges_annual: 86000,
  rn_annual: 16430,
  marge: 16.0,
  croissance: 287, // % vs 2024
  ca_fcfa: 67189676,
  charges_fcfa: 56412302,
  rn_fcfa: 10777374,
  nps: 72,
  uptime: 99.8,
}

// ─── Données réelles Q1 2026 — source : DashboardComptable_V5.xlsx ───────────
const Q1_2026 = {
  mrr: 6046,
  arr: 72552,
  mrrGrowth: 12,
  arr_growth: 40.5,
  revenue_projection_3m: 6770,
  payback_period: 7,
  cac: 190,
  ltv: 600,
  ltv_cac: 3.2,
  churn: 4.0,
  revenue_mix: { saas: 57, logistique: 23, numerisation: 10, marketplace: 10 },
  saas_subscribers: 232,
  arpa: 26,
  saas_segments: {
    collectionneur: { count: 49, mrr: 1279, share: 21 },
    curateur: { count: 128, mrr: 3197, share: 55 },
    galerie: { count: 55, mrr: 1570, share: 24 },
  },
  gmv: 12500,
  aov: 500,
  commission_revenue: 2500, // GMV × 20%
  logistics: {
    label: 'Q1 2026',
    envois: 31,
    envois_mensuels: 10.3,
    panier_moyen: 250,
    revenu_mensuel: 2167,
    marge: 63.0,
  },
  pl_monthly: [
    {
      mois: 'Janvier 2026',
      abonnes: 185,
      mrr: 4820,
      produits: {
        saas: 4820,
        marketplace: 1000,
        logistique: 2000,
        numerisation: 900,
        nouveaux_marches: 0,
        total: 8720,
      },
      charges: {
        salaires: 4500,
        tech: 750,
        marketing: 1500,
        logistique: 640,
        numerisation: 360,
        admin: 500,
        amort: 200,
        divers: 450,
        total: 8900,
      },
      net: -180,
      marge: -2.1,
    },
    {
      mois: 'Février 2026',
      abonnes: 207,
      mrr: 5398,
      produits: {
        saas: 5398,
        marketplace: 900,
        logistique: 2000,
        numerisation: 1000,
        nouveaux_marches: 300,
        total: 9598,
      },
      charges: {
        salaires: 4500,
        tech: 800,
        marketing: 1960,
        logistique: 800,
        numerisation: 450,
        admin: 550,
        amort: 200,
        divers: 500,
        total: 9760,
      },
      net: -162,
      marge: -1.7,
    },
    {
      mois: 'Mars 2026',
      abonnes: 232,
      mrr: 6046,
      produits: {
        saas: 6046,
        marketplace: 600,
        logistique: 2500,
        numerisation: 1100,
        nouveaux_marches: 800,
        total: 11046,
      },
      charges: {
        salaires: 4800,
        tech: 900,
        marketing: 2580,
        logistique: 1040,
        numerisation: 540,
        admin: 600,
        amort: 200,
        divers: 560,
        total: 11220,
      },
      net: -174,
      marge: -1.6,
    },
  ],
  pl_q1_total: {
    produits: {
      saas: 16264,
      marketplace: 2500,
      logistique: 6500,
      numerisation: 3000,
      nouveaux_marches: 1100,
      total: 29364,
    },
    charges: {
      salaires: 13800,
      tech: 2450,
      marketing: 6040,
      logistique: 2480,
      numerisation: 1350,
      admin: 1650,
      amort: 600,
      divers: 1510,
      total: 29880,
    },
    net: -516,
    marge: -1.8,
  },
}

// ─── Projections Q2 2026 ─────────────────────────────────────────────────────
const Q2_2026 = {
  mrr_projection: 8192, // MRR fin juin 2026
  arr_projection: 98304, // ARR fin Q2
  abonnes_fin_q2: 309,
  ca_q2_total: 33500,
  mrr_monthly: [
    { mois: 'Avril 2026', mrr: 6770, abonnes: 249 },
    { mois: 'Mai 2026', mrr: 7447, abonnes: 272 },
    { mois: 'Juin 2026', mrr: 8192, abonnes: 309 },
  ],
}

export function Analytics({ currency = 'EUR' }) {
  const navigate = useNavigate()
  const t = useT(adminT).analytics
  const [data, setData] = useState(null)
  const [liveData, setLiveData] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [period, setPeriod] = useState('q1_2026')
  const [lastUpdated, setLastUpdated] = useState(null)

  const fmt = (eurAmount, opts) => fmtMoney(eurAmount * XOF_PER_EUR, currency, opts)
  const fmtXOF = (xof) => fmtMoney(xof, 'XOF')

  const defaultData = {
    mrr: 4303,
    arr: 51636,
    mrrGrowth: 12.5,
    arr_growth: 18.2,
    revenue_mix: { marketplace: 20, saas: 40, numerisation: 10, logistique: 30 },
    cac: 190,
    ltv: 600,
    ltv_cac: 3.2,
    payback_period: 7,
    revenue_projection_3m: 4820,
    churn: 4.5,
    saas_subscribers: 159,
    arpa: 27,
    saas_segments: {
      collectionneur: { count: 34, mrr: 909, share: 22 },
      curateur: { count: 87, mrr: 2272, share: 55 },
      galerie: { count: 43, mrr: 1117, share: 27 },
    },
    totalUsers: 7154,
    mau: 5500,
    dau: 3668,
    acquisition_growth: 15,
    channels: {
      organic: { pct: 45, roi: 3.2 },
      paid: { pct: 35, roi: 1.8 },
      referral: { pct: 20, roi: 4.1 },
    },
    totalArtworks: 236,
    artworks_growth: 18,
    artworks_by_category: { peintures: 120, sculptures: 65, digital: 51 },
    artworks_with_cert: 215,
    quality_score: 87,
    gmv: 1707,
    aov: 279,
    conversion_rate: 3.8,
    views_total: 12450,
    favorites: 856,
    messages: 234,
    contacts: 89,
    sales: 6,
    commission_revenue: 341,
    logistics: {
      label: 'Q4 2025',
      envois: 110,
      envois_mensuels: 9,
      panier_moyen: 279,
      revenu_mensuel: 2561,
      marge: 71.4,
    },
    dau_mau_ratio: 66.7,
    retention_30d: 72,
    retention_7d: 89,
    feature_adoption: { enchères: 78, favoris: 92, messagerie: 65 },
    at_risk_users: 7,
    uptime: 99.8,
    api_response_time: 145,
    error_rate: 0.2,
    lcp: 1.8,
    fid: 35,
    cls: 0.08,
    certs_generated: 215,
    nps: 72,
    csat: 4.3,
    total_tickets: 45,
    avg_response_time: 2.5,
    avg_resolution_time: 24,
    ticket_categories: { facturation: 12, technique: 18, général: 15 },
    churn_risk_users: 7,
    upsell_opportunities: 7,
    pendingArtworks: null,
    openTickets: null,
    alerts: [
      { type: 'warning', message: '7 utilisateurs à risque de churn identifiés' },
      { type: 'info', message: '7 comptes éligibles à un upsell de plan' },
    ],
  }

  const loadLiveData = useCallback(async (p) => {
    try {
      const res = await fetch(`${utils.api}/analytics?period=${p}`, utils.options)
      const result = await res.json()
      if (result?.data) {
        setLiveData(result.data)
        setLastUpdated(new Date())
      }
    } catch (_) {
      /* fallback sur defaultData */
    }
  }, [])

  const isStaticPeriod = period === 'q1_2026' || period === 'q2_2026' || period === '2025'

  useEffect(() => {
    setData(defaultData)
    setLiveData(null)
    if (!isStaticPeriod) {
      loadLiveData(period)
      if (autoRefresh) {
        const t = setInterval(() => loadLiveData(period), 30000)
        return () => clearInterval(t)
      }
    }
  }, [autoRefresh, period, isStaticPeriod]) // eslint-disable-line react-hooks/exhaustive-deps

  const q1Static =
    period === 'q1_2026'
      ? {
          mrr: Q1_2026.mrr,
          arr: Q1_2026.arr,
          mrrGrowth: Q1_2026.mrrGrowth,
          arr_growth: Q1_2026.arr_growth,
          revenue_projection_3m: Q1_2026.revenue_projection_3m,
          payback_period: Q1_2026.payback_period,
          cac: Q1_2026.cac,
          ltv: Q1_2026.ltv,
          ltv_cac: Q1_2026.ltv_cac,
          churn: Q1_2026.churn,
          revenue_mix: Q1_2026.revenue_mix,
          saas_subscribers: Q1_2026.saas_subscribers,
          arpa: Q1_2026.arpa,
          saas_segments: Q1_2026.saas_segments,
          gmv: Q1_2026.gmv,
          aov: Q1_2026.aov,
          commission_revenue: Q1_2026.commission_revenue,
          logistics: Q1_2026.logistics,
          totalArtworks: 236,
          artworks_with_cert: 236,
          certs_generated: 236,
          totalUsers: 12860,
          mau: 5500,
          dau: 3668,
          dau_mau_ratio: 66.7,
          artworks_growth: 19,
        }
      : {}

  const q2Static =
    period === 'q2_2026'
      ? {
          mrr: Q2_2026.mrr_projection,
          arr: Q2_2026.arr_projection,
          mrrGrowth: 10,
          arr_growth: 35,
          revenue_projection_3m: Q2_2026.mrr_projection,
        }
      : {}

  const year2025Static =
    period === '2025'
      ? {
          mrr: Math.round(YEAR_2025.ca_annual / 12),
          arr: YEAR_2025.ca_annual,
          mrrGrowth: 0,
          arr_growth: YEAR_2025.croissance,
          nps: YEAR_2025.nps,
          uptime: YEAR_2025.uptime,
          totalArtworks: 400,
          artworks_with_cert: 400,
          certs_generated: 400,
        }
      : {}

  const merged = data
    ? {
        ...data,
        ...(liveData
          ? {
              sales: liveData.transactions?.completed ?? data.sales,
              pendingArtworks: liveData.pending_artworks ?? data.pendingArtworks,
              // KPIs financiers et volumétriques depuis le live uniquement pour périodes dynamiques
              ...(period !== 'q1_2026' && period !== 'q2_2026' && period !== '2025'
                ? {
                    totalUsers: liveData.users?.total ?? data.totalUsers,
                    totalArtworks: liveData.artworks?.total ?? data.totalArtworks,
                    gmv: liveData.transactions?.gmv_eur || data.gmv,
                    aov: liveData.transactions?.aov_eur || data.aov,
                  }
                : {}),
            }
          : {}),
        // Les données statiques curées passent EN DERNIER — elles gagnent toujours
        ...year2025Static,
        ...q2Static,
        ...q1Static,
      }
    : null

  if (!merged) return <DashboardSkeleton />

  const periodShort = PERIODS.find((p) => p.key === period)?.short ?? '—'

  return (
    <div className="space-y-6 pb-10">
      {/* ── En-tête ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white">{t.title}</h1>
          <p className="text-kcb-pierre mt-1 text-sm">
            {periodShort}
            {lastUpdated && (
              <span className="ml-2 text-kcb-pierre/50">
                · màj{' '}
                {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="overflow-x-auto">
            <div className="flex items-center gap-1 bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-1 min-w-max">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    period === p.key
                      ? 'bg-kcb-or text-kcb-noir'
                      : 'text-kcb-pierre hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`px-3 py-2 rounded text-xs font-medium transition flex items-center gap-1 border ${
              autoRefresh
                ? 'bg-green-600/20 text-green-300 border-green-600/30'
                : 'bg-kcb-ardoise text-kcb-sable border-white/[0.06]'
            }`}
          >
            {autoRefresh ? <Check className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {autoRefresh ? t.live : t.paused}
          </button>
          <button
            onClick={() => loadLiveData(period)}
            className="px-3 py-2 bg-kcb-or hover:bg-kcb-bronze rounded text-kcb-noir text-xs font-medium transition flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t.refresh}
          </button>
        </div>
      </div>

      {/* ── Hero KPIs ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroKPI
          icon={TrendingUp}
          label="MRR"
          value={fmt(merged.mrr)}
          change={`+${merged.mrrGrowth}% MoM`}
          trend="up"
        />
        <HeroKPI
          icon={Users}
          label={t.users}
          value={merged.totalUsers.toLocaleString('fr-FR')}
          change={`+${merged.acquisition_growth}% ${t.thisMonth}`}
          trend="up"
        />
        <HeroKPI
          icon={Package}
          label={t.artworks}
          value={merged.totalArtworks}
          change={`${merged.artworks_with_cert} ${t.certified}`}
          trend="up"
        />
        <HeroKPI
          icon={BarChart2}
          label="GMV"
          value={fmt(merged.gmv, { compact: true })}
          change={
            period === 'q1_2026'
              ? t.gmvQ1
              : period === 'q2_2026'
                ? t.gmvQ2
                : period === '2025'
                  ? t.gmv2025
                  : t.gmvDefault
          }
          trend="up"
        />
      </div>

      {/* ── Alertes ───────────────────────────────────────────────────────── */}
      {merged.alerts?.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {merged.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-[4px] border flex items-start gap-2 ${
                alert.type === 'warning'
                  ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
                  : 'bg-kcb-or/10 border-kcb-or/30 text-kcb-sable'
              }`}
            >
              {alert.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <p className="text-sm">{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── 2025 — Référence SYSCOHADA ────────────────────────────────────── */}
      {period === '2025' && (
        <Section title={t.section2025}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label={t.ca2025}
              value={fmt(YEAR_2025.ca_annual)}
              change={`${fmtXOF(YEAR_2025.ca_fcfa)}`}
              trend="up"
              color="green"
            />
            <MetricCard
              label={t.charges2025}
              value={fmt(YEAR_2025.charges_annual)}
              change={`${fmtXOF(YEAR_2025.charges_fcfa)}`}
              color="red"
            />
            <MetricCard
              label={t.rn2025}
              value={fmt(YEAR_2025.rn_annual)}
              change={`${fmtXOF(YEAR_2025.rn_fcfa)} · Marge ${YEAR_2025.marge}%`}
              trend="up"
              color="green"
            />
            <MetricCard
              label={t.growth}
              value={`+${YEAR_2025.croissance}%`}
              change={t.growthVs2024}
              trend="up"
              color="purple"
            />
          </div>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-kcb-ardoise/50 border border-white/[0.06] rounded-[4px] p-4">
              <p className="text-white font-semibold mb-3">{t.incomeStatement}</p>
              <div className="space-y-2 text-sm">
                {[
                  [t.revenue, fmt(YEAR_2025.ca_annual), 'text-green-300'],
                  [t.totalCharges, fmt(YEAR_2025.charges_annual), 'text-red-300'],
                  [
                    t.netResult,
                    fmt(YEAR_2025.rn_annual),
                    'text-kcb-or font-bold border-t border-white/[0.08] pt-2 mt-2',
                  ],
                ].map(([label, value, cls]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-kcb-sable">{label}</span>
                    <span className={cls}>{value}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-white/[0.08] pt-2 mt-1">
                  <span className="text-kcb-sable">{t.netMargin}</span>
                  <span className="text-kcb-or font-semibold">{YEAR_2025.marge}%</span>
                </div>
              </div>
            </div>
            <MetricCard
              label={t.nps2025}
              value={YEAR_2025.nps}
              change={t.npsScore}
              trend="up"
              color="green"
            />
            <MetricCard
              label={t.uptime2025}
              value={`${YEAR_2025.uptime}%`}
              change={t.serviceAvailability}
              trend="up"
              color="green"
            />
          </div>
        </Section>
      )}

      {/* ── Revenue & Finance ─────────────────────────────────────────────── */}
      <Section title={t.sectionRevenue}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="MRR"
            value={fmt(merged.mrr)}
            change={`+${merged.mrrGrowth}% MoM`}
            trend="up"
            color="green"
          />
          <MetricCard
            label="ARR"
            value={fmt(merged.arr)}
            change={`+${merged.arr_growth}% YoY`}
            trend="up"
            color="green"
          />
          <MetricCard
            label={t.cac}
            value={fmt(merged.cac)}
            change={t.cacLabel}
            trend="down"
            color="blue"
          />
          <MetricCard
            label={t.ltv}
            value={fmt(merged.ltv)}
            change={`LTV:CAC = ${merged.ltv_cac}x`}
            trend="up"
            color="purple"
          />
        </div>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RevenueBreakdown
            title={t.revenueMix}
            data={merged.revenue_mix}
            colors={['#2D6A4F', '#C9A84C', '#8B6914', '#5a3e2b']}
          />
          <MetricCard
            label={t.paybackPeriod}
            value={`${merged.payback_period} mois`}
            change={t.paybackLabel}
            color="indigo"
          />
        </div>
      </Section>

      {/* ── SaaS — Abonnements ────────────────────────────────────────────── */}
      <Section title="SaaS — Abonnements">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Abonnés payants"
            value={merged.saas_subscribers}
            change={`ARPA ${merged.arpa} €/mois · Churn ${merged.churn}%`}
            trend="up"
            color="green"
          />
          {merged.saas_segments &&
            Object.entries(merged.saas_segments).map(([seg, info]) => (
              <div
                key={seg}
                className="bg-kcb-ardoise/50 border border-white/[0.06] rounded-[4px] p-4"
              >
                <p className="text-kcb-pierre text-sm mb-1 capitalize">
                  {seg} <span className="text-kcb-or">({info.share}%)</span>
                </p>
                <p className="text-2xl font-bold text-white">
                  {info.count}{' '}
                  <span className="text-base font-normal text-kcb-pierre">abonnés</span>
                </p>
                <p className="text-green-300 font-semibold mt-1">{fmt(info.mrr)} MRR</p>
              </div>
            ))}
        </div>
      </Section>

      {/* ── Abonnés Q1 2026 par mois ─────────────────────────────────────── */}
      {period === 'q1_2026' && (
        <Section title="Q1 2026 — Abonnés & MRR par mois">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Q1_2026.pl_monthly.map((m) => (
              <div
                key={m.mois}
                className="bg-kcb-ardoise/50 border border-white/[0.06] rounded-[4px] p-4 text-center"
              >
                <p className="text-kcb-pierre text-xs mb-2">{m.mois}</p>
                <p className="text-3xl font-bold text-white">{m.abonnes}</p>
                <p className="text-xs text-kcb-pierre mt-1">abonnés</p>
                <p className="text-green-300 font-semibold mt-2 text-sm">MRR {fmt(m.mrr)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Q2 2026 — Projections ─────────────────────────────────────────── */}
      {period === 'q2_2026' && (
        <Section title="Q2 2026 — Projections MRR">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Q2_2026.mrr_monthly.map((m) => (
              <div
                key={m.mois}
                className="bg-kcb-ardoise/50 border border-white/[0.06] rounded-[4px] p-4 text-center"
              >
                <p className="text-kcb-pierre text-xs mb-2">{m.mois}</p>
                <p className="text-3xl font-bold text-white">{fmt(m.mrr)}</p>
                <p className="text-xs text-kcb-pierre mt-1">MRR projeté</p>
                <p className="text-kcb-or font-semibold mt-2 text-sm">{m.abonnes} abonnés</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              label="ARR fin Q2"
              value={fmt(Q2_2026.arr_projection)}
              change="Annualized Revenue Rate"
              trend="up"
              color="green"
            />
            <MetricCard
              label="Abonnés fin Q2"
              value={Q2_2026.abonnes_fin_q2}
              change={`+${Q2_2026.abonnes_fin_q2 - Q1_2026.saas_subscribers} vs fin Q1`}
              trend="up"
              color="blue"
            />
            <MetricCard
              label="CA Q2 total"
              value={fmt(Q2_2026.ca_q2_total)}
              change="Chiffre d'affaires Q2"
              trend="up"
              color="purple"
            />
          </div>
        </Section>
      )}

      {/* ── Utilisateurs & Croissance ─────────────────────────────────────── */}
      <Section title="Utilisateurs & Croissance">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total utilisateurs"
            value={merged.totalUsers.toLocaleString('fr-FR')}
            change={`+${merged.acquisition_growth}% ce mois`}
            trend="up"
            color="blue"
          />
          <MetricCard
            label="MAU"
            value={merged.mau.toLocaleString('fr-FR')}
            change="Actifs / mois"
            color="indigo"
          />
          <MetricCard
            label="DAU"
            value={merged.dau.toLocaleString('fr-FR')}
            change="Actifs / jour"
            color="violet"
          />
          <div className="bg-kcb-ardoise/50 border border-white/[0.06] rounded-[4px] p-4">
            <p className="text-kcb-pierre text-sm mb-3">Canaux d'acquisition</p>
            <div className="space-y-3">
              {Object.entries(merged.channels).map(([channel, metrics]) => (
                <div key={channel}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-kcb-sable capitalize">{channel}</span>
                    <span className="text-white font-semibold">
                      {metrics.pct}% · ROI {metrics.roi}x
                    </span>
                  </div>
                  <div className="h-1.5 bg-kcb-ardoise rounded-full overflow-hidden">
                    <div className="h-full bg-kcb-or/60" style={{ width: `${metrics.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Contenu & Inventaire ──────────────────────────────────────────── */}
      <Section title="Contenu & Inventaire">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Œuvres publiées"
            value={merged.totalArtworks}
            change={`+${merged.artworks_growth}% ce mois`}
            trend="up"
            color="purple"
          />
          <div className="bg-kcb-ardoise/50 border border-white/[0.06] rounded-[4px] p-4">
            <p className="text-kcb-pierre text-sm mb-2">Par catégorie</p>
            <div className="space-y-1">
              {Object.entries(merged.artworks_by_category).map(([cat, count]) => (
                <div key={cat} className="flex justify-between text-sm">
                  <span className="text-kcb-sable capitalize">{cat}</span>
                  <span className="text-white font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <MetricCard
            label="Taux de certification"
            value={`${Math.round((merged.artworks_with_cert / merged.totalArtworks) * 100)}%`}
            change={`${merged.artworks_with_cert} / ${merged.totalArtworks} certifiées`}
            trend="up"
            color="green"
          />
          <MetricCard
            label="Score qualité moyen"
            value={`${merged.quality_score}%`}
            change="Complétude des fiches"
            color="amber"
          />
        </div>
      </Section>

      {/* ── Marketplace & Ventes ──────────────────────────────────────────── */}
      <Section title="Marketplace & Ventes">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="GMV"
            value={fmt(merged.gmv, { compact: true })}
            change={
              period === 'q1_2026'
                ? 'Volume Q1 2026'
                : period === 'q2_2026'
                  ? 'Volume Q2 2026 (proj.)'
                  : period === '2025'
                    ? 'Volume annuel 2025'
                    : 'Volume marchand'
            }
            color="green"
          />
          <MetricCard
            label="AOV"
            value={fmt(merged.aov)}
            change="Valeur moy. / commande"
            color="blue"
          />
          <MetricCard
            label="Commission (20%)"
            value={fmt(merged.commission_revenue)}
            change="Revenu net commission"
            color="amber"
          />
          <MetricCard
            label="Taux de conversion"
            value={`${merged.conversion_rate}%`}
            change="Vues → Vente"
            color="purple"
          />
        </div>
        <div className="mt-4">
          <FunnelChart
            title="Funnel Marketplace"
            stages={[
              { label: 'Vues', value: merged.views_total, color: 'blue' },
              { label: 'Favoris', value: merged.favorites, color: 'purple' },
              { label: 'Messages', value: merged.messages, color: 'indigo' },
              { label: 'Contacts qualifiés', value: merged.contacts, color: 'amber' },
              { label: 'Ventes', value: merged.sales, color: 'green' },
            ]}
          />
        </div>
      </Section>

      {/* ── Logistique ────────────────────────────────────────────────────── */}
      {merged.logistics && (
        <Section title={`Logistique — ${merged.logistics.label}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Expéditions"
              value={merged.logistics.envois}
              change={`${merged.logistics.envois_mensuels} envois/mois`}
              color="blue"
            />
            <MetricCard
              label="Panier moyen"
              value={fmt(merged.logistics.panier_moyen)}
              change="Par envoi"
              color="indigo"
            />
            <MetricCard
              label="Revenu logistique"
              value={fmt(merged.logistics.revenu_mensuel)}
              trend="up"
              color="green"
            />
            <MetricCard
              label="Marge nette"
              value={`${merged.logistics.marge}%`}
              change="Marge sur expéditions"
              trend="up"
              color="emerald"
            />
          </div>
        </Section>
      )}

      {/* ── Engagement & Rétention ────────────────────────────────────────── */}
      <Section title="Engagement & Rétention">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Stickiness DAU/MAU"
            value={`${merged.dau_mau_ratio.toFixed(1)}%`}
            change="Ratio quotidien/mensuel"
            trend={merged.dau_mau_ratio > 50 ? 'up' : 'down'}
            color="indigo"
          />
          <MetricCard
            label="Rétention 7J"
            value={`${merged.retention_7d}%`}
            change="Retour à 7 jours"
            color="green"
          />
          <MetricCard
            label="Rétention 30J"
            value={`${merged.retention_30d}%`}
            change="Retour à 30 jours"
            color="blue"
          />
          <MetricCard
            label="Utilisateurs à risque"
            value={merged.at_risk_users}
            change="Churn probable"
            trend="down"
            color="red"
          />
        </div>
        <div className="mt-4 bg-kcb-ardoise/50 border border-white/[0.06] rounded-[4px] p-4">
          <p className="text-white font-semibold mb-3">Adoption des features</p>
          <div className="space-y-2">
            {Object.entries(merged.feature_adoption).map(([feature, adoption]) => (
              <ProgressBar
                key={feature}
                label={feature.charAt(0).toUpperCase() + feature.slice(1)}
                value={adoption}
              />
            ))}
          </div>
        </div>
      </Section>

      {/* ── Technique & Performance ───────────────────────────────────────── */}
      <Section title="Technique & Performance">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Uptime"
            value={`${merged.uptime}%`}
            change="Disponibilité du service"
            trend="up"
            color="green"
          />
          <MetricCard
            label="API Response"
            value={`${merged.api_response_time}ms`}
            change="Temps de réponse moyen"
            color="blue"
          />
          <MetricCard
            label="Error Rate"
            value={`${merged.error_rate}%`}
            change="Taux d'erreur"
            trend="down"
            color="red"
          />
          <MetricCard
            label="Certificats PDF"
            value={merged.certs_generated}
            change="Générés au total"
            color="purple"
          />
        </div>
        <div className="mt-4 bg-kcb-ardoise/50 border border-white/[0.06] rounded-[4px] p-4">
          <p className="text-white font-semibold mb-3">Core Web Vitals</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <VitalCard label="LCP" value={`${merged.lcp}s`} target="< 2.5s" status="good" />
            <VitalCard label="FID" value={`${merged.fid}ms`} target="< 100ms" status="good" />
            <VitalCard label="CLS" value={merged.cls} target="< 0.1" status="needs-improvement" />
          </div>
        </div>
      </Section>

      {/* ── Support & Satisfaction ────────────────────────────────────────── */}
      <Section title="Support & Satisfaction">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="NPS"
            value={merged.nps}
            change="Score promoteur net"
            trend="up"
            color="green"
          />
          <MetricCard
            label="CSAT"
            value={`${merged.csat.toFixed(1)}/5`}
            change="Satisfaction client"
            color="blue"
          />
          <MetricCard
            label="Tickets ouverts"
            value={merged.total_tickets}
            change="Demandes de support"
            color="purple"
          />
          <MetricCard
            label="Temps résolution"
            value={`${merged.avg_resolution_time}h`}
            change="Délai moyen"
            color="indigo"
          />
        </div>
        <div className="mt-4 bg-kcb-ardoise/50 border border-white/[0.06] rounded-[4px] p-4">
          <p className="text-white font-semibold mb-3">Catégories de tickets</p>
          <div className="space-y-1">
            {Object.entries(merged.ticket_categories).map(([category, count]) => (
              <div key={category} className="flex justify-between text-sm">
                <span className="text-kcb-sable capitalize">{category}</span>
                <span className="text-white font-semibold">{count} tickets</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Prédictions ───────────────────────────────────────────────────── */}
      <Section title="Prédictions">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            label="MRR M+1"
            value={fmt(merged.revenue_projection_3m)}
            change="MRR × 1,12 (+12% MoM)"
            color="green"
          />
          <MetricCard
            label="Churn probable"
            value={merged.churn_risk_users}
            change="Utilisateurs à risque de départ"
            trend="down"
            color="orange"
          />
          <MetricCard
            label="Upsell identifiés"
            value={merged.upsell_opportunities}
            change="Comptes éligibles plan supérieur"
            color="purple"
          />
        </div>
      </Section>

      {/* ── Actions Rapides ───────────────────────────────────────────────── */}
      <Section title="Actions Rapides">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionButton
            label="Réviser les œuvres"
            description="Œuvres en attente de validation"
            badge={merged.pendingArtworks}
            badgeColor="red"
            onClick={() => navigate('/admin/artworks')}
          />
          <ActionButton
            label="Gérer les utilisateurs"
            description="Comptes, rôles et abonnements"
            badge={merged.totalUsers?.toLocaleString('fr-FR')}
            badgeColor="blue"
            onClick={() => navigate('/admin/users')}
          />
          <ActionButton
            label="Tickets support"
            description="Demandes en attente de réponse"
            badge={merged.openTickets}
            badgeColor="amber"
            onClick={() => navigate('/admin/support')}
          />
        </div>
      </Section>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="animate-pulse bg-white/[0.08] rounded-[4px] w-48 h-9" />
          <div className="animate-pulse bg-white/[0.08] rounded-[4px] w-32 h-4" />
        </div>
        <div className="flex gap-2">
          <div className="animate-pulse bg-white/[0.08] rounded-[4px] w-72 h-9" />
          <div className="animate-pulse bg-white/[0.08] rounded-[4px] w-20 h-9" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonKPI key={i} />
        ))}
      </div>
      <SkeletonChart height="h-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonKPI key={i} />
        ))}
      </div>
    </div>
  )
}

// ─── Composants UI ───────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white font-playfair border-b border-white/[0.06] pb-2">
        {title}
      </h2>
      {children}
    </div>
  )
}

function HeroKPI({ icon: Icon, label, value, change, trend }) {
  return (
    <div className="bg-kcb-ardoise border border-white/[0.08] rounded-[4px] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-kcb-pierre text-sm font-medium">{label}</p>
        <Icon className="w-4 h-4 text-kcb-or" />
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p
        className={`text-xs flex items-center gap-1 ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}
      >
        {trend === 'up' ? (
          <ArrowUpRight className="w-3.5 h-3.5" />
        ) : (
          <ArrowDownRight className="w-3.5 h-3.5" />
        )}
        {change}
      </p>
    </div>
  )
}

function MetricCard({ label, value, change, trend, color = 'gray' }) {
  const cls = {
    green: 'bg-green-500/10 border-green-500/30',
    blue: 'bg-kcb-or/10 border-kcb-or/30',
    purple: 'bg-kcb-bronze/10 border-kcb-bronze/30',
    indigo: 'bg-kcb-or/10 border-kcb-or/30',
    violet: 'bg-kcb-bronze/10 border-kcb-bronze/30',
    amber: 'bg-kcb-or/10 border-kcb-or/30',
    emerald: 'bg-green-500/10 border-green-500/30',
    orange: 'bg-kcb-or/10 border-kcb-or/30',
    red: 'bg-red-500/10 border-red-500/30',
  }
  return (
    <div
      className={`border rounded-[4px] p-4 ${cls[color] ?? 'bg-white/[0.03] border-white/[0.06]'}`}
    >
      <p className="text-kcb-pierre text-sm mb-2">{label}</p>
      <div className="flex items-end justify-between">
        <div className="text-3xl font-bold text-white">{value}</div>
        {trend &&
          (trend === 'up' ? (
            <ArrowUpRight className="w-4 h-4 text-green-400" />
          ) : (
            <ArrowDownRight className="w-4 h-4 text-red-400" />
          ))}
      </div>
      {change && <p className="text-xs mt-2 text-kcb-pierre/80">{change}</p>}
    </div>
  )
}

function RevenueBreakdown({ title, data, colors }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0)
  return (
    <div className="bg-kcb-ardoise/50 border border-white/[0.06] rounded-[4px] p-4">
      <p className="text-white font-semibold mb-3">{title}</p>
      <div className="space-y-2">
        {Object.entries(data).map(([key, value], idx) => (
          <div key={key}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-kcb-sable capitalize">{key}</span>
              <span className="text-white font-semibold">
                {((value / total) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-kcb-ardoise rounded-full overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${(value / total) * 100}%`,
                  backgroundColor: colors[idx % colors.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FunnelChart({ title, stages }) {
  const maxValue = Math.max(...stages.map((s) => s.value))
  const colorMap = {
    blue: '#C9A84C',
    purple: '#8B6914',
    indigo: '#C9A84C',
    amber: '#d97706',
    green: '#10b981',
  }
  return (
    <div className="bg-kcb-ardoise/50 border border-white/[0.06] rounded-[4px] p-4">
      <p className="text-white font-semibold mb-4">{title}</p>
      <div className="space-y-3">
        {stages.map((stage, idx) => (
          <div key={idx}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-kcb-sable">{stage.label}</span>
              <span className="text-white font-semibold">
                {stage.value.toLocaleString('fr-FR')}
              </span>
            </div>
            <div className="h-3 bg-kcb-ardoise rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(stage.value / maxValue) * 100}%`,
                  backgroundColor: colorMap[stage.color],
                }}
              />
            </div>
            {idx < stages.length - 1 && stages[idx + 1].value > 0 && (
              <p className="text-right text-xs text-kcb-pierre/40 mt-0.5">
                → {((stages[idx + 1].value / stage.value) * 100).toFixed(1)}%
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ProgressBar({ label, value }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-kcb-sable">{label}</span>
        <span className="text-white font-semibold">{value}%</span>
      </div>
      <div className="h-2 bg-kcb-ardoise rounded-full overflow-hidden">
        <div className="h-full bg-kcb-or" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function VitalCard({ label, value, target, status }) {
  return (
    <div className="bg-kcb-ardoise/50 rounded-[4px] p-3 text-center border border-white/[0.06]">
      <p className="text-kcb-pierre text-xs mb-1">{label}</p>
      <p
        className={`text-2xl font-bold ${status === 'good' ? 'text-green-400' : 'text-yellow-400'}`}
      >
        {value}
      </p>
      <p className="text-kcb-pierre text-xs mt-1">{target}</p>
    </div>
  )
}

function ActionButton({ label, description, badge, badgeColor = 'red', onClick }) {
  const badgeCls = {
    red: 'bg-red-500 text-white',
    blue: 'bg-kcb-or/20 text-kcb-or border border-kcb-or/30',
    amber: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  }
  return (
    <button
      onClick={onClick}
      className="bg-kcb-ardoise/50 border border-white/[0.06] hover:border-kcb-or/50 rounded-[4px] p-4 text-left transition group w-full"
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-white font-semibold group-hover:text-kcb-or transition">{label}</p>
        {badge != null && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeCls[badgeColor]}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-kcb-pierre text-xs">{description}</p>
    </button>
  )
}
