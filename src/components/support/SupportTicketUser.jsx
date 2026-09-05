import { useState, useEffect } from 'react'
import { Plus, Send, MessageSquare, AlertCircle } from 'lucide-react'
import { utils } from '../../api/useAPI'

export default function SupportTicketUser() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [formData, setFormData] = useState({
    category: 'autre',
    priority: 'normale',
    subject: '',
    description: '',
  })
  const [newResponse, setNewResponse] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    loadTickets()
  }, [])

  const loadTickets = async () => {
    try {
      const response = await fetch(`${utils.api}/support-tickets/my-tickets`, {
        headers: utils.options.headers,
      })
      const data = await response.json()
      setTickets(data.tickets || [])
    } catch (error) {
      // Silenced for production
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTicket = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError('')

    try {
      const response = await fetch(`${utils.api}/support-tickets/create`, {
        method: 'POST',
        headers: utils.options.headers,
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setFormData({
          category: 'autre',
          priority: 'normale',
          subject: '',
          description: '',
        })
        setIsModalOpen(false)
        loadTickets()
      } else {
        const data = await response.json().catch(() => ({}))
        setFormError(data.error || 'Impossible de créer le ticket.')
      }
    } catch (error) {
      setFormError(error.message || 'Impossible de créer le ticket.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddResponse = async () => {
    if (!newResponse.trim()) return

    try {
      const response = await fetch(
        `${utils.api}/support-tickets/ticket/${selectedTicket.ticketId}/response`,
        {
          method: 'POST',
          headers: utils.options.headers,
          body: JSON.stringify({ message: newResponse }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        setSelectedTicket(data.ticket)
        setNewResponse('')
        loadTickets()
      }
    } catch (error) {
      // Silenced for production
    }
  }

  const statusColors = {
    ouvert: 'bg-green-500/20 text-green-300',
    en_cours: 'bg-kcb-or/10 text-kcb-or',
    resolu: 'bg-kcb-bronze/10 text-kcb-bronze',
    ferme: 'bg-gray-500/20 text-kcb-sable',
  }

  const priorityColors = {
    basse: 'bg-kcb-or/10 text-kcb-or',
    normale: 'bg-gray-500/20 text-kcb-sable',
    haute: 'bg-kcb-alerte/20 text-kcb-alerte',
    critique: 'bg-red-500/20 text-red-300',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-kcb-pierre">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Bouton créer */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Support & Tickets</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-kcb-or hover:bg-kcb-or/90 text-kcb-noir rounded-[4px] text-white text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> Nouveau ticket
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liste des tickets */}
        <div className="lg:col-span-1">
          <div className="bg-kcb-ardoise/50 rounded-[4px] border border-white/[0.06] p-4 max-h-96 overflow-y-auto">
            {tickets.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 mx-auto text-kcb-pierre mb-2" />
                <p className="text-kcb-pierre text-sm">Aucun ticket</p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="mt-3 text-kcb-or hover:text-kcb-or/80 text-sm"
                >
                  Créer un ticket →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.map((ticket) => (
                  <button
                    key={ticket._id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`w-full text-left p-3 rounded-[4px] border transition ${
                      selectedTicket?._id === ticket._id
                        ? 'bg-kcb-or/10 border-kcb-or'
                        : 'bg-kcb-ardoise border-white/[0.06] hover:border-white/[0.08]'
                    }`}
                  >
                    <div className="text-xs font-mono text-kcb-pierre mb-1">{ticket.ticketId}</div>
                    <div className="font-medium text-white text-sm line-clamp-2">
                      {ticket.subject}
                    </div>
                    <div className="flex gap-1 mt-2">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${statusColors[ticket.status]}`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Détails du ticket */}
        {selectedTicket ? (
          <div className="lg:col-span-2 bg-kcb-ardoise/50 rounded-[4px] border border-white/[0.06] p-6">
            <div className="mb-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-xs text-kcb-pierre mb-1">{selectedTicket.ticketId}</div>
                  <h3 className="text-xl font-bold text-white">{selectedTicket.subject}</h3>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${priorityColors[selectedTicket.priority]}`}
                >
                  {selectedTicket.priority}
                </span>
              </div>
              <p className="text-kcb-pierre text-sm mt-3">{selectedTicket.description}</p>
            </div>

            {/* Statut et catégorie */}
            <div className="flex gap-2 mb-6 pb-6 border-b border-white/[0.06]">
              <span className={`text-xs px-2 py-1 rounded ${statusColors[selectedTicket.status]}`}>
                {selectedTicket.status}
              </span>
              <span className="text-xs bg-kcb-ardoise text-kcb-sable px-2 py-1 rounded">
                {selectedTicket.category}
              </span>
            </div>

            {/* Historique */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-white mb-3">
                Historique ({selectedTicket.responses?.length || 0})
              </h4>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {selectedTicket.responses?.map((response, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-[4px] ${
                      response.responderType === 'admin'
                        ? 'bg-kcb-or/10 border border-kcb-or/30'
                        : 'bg-kcb-ardoise/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-semibold ${
                          response.responderType === 'admin' ? 'text-kcb-or' : 'text-kcb-sable'
                        }`}
                      >
                        {response.responderName}
                      </span>
                      <span className="text-xs text-kcb-pierre">
                        {new Date(response.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <p className="text-sm text-kcb-sable">{response.message}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Ajouter une réponse */}
            {selectedTicket.status !== 'ferme' && (
              <div className="space-y-3">
                <textarea
                  value={newResponse}
                  onChange={(e) => setNewResponse(e.target.value)}
                  placeholder="Votre réponse..."
                  className="w-full px-3 py-2 bg-kcb-ardoise border border-white/[0.06] rounded text-white text-sm resize-none h-20"
                />
                <button
                  onClick={handleAddResponse}
                  disabled={!newResponse.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-kcb-or hover:bg-kcb-or/90 text-kcb-noir disabled:opacity-50 rounded text-white text-sm font-medium transition"
                >
                  <Send className="w-4 h-4" /> Envoyer
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2 bg-kcb-ardoise/50 rounded-[4px] border border-white/[0.06] p-12 flex items-center justify-center">
            <div className="text-center text-kcb-pierre">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Sélectionnez un ticket</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal de création */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] max-w-lg w-full p-6 max-h-96 overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">Créer un ticket</h2>
            {formError && <p className="mb-3 text-sm text-red-300">{formError}</p>}

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-kcb-sable mb-2">Catégorie</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-kcb-ardoise border border-white/[0.06] rounded text-white text-sm"
                >
                  <option value="paiement">💳 Paiement</option>
                  <option value="livraison">🚚 Livraison</option>
                  <option value="artwork">🎨 Œuvre</option>
                  <option value="compte">👤 Compte</option>
                  <option value="encheres">⚒️ Enchères</option>
                  <option value="autre">❓ Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-kcb-sable mb-2">Priorité</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 bg-kcb-ardoise border border-white/[0.06] rounded text-white text-sm"
                >
                  <option value="basse">Basse</option>
                  <option value="normale">Normale</option>
                  <option value="haute">Haute</option>
                  <option value="critique">Critique</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-kcb-sable mb-2">Sujet</label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Résumé du problème..."
                  maxLength={200}
                  required
                  className="w-full px-3 py-2 bg-kcb-ardoise border border-white/[0.06] rounded text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-kcb-sable mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Décrivez votre problème..."
                  required
                  rows={4}
                  className="w-full px-3 py-2 bg-kcb-ardoise border border-white/[0.06] rounded text-white text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-kcb-ardoise hover:bg-kcb-ardoise rounded text-white text-sm font-medium transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-kcb-or hover:bg-kcb-or/90 text-kcb-noir disabled:opacity-50 rounded text-white text-sm font-medium transition"
                >
                  {submitting ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
