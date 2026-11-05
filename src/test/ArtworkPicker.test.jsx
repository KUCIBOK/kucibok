import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ArtworkPicker } from '../components/delivery/ArtworkPicker'

const respond = (data) => ({ ok: true, json: async () => data })

describe('ArtworkPicker', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('/artworks/my')) return respond([{ id: 'a1', title: 'Masque Dogon', status: 'approved' }, { id: 'a3', title: 'Refusée', status: 'rejected' }])
      // Collection d'un curateur / conseiller / collectionneur ; a1 apparaît dans les deux listes
      return respond({ artworks: [{ id: 'a1', title: 'Masque Dogon' }, { id: 'a2', title: 'Bronze Bénin', kucibok_id: 'KCB-12345678' }] })
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('liste mes œuvres et ma collection sans doublon ni œuvre rejetée', async () => {
    render(<ArtworkPicker value={[]} onChange={() => {}} />)
    await waitFor(() => expect(screen.getByText('Masque Dogon')).toBeInTheDocument())
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.getByText('Bronze Bénin')).toBeInTheDocument()
    expect(screen.queryByText('Refusée')).not.toBeInTheDocument()
  })

  it('sélectionne et désélectionne une œuvre', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<ArtworkPicker value={[]} onChange={onChange} />)
    fireEvent.click(await screen.findByText('Bronze Bénin'))
    expect(onChange).toHaveBeenLastCalledWith(['a2'])
    rerender(<ArtworkPicker value={['a2']} onChange={onChange} />)
    expect(screen.getByText('1 sélectionnée(s)')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Bronze Bénin'))
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('explique quoi faire quand il n’y a aucune œuvre', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respond([])))
    render(<ArtworkPicker value={[]} onChange={() => {}} />)
    expect(await screen.findByText(/Aucune œuvre disponible/)).toBeInTheDocument()
  })
})
