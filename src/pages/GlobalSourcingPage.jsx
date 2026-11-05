import { trackLead } from '../lib/analytics'
import { useState } from 'react'
import { ArrowRight, CheckCircle, Loader2 } from 'lucide-react'
import PortalLayout from '../components/landing/PortalLayout'
import RevealOnScroll from '../components/landing/RevealOnScroll'
import SectionLabel from '../components/landing/SectionLabel'
import { createInquiry } from '../api/useSourcing'
import { useLang } from '../store/LangContext'
import { globalT } from '../i18n/global'

const PURPOSES = {
  en: [
    'Exhibition / Fair',
    'Corporate Collection',
    'Gallery Programme',
    'Private Collection',
    'Museum Acquisition',
    'Other',
  ],
  fr: [
    'Exposition / Foire',
    "Collection d'entreprise",
    'Programme de galerie',
    'Collection privée',
    'Acquisition muséale',
    'Autre',
  ],
}

const BUDGETS = {
  en: [
    '< 5 000 EUR',
    '5 000 – 20 000 EUR',
    '20 000 – 100 000 EUR',
    '100 000 – 500 000 EUR',
    '> 500 000 EUR',
    'Undisclosed',
  ],
  fr: [
    '< 5 000 EUR',
    '5 000 – 20 000 EUR',
    '20 000 – 100 000 EUR',
    '100 000 – 500 000 EUR',
    '> 500 000 EUR',
    'Non communiqué',
  ],
}

function SourcingContent() {
  const { lang } = useLang()
  const t = globalT[lang].sourcing

  const [form, setForm] = useState({
    name: '',
    email: '',
    organization: '',
    purpose: '',
    budget: '',
    message: '',
  })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name || !form.email || !form.message) {
      setError(
        lang === 'en'
          ? 'Name, email and message are required.'
          : 'Nom, email et message sont requis.'
      )
      return
    }
    setLoading(true)
    const res = await createInquiry({
      purpose: form.purpose,
      message: `[${form.name}] [${form.organization}] [Budget: ${form.budget}]\n\n${form.message}`,
      organization: form.organization,
      budget: form.budget,
      contact_name: form.name,
      contact_email: form.email,
    })
    setLoading(false)
    if (res?.error) {
      setError(res.error)
      return
    }
    trackLead('sourcing_quote')
    setSent(true)
  }

  const inputCls =
    'w-full bg-kcb-noir border border-white/[0.08] px-4 py-3 text-sm text-white placeholder-kcb-pierre/40 focus:outline-none focus:border-[var(--accent)] transition'
  const labelCls = 'block text-xs uppercase tracking-[0.08em] text-kcb-pierre mb-2 font-dm-sans'

  return (
    <div className="min-h-screen bg-kcb-noir-deep text-white pt-28">
      {/* Hero */}
      <div className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)] pb-20 border-b border-white/[0.04]">
        <RevealOnScroll>
          <SectionLabel text={t.label} />
          <h1 className="font-playfair font-bold text-[clamp(32px,4vw,56px)] text-white mt-4 mb-4 leading-tight max-w-2xl">
            {t.title}
          </h1>
          <p className="text-kcb-pierre text-[15px] leading-[1.8] max-w-xl">{t.desc}</p>
        </RevealOnScroll>
      </div>

      {/* Main grid — features + form */}
      <div className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)] py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
        {/* Features column */}
        <RevealOnScroll>
          <div className="flex flex-col gap-8">
            {t.features.map((f, i) => (
              <div key={i} className="flex gap-5">
                <div className="w-10 h-10 shrink-0 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)]">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path
                      d={f.icon}
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-sm text-white mb-1">{f.title}</p>
                  <p className="text-[13px] leading-relaxed text-kcb-pierre">{f.text}</p>
                </div>
              </div>
            ))}

            {/* Process steps */}
            <div className="mt-6 space-y-4 pt-6 border-t border-white/[0.04]">
              <p className="text-xs uppercase tracking-[0.12em] text-kcb-pierre/60 font-dm-sans mb-5">
                {lang === 'en' ? 'How it works' : 'Comment ça marche'}
              </p>
              {[
                lang === 'en'
                  ? {
                      n: '01',
                      t: 'Submit your brief',
                      d: 'Tell us your programme, budget and timeline.',
                    }
                  : {
                      n: '01',
                      t: 'Soumettez votre brief',
                      d: 'Dites-nous votre programme, budget et calendrier.',
                    },
                lang === 'en'
                  ? {
                      n: '02',
                      t: 'Curated selection',
                      d: 'Within 48h we send a selection of verified artists matching your criteria.',
                    }
                  : {
                      n: '02',
                      t: 'Sélection sur mesure',
                      d: "Sous 48h nous vous envoyons une sélection d'artistes vérifiés correspondant à vos critères.",
                    },
                lang === 'en'
                  ? {
                      n: '03',
                      t: 'End-to-end execution',
                      d: 'We handle contracts, logistics, customs, and delivery to your venue.',
                    }
                  : {
                      n: '03',
                      t: 'Exécution complète',
                      d: 'Nous gérons les contrats, la logistique, les douanes et la livraison.',
                    },
              ].map((s) => (
                <div key={s.n} className="flex gap-4">
                  <span className="font-jetbrains text-[10px] text-[var(--accent)] tracking-[0.12em] mt-0.5 shrink-0">
                    {s.n}
                  </span>
                  <div>
                    <p className="text-sm text-white font-medium mb-0.5">{s.t}</p>
                    <p className="text-xs text-kcb-pierre leading-relaxed">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </RevealOnScroll>

        {/* Form column */}
        <RevealOnScroll delay={0.1}>
          {sent ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center gap-5">
              <CheckCircle className="w-12 h-12 text-[var(--accent)]" />
              <h2 className="font-playfair text-2xl text-white font-semibold">
                {lang === 'en' ? 'Request received' : 'Demande reçue'}
              </h2>
              <p className="text-kcb-pierre text-sm max-w-xs">
                {lang === 'en'
                  ? 'Our sourcing team will get back to you within 48 hours with a curated selection.'
                  : 'Notre équipe sourcing vous répondra dans les 48h avec une sélection sur mesure.'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-xs uppercase tracking-[0.12em] text-kcb-pierre/60 font-dm-sans mb-6">
                {lang === 'en' ? 'Submit your brief' : 'Soumettre votre brief'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>
                    {lang === 'en' ? 'Full name *' : 'Nom complet *'}
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={set('name')}
                    placeholder="Jane Dupont"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{lang === 'en' ? 'Email *' : 'Email *'}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="jane@gallery.com"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  {lang === 'en' ? 'Organization / Institution' : 'Organisation / Institution'}
                </label>
                <input
                  type="text"
                  value={form.organization}
                  onChange={set('organization')}
                  placeholder={
                    lang === 'en'
                      ? 'Gallery name, museum, foundation…'
                      : 'Nom de la galerie, musée, fondation…'
                  }
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{lang === 'en' ? 'Purpose' : 'Objectif'}</label>
                  <select
                    value={form.purpose}
                    onChange={set('purpose')}
                    className={`${inputCls} cursor-pointer`}
                  >
                    <option value="">{lang === 'en' ? 'Select…' : 'Choisir…'}</option>
                    {PURPOSES[lang].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    {lang === 'en' ? 'Budget range' : 'Budget indicatif'}
                  </label>
                  <select
                    value={form.budget}
                    onChange={set('budget')}
                    className={`${inputCls} cursor-pointer`}
                  >
                    <option value="">{lang === 'en' ? 'Select…' : 'Choisir…'}</option>
                    {BUDGETS[lang].map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  {lang === 'en' ? 'Your brief *' : 'Votre brief *'}
                </label>
                <textarea
                  value={form.message}
                  onChange={set('message')}
                  rows={5}
                  placeholder={
                    lang === 'en'
                      ? "Describe your programme, the type of artworks you are looking for, artists' profiles, medium preferences, timeline…"
                      : "Décrivez votre programme, le type d'œuvres recherchées, les profils d'artistes, les médiums, le calendrier…"
                  }
                  className={`${inputCls} resize-none`}
                />
              </div>

              {error && (
                <p className="text-red-400 text-xs border border-red-900/40 bg-red-950/30 px-4 py-3">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-kcb-noir-deep font-dm-sans font-semibold text-xs tracking-[0.08em] uppercase py-4 hover:bg-[var(--accent-dark)] transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {t.cta} <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <p className="text-kcb-pierre/50 text-[11px] text-center">
                {lang === 'en'
                  ? "No commitment. We'll respond within 48 hours with a curated selection."
                  : 'Sans engagement. Réponse sous 48h avec une sélection sur mesure.'}
              </p>
            </form>
          )}
        </RevealOnScroll>
      </div>
    </div>
  )
}

export default function GlobalSourcingPage() {
  return (
    <PortalLayout portal="global">
      <SourcingContent />
    </PortalLayout>
  )
}
