import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { trackLead, trackSignUp } from '../lib/analytics'
import Contact from '../pages/Contact'

describe('événements GA4', () => {
  beforeEach(() => {
    window.gtag = vi.fn()
    vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} })
  })
  afterEach(() => { delete window.gtag; vi.unstubAllGlobals() })

  it('generate_lead et sign_up avec les bons paramètres', () => {
    window.history.pushState({}, '', '/global/sourcing')
    trackLead('sourcing_quote')
    expect(window.gtag).toHaveBeenCalledWith('event', 'generate_lead', { form_type: 'sourcing_quote', page_path: '/global/sourcing' })
    trackSignUp('google')
    expect(window.gtag).toHaveBeenCalledWith('event', 'sign_up', { method: 'google' })
  })

  it('ne casse rien quand GA est bloqué', () => {
    delete window.gtag
    expect(() => trackLead('contact')).not.toThrow()
    window.gtag = () => { throw new Error('bloqué') }
    expect(() => trackSignUp('email')).not.toThrow()
  })

  const fill = async () => {
    render(<MemoryRouter initialEntries={['/global/contact']}><Contact /></MemoryRouter>)
    fireEvent.change(document.getElementById('name'), { target: { value: 'Awa' } })
    fireEvent.change(document.getElementById('email'), { target: { value: 'awa@test.local' } })
    fireEvent.change(document.getElementById('message'), { target: { value: 'Bonjour' } })
    return document.getElementById('subject')
  }

  it('formulaire de contact : événement seulement après un envoi réussi', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    await fill()
    expect(window.gtag).not.toHaveBeenCalled() // pas au simple remplissage
    fireEvent.submit(document.querySelector('form'))
    await waitFor(() => expect(window.gtag).toHaveBeenCalledTimes(1))
    expect(window.gtag.mock.calls[0][2]).toMatchObject({ form_type: 'contact' })
  })

  it('demande de démo : form_type = demo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    const subject = await fill()
    fireEvent.change(subject, { target: { value: 'Demande de demo' } })
    fireEvent.submit(document.querySelector('form'))
    await waitFor(() => expect(window.gtag).toHaveBeenCalled())
    expect(window.gtag.mock.calls[0][2]).toMatchObject({ form_type: 'demo' })
  })

  it('erreur serveur : aucun événement', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })))
    await fill()
    fireEvent.submit(document.querySelector('form'))
    await screen.findByText(/envoy|merci|recu|reçu/i).catch(() => {})
    await new Promise((r) => setTimeout(r, 50))
    expect(window.gtag).not.toHaveBeenCalled()
  })
})
