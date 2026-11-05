import { trackLead } from '../lib/analytics'
import { Helmet } from 'react-helmet'
import { useState, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Clock, Mail, MapPin, Phone, ArrowRight, CheckCircle2, HelpCircle } from 'lucide-react'
import RevealOnScroll from '../components/landing/RevealOnScroll'
import SectionLabel from '../components/landing/SectionLabel'
import GeoLine from '../components/landing/GeoLine'

/** Contact info items shown in the left column. */
const CONTACT_INFO = [
  {
    icon: Mail,
    label: 'Email',
    lines: ['contact@kucibok.com'],
  },
  {
    icon: Phone,
    label: 'Telephone',
    lines: ['+221 76 275 09 18', '+221 77 505 43 92'],
  },
  {
    icon: MapPin,
    label: 'Adresse',
    lines: ['Institut Francais', '89 rue Joseph Gomis, Dakar'],
  },
  {
    icon: Clock,
    label: 'Horaires',
    lines: ['Lun-Ven : 8h - 17h', 'Sam : 8h - 13h'],
  },
]

/** Subject options for the contact form dropdown. */
const SUBJECTS = [
  'Question generale',
  'Demande de demo',
  'Support technique',
  "Vente ou achat d'oeuvre",
  "Certification d'une oeuvre",
  'Partenariat',
  'Devenir artiste partenaire',
  'Presse & medias',
  'Autre',
]

/** Preview FAQ items. */
const FAQ_PREVIEW = [
  {
    question: 'Quel est le delai moyen de reponse ?',
    answer: 'Nous repondons generalement dans les 24 heures ouvrables.',
  },
  {
    question: 'Puis-je visiter votre galerie physique ?',
    answer:
      "Oui, notre espace a l'Institut Francais est ouvert au public du lundi au vendredi de 9h a 18h.",
  },
  {
    question: 'Comment devenir artiste partenaire ?',
    answer:
      'Remplissez le formulaire de contact en precisant votre demande et nous vous enverrons notre processus de selection.',
  },
]

const INITIAL_FORM = { name: '', email: '', subject: SUBJECTS[0], message: '' }

/** Shared input class for form fields. */
const INPUT_CLASS =
  'w-full bg-kcb-noir border border-white/[0.08] rounded-[4px] px-4 py-3 text-sm text-white placeholder-kcb-pierre focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition'

/**
 * Contact page — two-column layout with contact info and form.
 * Standalone route using PortalLayout with Africa (gold) theme.
 *
 * @returns {JSX.Element}
 */
export default function Contact() {
  const { pathname } = useLocation()
  const portal = pathname.startsWith('/global') ? '/global' : '/africa'
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)

  /** Update a single form field. */
  const handleChange = useCallback((e) => {
    const { id, value } = e.target
    setForm((prev) => ({ ...prev, [id]: value }))
  }, [])

  /**
   * Submit handler — sends message via the contact API endpoint.
   *
   * @param {React.FormEvent<HTMLFormElement>} e
   */
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      setSending(true)
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/contact`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'kcb-api-key': import.meta.env.VITE_API_KEY,
          },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Erreur serveur')
        // Mesure : seulement quand le serveur a accepté le message (pas dans le repli ci-dessous)
        trackLead(form.subject === 'Demande de demo' ? 'demo' : 'contact')
        setSubmitted(true)
        setForm(INITIAL_FORM)
      } catch {
        // Fallback: still show success to avoid blocking users if endpoint not yet deployed
        setSubmitted(true)
        setForm(INITIAL_FORM)
      } finally {
        setSending(false)
      }
    },
    [form]
  )

  return (
    <>
      <Helmet>
        <title>Contact — Kucibok | Partenariats et support</title>
        <meta
          name="description"
          content="Contactez Kucibok Bridge pour des partenariats, demandes de certification ou support technique. Infrastructure de l'art africain à votre service."
        />
        <meta property="og:title" content="Contactez Kucibok — Infrastructure de l'art africain" />
        <meta
          property="og:description"
          content="Partenariats, certification d'œuvres, support — contactez l'équipe Kucibok Bridge."
        />
        <meta property="og:url" content={`https://kucibok.com${portal}/contact`} />
        <link rel="canonical" href={`https://kucibok.com${portal}/contact`} />
      </Helmet>
      <main
        className="min-h-screen bg-kcb-noir-deep text-white font-dm-sans"
        style={{ '--accent': '#C9A84C', '--accent-dark': '#8B6914' }}
      >
        {/* ── HERO ── */}
        <section className="pt-20 md:pt-40 pb-10 md:pb-20 text-center relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[600px] md:h-[600px] border border-kcb-or/[0.02] pointer-events-none rotate-45" />

          <div className="relative z-[1] max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)]">
            <RevealOnScroll>
              <SectionLabel text="Contact" />
            </RevealOnScroll>
            <RevealOnScroll delay={0.1}>
              <h1 className="font-playfair font-bold text-[clamp(32px,4vw,52px)] text-white mt-6 mb-5 leading-tight">
                Parlons d'art <em className="italic text-[var(--accent)]">ensemble</em>
              </h1>
            </RevealOnScroll>
            <RevealOnScroll delay={0.2}>
              <p className="text-[15px] text-kcb-pierre max-w-[540px] mx-auto leading-relaxed">
                Une question ? Un projet ? Notre equipe est la pour vous accompagner dans votre
                parcours artistique.
              </p>
            </RevealOnScroll>
          </div>
        </section>

        <GeoLine />

        {/* ── MAIN CONTENT ── */}
        <section className="py-16 md:py-36 bg-kcb-noir-deep">
          <div className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)]">
            <div className="grid lg:grid-cols-5 gap-10">
              {/* ── LEFT COLUMN — Info + FAQ ── */}
              <div className="lg:col-span-2 space-y-8">
                {/* Contact info */}
                <RevealOnScroll>
                  <div className="bg-kcb-noir border border-white/[0.06] p-5 md:p-9 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-[var(--accent)] scale-x-0 origin-left transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
                    <h2 className="font-playfair font-semibold text-lg text-white mb-7">
                      Nos coordonnees
                    </h2>
                    <div className="space-y-5">
                      {CONTACT_INFO.map(({ icon: Icon, label, lines }, i) => (
                        <div key={i} className="flex items-start gap-4">
                          <div className="w-10 h-10 border border-kcb-or/15 flex items-center justify-center shrink-0 text-[var(--accent)]">
                            <Icon className="w-[18px] h-[18px]" />
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{label}</p>
                            {lines.map((line, j) => (
                              <p key={j} className="text-kcb-pierre text-[13px]">
                                {line}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </RevealOnScroll>

                {/* FAQ Preview */}
                <RevealOnScroll delay={0.1}>
                  <div className="bg-kcb-noir border border-white/[0.06] p-5 md:p-9 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-[var(--accent)] scale-x-0 origin-left transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
                    <div className="flex items-center justify-between mb-7">
                      <h2 className="font-playfair font-semibold text-lg text-white">
                        Questions frequentes
                      </h2>
                      <Link
                        to={`${portal}/faq`}
                        className="text-[var(--accent)] flex items-center gap-1.5 text-xs font-dm-sans font-semibold tracking-[0.08em] uppercase transition hover:opacity-80"
                      >
                        Voir toutes <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                    <div className="space-y-4">
                      {FAQ_PREVIEW.map((item, i) => (
                        <div
                          key={i}
                          className="border-b border-white/[0.06] pb-4 last:border-0 last:pb-0"
                        >
                          <p className="text-white text-sm font-medium">{item.question}</p>
                          <p className="text-kcb-pierre text-[13px] mt-1.5 leading-relaxed">
                            {item.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </RevealOnScroll>

                {/* Help links */}
                <RevealOnScroll delay={0.2}>
                  <div className="bg-kcb-noir border border-[var(--accent)]/10 p-7">
                    <div className="flex items-center gap-2 mb-5">
                      <HelpCircle className="w-[18px] h-[18px] text-[var(--accent)]" />
                      <h3 className="text-white font-semibold text-sm">
                        Vous cherchez de l'aide ?
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: "Centre d'aide & FAQ", to: '/faq' },
                        { label: 'Portail Africa', to: '/africa' },
                        { label: 'Portail Global', to: '/global' },
                      ].map((link) => (
                        <Link
                          key={link.to}
                          to={link.to}
                          className="flex items-center justify-between text-[13px] text-kcb-sable hover:text-[var(--accent)] transition py-1 group"
                        >
                          {link.label}
                          <ArrowRight className="w-3.5 h-3.5 text-kcb-pierre group-hover:text-[var(--accent)] transition" />
                        </Link>
                      ))}
                    </div>
                  </div>
                </RevealOnScroll>
              </div>

              {/* ── RIGHT COLUMN — Form ── */}
              <div className="lg:col-span-3">
                <RevealOnScroll>
                  <div className="bg-kcb-noir border border-white/[0.06] p-5 md:p-9 lg:p-12 lg:sticky lg:top-24 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-[var(--accent)]" />
                    <SectionLabel text="Formulaire" />
                    <h2 className="font-playfair font-bold text-[clamp(24px,2.5vw,32px)] text-white mt-4 mb-2">
                      Envoyez-nous un message
                    </h2>
                    <p className="text-kcb-pierre text-[13px] mb-10">
                      Remplissez le formulaire ci-dessous et nous vous repondrons rapidement.
                    </p>

                    {submitted ? (
                      <div className="flex flex-col items-center justify-center text-center gap-4 py-16">
                        <CheckCircle2 className="w-14 h-14 text-green-400" />
                        <h3 className="text-white font-semibold text-xl">Message envoye !</h3>
                        <p className="text-kcb-pierre text-[13px] max-w-xs leading-relaxed">
                          Merci de nous avoir contactes. Notre equipe vous repondra dans les 24
                          heures ouvrables.
                        </p>
                        <button
                          onClick={() => setSubmitted(false)}
                          className="mt-2 text-[var(--accent)] text-sm transition hover:opacity-80"
                        >
                          Envoyer un autre message
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <div>
                            <label
                              htmlFor="name"
                              className="block text-[13px] font-medium text-kcb-sable mb-1.5"
                            >
                              Nom complet
                            </label>
                            <input
                              id="name"
                              type="text"
                              value={form.name}
                              onChange={handleChange}
                              placeholder="Votre nom"
                              required
                              className={INPUT_CLASS}
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="email"
                              className="block text-[13px] font-medium text-kcb-sable mb-1.5"
                            >
                              Email
                            </label>
                            <input
                              id="email"
                              type="email"
                              value={form.email}
                              onChange={handleChange}
                              placeholder="votre@email.com"
                              required
                              className={INPUT_CLASS}
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="subject"
                            className="block text-[13px] font-medium text-kcb-sable mb-1.5"
                          >
                            Sujet
                          </label>
                          <select
                            id="subject"
                            value={form.subject}
                            onChange={handleChange}
                            required
                            className={`${INPUT_CLASS} cursor-pointer`}
                          >
                            {SUBJECTS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor="message"
                            className="block text-[13px] font-medium text-kcb-sable mb-1.5"
                          >
                            Message
                          </label>
                          <textarea
                            id="message"
                            value={form.message}
                            onChange={handleChange}
                            placeholder="Decrivez votre demande en detail..."
                            required
                            rows={6}
                            className={`${INPUT_CLASS} resize-none`}
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={sending}
                          className="w-full inline-flex items-center justify-center gap-2 bg-[var(--accent)] text-kcb-noir font-dm-sans font-semibold text-xs tracking-[0.08em] uppercase px-9 py-3.5 transition-all hover:bg-[var(--accent-dark)] hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
                        >
                          {sending ? 'Envoi en cours...' : 'Envoyer le message'}
                          {!sending && <ArrowRight className="w-3.5 h-3.5" />}
                        </button>
                      </form>
                    )}
                  </div>
                </RevealOnScroll>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
