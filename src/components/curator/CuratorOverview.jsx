import { motion } from 'framer-motion'
import {
  Users,
  CheckCircle,
  Truck,
  DollarSign,
  Calendar,
  ArrowRight,
  Star,
  MapPin,
  FileText,
  AlertCircle,
  TrendingUp,
  Package,
  BookOpen,
  Plus,
} from 'lucide-react'
import { useAuth } from '../../store/AuthContext'
import { useArtist } from '../../api/useArtistContextQuery'
import { KPICard, SkeletonKPI } from '../ui'
import { useT } from '../../i18n'
import { curatorT } from '../../i18n/curator'

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}

// Demo data — admin only
const DEMO = {
  user: { name: 'Sophie Laurent', role: 'Senior Curator', institution: 'Tate Modern, London' },
  exhibition: {
    title: 'New Voices: Contemporary African Art',
    openingDate: '15 Sept 2025',
    closingDate: '10 Jan 2026',
    budget: 250000,
    budgetUsed: 47800,
    daysLeft: 127,
    shortlisted: 18,
    confirmed: 6,
    artworksSelected: 11,
  },
  pipeline: [
    { label: 'À découvrir', count: 12, color: 'text-[#9B4D96]', bg: 'bg-[#9B4D96]/10', border: 'border-[#9B4D96]/30' },
    { label: 'Shortlistés', count: 18, color: 'text-kcb-or', bg: 'bg-kcb-or/10', border: 'border-kcb-or/30' },
    { label: 'Confirmés', count: 6, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
    { label: 'En transit', count: 3, color: 'text-kcb-bronze', bg: 'bg-kcb-bronze/10', border: 'border-kcb-bronze/30' },
  ],
  concierge: [
    { type: 'Visite studio virtuelle', artist: 'Aïcha Diallo — Dakar', date: '20 mai 2025', status: 'confirmed', price: '€350' },
    { type: 'Due diligence', artist: 'Kofi Mensah — Accra', date: '2 jours restants', status: 'in_progress', price: '€500' },
    { type: 'Coordination logistique', artist: '12 œuvres — Dakar → London', date: 'Devis reçu', status: 'pending', price: '€6 800' },
  ],
  alerts: [
    { icon: AlertCircle, text: "Permis d'export Sénégal à renouveler avant le 1er juin", level: 'warning' },
    { icon: FileText, text: "3 certificats d'authenticité en attente de téléchargement", level: 'info' },
    { icon: CheckCircle, text: 'Visite studio Aïcha Diallo confirmée pour le 20 mai', level: 'success' },
  ],
  topArtists: [
    { name: 'Aïcha Diallo', country: 'Sénégal 🇸🇳', medium: 'Photographie', score: 98 },
    { name: 'Kofi Mensah', country: 'Ghana 🇬🇭', medium: 'Peinture', score: 94 },
    { name: 'Amara Touré', country: 'Mali 🇲🇱', medium: 'Sculpture', score: 91 },
    { name: 'Fatou Ndiaye', country: 'Sénégal 🇸🇳', medium: 'Installation', score: 87 },
    { name: 'Yaw Darko', country: 'Ghana 🇬🇭', medium: 'Vidéo', score: 85 },
  ],
}

const statusConfig = {
  confirmed: { label: 'Confirmé', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  in_progress: { label: 'En cours', color: 'text-kcb-or', bg: 'bg-kcb-or/10' },
  pending: { label: 'En attente', color: 'text-kcb-pierre', bg: 'bg-kcb-pierre/10' },
}

function EmptyBlock({ icon: Icon, title, desc, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 border border-dashed border-white/[0.06] rounded-[4px] text-center gap-3">
      <Icon className="w-8 h-8 text-kcb-pierre" />
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-kcb-pierre mt-0.5">{desc}</p>
      </div>
      {action && (
        <button onClick={onAction} className="flex items-center gap-1.5 text-xs text-kcb-or hover:text-kcb-bronze transition">
          <Plus className="w-3.5 h-3.5" /> {action}
        </button>
      )}
    </div>
  )
}

export function CuratorOverview({ setTab, demoMode = false }) {
  const { curatorProfile, user, loading } = useAuth()
  const { artists, loading: artistsLoading } = useArtist()

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const name = curatorProfile?.name?.split(' ')[0] || user?.name?.split(' ')[0] || ''

  if (loading || artistsLoading) {
    return (
      <div className="space-y-6 pb-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonKPI key={i} />)}
        </div>
      </div>
    )
  }

  // ── DEMO MODE (admin only) ────────────────────────────────────────────
  if (demoMode) {
    const ex = DEMO.exhibition
    const budgetPct = Math.round((ex.budgetUsed / ex.budget) * 100)
    return (
      <div className="space-y-6 pb-8">
        <div className="mb-2 flex items-center gap-2 text-xs text-amber-300 bg-amber-300/5 border border-amber-300/20 px-3 py-2 rounded-[4px]">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Mode démo — données fictives (Sophie Laurent, Tate Modern). Non visible pour les curateurs.
        </div>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[4px] border border-white/[0.06] px-6 py-5"
          style={{ background: 'linear-gradient(135deg, #1a1f3a 0%, #12121a 60%, #1a1209 100%)' }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-5 blur-3xl" style={{ background: '#9B4D96' }} />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#9B4D96] uppercase tracking-widest mb-1">Kucibok Bridge — Curateur International</p>
              <h1 className="font-playfair text-2xl text-white">{greeting}, {DEMO.user.name.split(' ')[0]}.</h1>
              <p className="text-kcb-pierre text-sm mt-1">{DEMO.user.role} · {DEMO.user.institution}</p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-1">
              <span className="text-xs text-kcb-pierre">Exposition en préparation</span>
              <span className="font-playfair text-white font-semibold text-sm">{ex.title}</span>
              <span className="text-xs text-kcb-or">{ex.openingDate} → {ex.closingDate}</span>
            </div>
          </div>
        </motion.div>

        <div className="space-y-2">
          {DEMO.alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-[4px] text-sm border ${alert.level === 'warning' ? 'bg-amber-500/5 border-amber-500/20 text-amber-300' : alert.level === 'success' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300' : 'bg-[#9B4D96]/5 border-[#9B4D96]/20 text-[#c084d8]'}`}>
              <alert.icon className="w-4 h-4 flex-shrink-0" />{alert.text}
            </div>
          ))}
        </div>

        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div variants={fadeUp}><KPICard icon={Users} label="Artistes shortlistés" value={ex.shortlisted} subtitle={`${ex.confirmed} confirmés`} iconColor="text-[#9B4D96]" iconBgColor="bg-[#9B4D96]/10" /></motion.div>
          <motion.div variants={fadeUp}><KPICard icon={Package} label="Œuvres sélectionnées" value={ex.artworksSelected} subtitle="sur 20 cibles" iconColor="text-kcb-or" iconBgColor="bg-kcb-or/10" /></motion.div>
          <motion.div variants={fadeUp}><KPICard icon={DollarSign} label="Budget utilisé" value={`£${(ex.budgetUsed / 1000).toFixed(0)}k`} subtitle={`${budgetPct}% du total`} iconColor="text-emerald-400" iconBgColor="bg-emerald-400/10" /></motion.div>
          <motion.div variants={fadeUp}><KPICard icon={Calendar} label="Jours restants" value={ex.daysLeft} subtitle={`Ouverture : ${ex.openingDate}`} iconColor="text-kcb-bronze" iconBgColor="bg-kcb-bronze/10" /></motion.div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-kcb-or" />Budget exposition</h3>
              <button onClick={() => setTab(4)} className="text-xs text-kcb-or hover:text-kcb-bronze flex items-center gap-1 transition">Détails <ArrowRight className="w-3 h-3" /></button>
            </div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-2xl font-bold text-white font-jetbrains">£{ex.budgetUsed.toLocaleString()}</span>
              <span className="text-sm text-kcb-pierre">/ £{ex.budget.toLocaleString()}</span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full mb-3">
              <div className="h-2 rounded-full" style={{ width: `${budgetPct}%`, background: 'linear-gradient(90deg, #9B4D96, #C9A84C)' }} />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[{ label: 'Honoraires', amount: '£18 200', pct: 38 }, { label: 'Logistique', amount: '£14 600', pct: 31 }, { label: 'Concierge', amount: '£15 000', pct: 31 }].map((item, i) => (
                <div key={i} className="bg-kcb-noir/40 rounded-[4px] p-3">
                  <p className="text-xs text-kcb-pierre mb-1 leading-tight">{item.label}</p>
                  <p className="text-sm font-semibold text-white">{item.amount}</p>
                  <p className="text-xs text-kcb-pierre">{item.pct}%</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Package className="w-4 h-4 text-[#9B4D96]" />Pipeline artistes</h3>
              <button onClick={() => setTab(1)} className="text-xs text-kcb-or hover:text-kcb-bronze flex items-center gap-1 transition">Découvrir <ArrowRight className="w-3 h-3" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {DEMO.pipeline.map((s, i) => (
                <div key={i} className={`border rounded-[4px] p-3 ${s.border} ${s.bg}`}>
                  <span className={`text-xs ${s.color}`}>{s.label}</span>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Star className="w-4 h-4 text-kcb-or" />Services Concierge actifs</h3>
            <button onClick={() => setTab(3)} className="text-xs text-kcb-or flex items-center gap-1">Voir tout <ArrowRight className="w-3 h-3" /></button>
          </div>
          <div className="space-y-3">
            {DEMO.concierge.map((s, i) => {
              const sc = statusConfig[s.status]
              return (
                <div key={i} className="flex items-center justify-between bg-kcb-noir/40 rounded-[4px] px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#9B4D96]/15 flex items-center justify-center flex-shrink-0"><MapPin className="w-3.5 h-3.5 text-[#9B4D96]" /></div>
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">{s.type}</p>
                      <p className="text-xs text-kcb-pierre truncate">{s.artist} · {s.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>{sc.label}</span>
                    <span className="text-sm font-semibold text-kcb-or font-jetbrains">{s.price}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" />Artistes shortlistés</h3>
            <button onClick={() => setTab(1)} className="text-xs text-kcb-or flex items-center gap-1">Découverte <ArrowRight className="w-3 h-3" /></button>
          </div>
          <div className="space-y-2">
            {DEMO.topArtists.map((artist, i) => (
              <div key={i} className="flex items-center justify-between bg-kcb-noir/30 rounded-[4px] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-5 text-xs text-kcb-pierre text-right">{i + 1}</span>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#9B4D96]/40 to-kcb-or/20 flex items-center justify-center text-xs font-bold text-white">{artist.name.charAt(0)}</div>
                  <div>
                    <p className="text-sm text-white font-medium">{artist.name}</p>
                    <p className="text-xs text-kcb-pierre">{artist.country} · {artist.medium}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-1.5 bg-white/[0.06] rounded-full"><div className="h-1.5 rounded-full bg-kcb-or" style={{ width: `${artist.score}%` }} /></div>
                  <span className="text-sm font-bold text-kcb-or w-12 text-right">{artist.score}/100</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── REAL USER MODE ────────────────────────────────────────────────────
  const platformArtistsCount = artists?.length ?? 0

  return (
    <div className="space-y-6 pb-8">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[4px] border border-white/[0.06] px-6 py-5"
        style={{ background: 'linear-gradient(135deg, #1a1f3a 0%, #12121a 60%, #1a1209 100%)' }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-5 blur-3xl" style={{ background: '#9B4D96' }} />
        <div className="relative">
          <p className="text-xs font-medium text-[#9B4D96] uppercase tracking-widest mb-1">Kucibok Bridge — Curateur International</p>
          <h1 className="font-playfair text-2xl text-white">
            {greeting}{name ? `, ${name}` : ''}.
          </h1>
          <p className="text-kcb-pierre text-sm mt-1">
            {curatorProfile?.institution || 'Curateur certifié Kucibok'}
          </p>
        </div>
      </motion.div>

      {/* Stats plateforme */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={fadeUp}><KPICard icon={Users} label="Artistes plateforme" value={platformArtistsCount} subtitle="Disponibles à découvrir" iconColor="text-[#9B4D96]" iconBgColor="bg-[#9B4D96]/10" /></motion.div>
        <motion.div variants={fadeUp}><KPICard icon={CheckCircle} label="Artistes vérifiés" value={artists?.filter((a) => a.kucibok_id).length ?? 0} subtitle="Certifiés KCB" iconColor="text-emerald-400" iconBgColor="bg-emerald-400/10" /></motion.div>
        <motion.div variants={fadeUp}><KPICard icon={Truck} label="Missions concierge" value={0} subtitle="Aucune en cours" iconColor="text-kcb-or" iconBgColor="bg-kcb-or/10" /></motion.div>
        <motion.div variants={fadeUp}><KPICard icon={DollarSign} label="Budget configuré" value="—" subtitle="À configurer" iconColor="text-kcb-bronze" iconBgColor="bg-kcb-bronze/10" /></motion.div>
      </motion.div>

      {/* Getting started */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-6"
      >
        <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
          <Star className="w-4 h-4 text-kcb-or" />
          Par où commencer ?
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { step: '01', label: 'Découvrir les artistes', desc: `${platformArtistsCount} artistes disponibles sur la plateforme`, icon: Users, tab: 1, color: '#9B4D96' },
            { step: '02', label: 'Réserver un concierge', desc: 'Visite studio, due diligence ou logistique', icon: Star, tab: 3, color: '#C9A84C' },
            { step: '03', label: 'Planifier la logistique', desc: 'Permis, transport, douane, assurance', icon: Truck, tab: 2, color: '#8B6914' },
            { step: '04', label: 'Se former', desc: 'Scènes par pays, rapports marché, webinaires', icon: BookOpen, tab: 5, color: '#10B981' },
          ].map((s, i) => (
            <button
              key={i}
              onClick={() => setTab(s.tab)}
              className="flex flex-col items-start gap-3 p-4 bg-kcb-noir/40 border border-white/[0.04] rounded-[4px] hover:border-white/10 hover:bg-kcb-noir/60 transition text-left group"
            >
              <div className="flex items-center gap-2 w-full">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}20` }}>
                  <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                </div>
                <span className="text-xs font-bold" style={{ color: s.color }}>{s.step}</span>
                <ArrowRight className="w-3.5 h-3.5 text-kcb-pierre ml-auto opacity-0 group-hover:opacity-100 transition" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{s.label}</p>
                <p className="text-xs text-kcb-pierre mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Artists preview */}
      {platformArtistsCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#9B4D96]" />
              Artistes récents sur la plateforme
            </h3>
            <button onClick={() => setTab(1)} className="text-xs text-kcb-or hover:text-kcb-bronze flex items-center gap-1 transition">
              Tous les artistes <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {(artists ?? []).slice(0, 5).map((artist, i) => (
              <div key={artist._id ?? i} className="flex items-center justify-between bg-kcb-noir/30 rounded-[4px] px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  {artist.image
                    ? <img src={artist.image} alt={artist.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#9B4D96]/40 to-kcb-or/20 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">{(artist.name ?? '?').charAt(0)}</div>
                  }
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm text-white font-medium truncate">{artist.name ?? '—'}</p>
                      {artist.kucibok_id && <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-kcb-pierre">{artist.country ?? '—'}</p>
                  </div>
                </div>
                {artist.kucibok_id && (
                  <span className="font-jetbrains text-[10px] text-kcb-pierre hidden sm:block">{artist.kucibok_id}</span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Empty concierge + budget */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-kcb-or" />Services Concierge
          </h3>
          <EmptyBlock icon={Star} title="Aucune mission en cours" desc="Réservez une visite studio, une due diligence ou une coordination logistique." action="Réserver un service" onAction={() => setTab(3)} />
        </div>
        <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-kcb-or" />Budget exposition
          </h3>
          <EmptyBlock icon={FileText} title="Budget non configuré" desc="Configurez votre budget d'exposition pour suivre vos dépenses en temps réel." action="Configurer le budget" onAction={() => setTab(4)} />
        </div>
      </div>
    </div>
  )
}
