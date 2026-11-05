import { DeliveryTab } from '../delivery/DeliveryTab'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Truck,
  Package,
  Shield,
  FileText,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Download,
  Calculator,
  MapPin,
  Lock,
} from 'lucide-react'
import { PlanGate } from '../shared/PlanGate'
import { PLAN_STARTER } from '../../utils/planUtils'
import { useT } from '../../i18n'
import { curatorT } from '../../i18n/curator'

// Factual permit data — country-specific legal content, not translated
const PERMITS = [
  {
    country: 'Sénégal 🇸🇳',
    authority: 'Ministère de la Culture — DCPA',
    delay: '15–30 jours ouvrés',
    docs: ['Lettre de prêt signée', 'Inventaire œuvres (KCB-XXXXX)', 'Accord de retour', 'Photos des œuvres'],
    note: "Permis requis pour les œuvres de plus de 30 ans ou considérées 'patrimoine national'.",
    urgency: 'warning',
  },
  {
    country: 'Ghana 🇬🇭',
    authority: 'Ghana Museums & Monuments Board',
    delay: '10–20 jours ouvrés',
    docs: ['Formulaire GMMB-EX1', 'Factures artiste', 'Certificat KCB'],
    note: 'Procédure standard. Délais respectés si dossier complet.',
    urgency: 'ok',
  },
  {
    country: 'Mali 🇲🇱',
    authority: 'Direction Nationale du Patrimoine Culturel',
    delay: '30–60 jours ouvrés',
    docs: ['Dossier complet en français', "Avis du Conseil d'Art", 'Preuve de provenance'],
    note: 'Processus complexe. Recommandation : prévoir 60 jours minimum.',
    urgency: 'danger',
  },
  {
    country: "Côte d'Ivoire 🇨🇮",
    authority: 'Ministère de la Culture et de la Francophonie',
    delay: '10–20 jours ouvrés',
    docs: ['Lettre de prêt', 'Inventaire certifié', 'Contrat de transport'],
    note: 'Procédure standard. Coordonner avec la galerie partenaire sur place.',
    urgency: 'ok',
  },
  {
    country: 'Nigeria 🇳🇬',
    authority: 'National Commission for Museums and Monuments',
    delay: '20–45 jours ouvrés',
    docs: ['Formulaire NCMM', 'Certificat expert', 'Preuve achat légal', 'Assurance'],
    note: 'Vérifier que les œuvres ne sont pas classées patrimoine national.',
    urgency: 'warning',
  },
]

// Factual customs data — rates and VAT descriptions per destination country
const DESTINATIONS = {
  'France / UE': { duty: 0, vat: 'TVA 5,5% (taux réduit art)', handling: 250 },
  'Royaume-Uni': { duty: 5, vat: 'Exonéré (œuvre originale)', handling: 320 },
  'Suisse': { duty: 0, vat: 'TVA 2,6% (taux spécial art)', handling: 280 },
  'USA': { duty: 0, vat: 'Exempt (Section 9801)', handling: 350 },
  'Canada': { duty: 0, vat: 'GST 5% (remboursable)', handling: 300 },
  'Japon': { duty: 0, vat: 'TVA 10%', handling: 400 },
  'Émirats arabes unis': { duty: 0, vat: 'Exonéré (zone franche)', handling: 380 },
}

const ORIGINS = ['Sénégal', 'Ghana', "Côte d'Ivoire", 'Nigeria', 'Mali', 'Cameroun', 'Kenya', 'Afrique du Sud']

function PermitsTab() {
  const t = useT(curatorT).logisticsHub
  const [expanded, setExpanded] = useState(null)

  const urgencyLabel = (urgency) => {
    if (urgency === 'ok') return t.urgencyStandard
    if (urgency === 'warning') return t.urgencyWarning
    return t.urgencyDanger
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-[4px] text-sm text-amber-300">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {t.permitsWarning}
      </div>
      {PERMITS.map((p, i) => (
        <div key={i} className={`bg-kcb-ardoise border rounded-[4px] overflow-hidden ${p.urgency === 'danger' ? 'border-red-500/30' : p.urgency === 'warning' ? 'border-amber-500/30' : 'border-white/[0.06]'}`}>
          <button onClick={() => setExpanded(expanded === i ? null : i)} className="w-full flex items-center justify-between p-4 text-left">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.urgency === 'danger' ? 'bg-red-400' : p.urgency === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <div>
                <p className="text-sm font-semibold text-white">{p.country}</p>
                <p className="text-xs text-kcb-pierre">{p.authority}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full ${p.urgency === 'danger' ? 'bg-red-400/10 text-red-300' : p.urgency === 'warning' ? 'bg-amber-400/10 text-amber-300' : 'bg-emerald-400/10 text-emerald-400'}`}>
                {urgencyLabel(p.urgency)}
              </span>
              {expanded === i ? <ChevronDown className="w-4 h-4 text-kcb-pierre" /> : <ChevronRight className="w-4 h-4 text-kcb-pierre" />}
            </div>
          </button>
          <AnimatePresence>
            {expanded === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06]">
                  <div className="pt-3">
                    <p className="text-xs text-kcb-pierre mb-1">{t.permitDelay}</p>
                    <p className="text-sm text-white">{p.delay}</p>
                  </div>
                  <div>
                    <p className="text-xs text-kcb-pierre mb-2">{t.permitDocs}</p>
                    <ul className="space-y-1">
                      {p.docs.map((d, j) => (
                        <li key={j} className="flex items-center gap-2 text-xs text-kcb-sable">
                          <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />{d}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-xs text-kcb-pierre bg-kcb-noir/40 rounded-[4px] p-2.5">{p.note}</p>
                  <button className="flex items-center gap-2 text-xs text-kcb-or hover:text-kcb-bronze transition">
                    <Download className="w-3.5 h-3.5" /> {t.downloadGuide}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}

function InsuranceTab() {
  const t = useT(curatorT).logisticsHub
  const [value, setValue] = useState('')
  const rate = 0.4
  const premium = value ? ((Number(value) * rate) / 100).toFixed(0) : null

  return (
    <div className="space-y-4">
      <div className="bg-kcb-ardoise border border-kcb-or/20 rounded-[4px] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-[#9B4D96] uppercase tracking-wider mb-1">{t.insurancePartner}</p>
            <h3 className="text-lg font-semibold text-white">AXA Art</h3>
          </div>
          <Shield className="w-8 h-8 text-kcb-or" />
        </div>
        <div className="space-y-1.5 mb-4">
          {t.insuranceCoverages.map((c, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-kcb-sable list-none">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />{c}
            </li>
          ))}
        </div>
        <button className="w-full py-2.5 bg-kcb-or text-kcb-noir text-sm font-semibold rounded-[4px] hover:bg-kcb-bronze transition">
          {t.requestQuote}
        </button>
      </div>

      <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-5">
        <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-kcb-or" />
          {t.simulatorTitle}
        </h4>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-kcb-pierre block mb-1">{t.declaredValueLabel}</label>
            <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex : 85000" className="w-full bg-kcb-noir border border-white/[0.08] text-white text-sm px-3 py-2 rounded-[4px] focus:outline-none focus:border-kcb-or placeholder-kcb-pierre" />
          </div>
          <div>
            <label className="text-xs text-kcb-pierre block mb-1">{t.coverageTypeLabel}</label>
            <select className="w-full bg-kcb-noir border border-white/[0.08] text-white text-sm px-3 py-2 rounded-[4px] focus:outline-none appearance-none">
              {t.coverageOptions.map((opt, i) => <option key={i}>{opt}</option>)}
            </select>
          </div>
          {premium && (
            <div className="mt-3 p-3 bg-kcb-or/5 border border-kcb-or/20 rounded-[4px] flex items-center justify-between">
              <span className="text-sm text-kcb-sable">{t.estimatedPremium}</span>
              <span className="text-lg font-bold text-kcb-or">€{premium}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CustomsTab() {
  const t = useT(curatorT).logisticsHub
  const [declaredValue, setDeclaredValue] = useState('')
  const [fromCountry, setFromCountry] = useState('Sénégal')
  const [toCountry, setToCountry] = useState('France / UE')

  const dest = DESTINATIONS[toCountry]
  const baseValue = parseFloat(declaredValue) || 0
  const duty = (baseValue * dest.duty) / 100
  const handling = baseValue > 0 ? dest.handling : 0
  const total = duty + handling

  return (
    <div className="space-y-4">
      <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-5">
        <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-kcb-or" />
          {t.customsTitle}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs text-kcb-pierre block mb-1">{t.customsTotalValue}</label>
            <input type="number" value={declaredValue} onChange={(e) => setDeclaredValue(e.target.value)} placeholder="Ex : 85000" className="w-full bg-kcb-noir border border-white/[0.08] text-white text-sm px-3 py-2 rounded-[4px] focus:outline-none focus:border-kcb-or placeholder-kcb-pierre" />
          </div>
          <div>
            <label className="text-xs text-kcb-pierre block mb-1">{t.customsOriginLabel}</label>
            <select value={fromCountry} onChange={(e) => setFromCountry(e.target.value)} className="w-full bg-kcb-noir border border-white/[0.08] text-white text-sm px-3 py-2 rounded-[4px] focus:outline-none appearance-none">
              {ORIGINS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-kcb-pierre block mb-1">{t.customsDestLabel}</label>
            <select value={toCountry} onChange={(e) => setToCountry(e.target.value)} className="w-full bg-kcb-noir border border-white/[0.08] text-white text-sm px-3 py-2 rounded-[4px] focus:outline-none appearance-none">
              {Object.keys(DESTINATIONS).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {baseValue > 0 && (
          <div className="space-y-2">
            {[
              { label: t.customsDeclaredValue, value: `€${baseValue.toLocaleString()}` },
              { label: t.customsDuties(dest.duty), value: dest.duty === 0 ? t.customsExempt : `€${duty.toLocaleString()}` },
              { label: t.customsLocalTax, value: dest.vat },
              { label: t.customsHandling, value: `€${handling}` },
            ].map((row, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                <span className="text-sm text-kcb-pierre">{row.label}</span>
                <span className="text-sm text-white font-medium">{row.value}</span>
              </div>
            ))}
            <div className="flex justify-between items-center py-3 bg-kcb-or/5 rounded-[4px] px-3 mt-2">
              <span className="text-sm font-semibold text-white">{t.customsTotal}</span>
              <span className="text-lg font-bold text-kcb-or">€{total.toLocaleString()}</span>
            </div>
          </div>
        )}
        <p className="text-xs text-kcb-pierre mt-3">{t.customsDisclaimer}</p>
      </div>

      <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-4">
        <h4 className="text-sm font-semibold text-white mb-3">{t.hsCodesTitle}</h4>
        <div className="space-y-2">
          {[
            { code: '9701', desc: 'Peintures, dessins, pastels (originaux)', rate: '0% UE/CH/USA · 5% UK' },
            { code: '9702', desc: 'Gravures, estampes, lithographies (originaux)', rate: '0% partout' },
            { code: '9703', desc: 'Sculptures et statues (originaux)', rate: '0% partout' },
            { code: '9705', desc: 'Collections et pièces pour collections', rate: '0% partout' },
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between bg-kcb-noir/30 rounded-[4px] px-3 py-2">
              <div>
                <span className="font-jetbrains text-xs text-kcb-or">{row.code}</span>
                <span className="text-xs text-kcb-sable ml-3">{row.desc}</span>
              </div>
              <span className="text-xs font-medium text-emerald-400">{row.rate}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function LogisticsHub() {
  const t = useT(curatorT).logisticsHub
  const [activeTab, setActiveTab] = useState('shipping')

  const TABS = [
    { id: 'shipping', label: t.tabShipping, icon: Truck, locked: false },
    { id: 'permits', label: t.tabPermits, icon: FileText, locked: true },
    { id: 'insurance', label: t.tabInsurance, icon: Shield, locked: true },
    { id: 'customs', label: t.tabCustoms, icon: Calculator, locked: false },
  ]

  const stats = [
    { label: t.statCoveredCountries, value: '12', icon: MapPin, color: 'text-[#9B4D96]', bg: 'bg-[#9B4D96]/10' },
    { label: t.statPermitCountries, value: '5', icon: FileText, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: t.statProvider, value: 'Logidoo', icon: Package, color: 'text-kcb-or', bg: 'bg-kcb-or/10' },
    { label: t.statInsurer, value: 'AXA Art', icon: Shield, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  ]

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h2 className="font-playfair text-xl text-white">{t.pageTitle}</h2>
        <p className="text-sm text-kcb-pierre mt-0.5">{t.pageSubtitle}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${s.bg}`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{s.value}</p>
              <p className="text-xs text-kcb-pierre leading-tight">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-[4px] text-xs font-medium whitespace-nowrap transition flex-shrink-0 ${activeTab === tab.id ? 'bg-[#9B4D96]/20 text-[#c084d8] border border-[#9B4D96]/30' : 'text-kcb-pierre hover:text-white hover:bg-white/[0.04]'}`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.locked && <Lock className="w-3 h-3 ml-0.5 opacity-60" />}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
          {activeTab === 'shipping' && <DeliveryTab />}
          {activeTab === 'permits' && (
            <PlanGate
              minLevel={PLAN_STARTER}
              feature={t.planPermits}
              description={t.planPermitsDesc}
            >
              <PermitsTab />
            </PlanGate>
          )}
          {activeTab === 'insurance' && (
            <PlanGate
              minLevel={PLAN_STARTER}
              feature={t.planInsurance}
              description={t.planInsuranceDesc}
            >
              <InsuranceTab />
            </PlanGate>
          )}
          {activeTab === 'customs' && <CustomsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
