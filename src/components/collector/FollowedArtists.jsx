/**
 * FollowedArtists.jsx — Followed artists & notification preferences
 */

import { useState } from 'react'
import { useFollowedArtists, useUnfollowArtistMutation } from '../../api/useFollowedArtistsQuery'
import { useNotificationPreferences, useUpdateNotificationPreferencesMutation } from '../../api/useNotificationsQuery'
import { Trash2, Bell, ChevronDown } from 'lucide-react'

export default function FollowedArtists() {
  const { data: followedData, isLoading } = useFollowedArtists()
  const { data: prefsData } = useNotificationPreferences()
  const { mutate: unfollow } = useUnfollowArtistMutation()
  const { mutate: updatePrefs } = useUpdateNotificationPreferencesMutation()

  const [expandedPrefs, setExpandedPrefs] = useState(false)
  const [tempPrefs, setTempPrefs] = useState(prefsData?.preferences || {})

  const artists = followedData?.artists || []

  const handleUnfollow = (artistId) => {
    if (confirm('Êtes-vous sûr de vouloir ne plus suivre cet artiste?')) {
      unfollow(artistId)
    }
  }

  const handleSavePrefs = () => {
    updatePrefs(tempPrefs)
    setExpandedPrefs(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Suivi & Alertes</h1>
        <p className="text-kcb-pierre">
          {artists.length} artiste{artists.length !== 1 ? 's' : ''} suivi{artists.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Notification Preferences Section */}
      <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] overflow-hidden">
        <button
          onClick={() => setExpandedPrefs(!expandedPrefs)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-kcb-noir transition"
        >
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-kcb-or" />
            <span className="text-white font-medium">Réglages de notification</span>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-kcb-pierre transition ${expandedPrefs ? 'rotate-180' : ''}`}
          />
        </button>

        {expandedPrefs && (
          <div className="border-t border-white/[0.06] px-4 py-4 space-y-4">
            <div>
              <label className="text-sm text-kcb-pierre mb-2 block">Mode de notification</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="notification_mode"
                    value="in_app"
                    checked={tempPrefs.notification_mode === 'in_app'}
                    onChange={(e) => setTempPrefs({ ...tempPrefs, notification_mode: e.target.value })}
                    className="w-4 h-4"
                  />
                  <span className="text-white text-sm">En app seulement</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="notification_mode"
                    value="email"
                    checked={tempPrefs.notification_mode === 'email'}
                    onChange={(e) => setTempPrefs({ ...tempPrefs, notification_mode: e.target.value })}
                    className="w-4 h-4"
                  />
                  <span className="text-white text-sm">Par email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="notification_mode"
                    value="both"
                    checked={tempPrefs.notification_mode === 'both'}
                    onChange={(e) => setTempPrefs({ ...tempPrefs, notification_mode: e.target.value })}
                    className="w-4 h-4"
                  />
                  <span className="text-white text-sm">En app et par email</span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-sm text-kcb-pierre mb-2 block">Fréquence</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="frequency"
                    value="immediate"
                    checked={tempPrefs.frequency === 'immediate'}
                    onChange={(e) => setTempPrefs({ ...tempPrefs, frequency: e.target.value })}
                    className="w-4 h-4"
                  />
                  <span className="text-white text-sm">Immédiat</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="frequency"
                    value="weekly"
                    checked={tempPrefs.frequency === 'weekly'}
                    onChange={(e) => setTempPrefs({ ...tempPrefs, frequency: e.target.value })}
                    className="w-4 h-4"
                  />
                  <span className="text-white text-sm">Récapitulatif hebdomadaire</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-white/[0.06]">
              <button
                onClick={handleSavePrefs}
                className="px-4 py-2 bg-kcb-or text-kcb-noir font-medium rounded-[4px] hover:bg-kcb-bronze transition"
              >
                Enregistrer
              </button>
              <button
                onClick={() => setExpandedPrefs(false)}
                className="px-4 py-2 bg-kcb-noir border border-white/[0.06] text-white rounded-[4px] hover:border-white/[0.12] transition"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Artists List */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Artistes suivis</h2>

        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-kcb-or border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && artists.length === 0 && (
          <div className="text-center py-8">
            <p className="text-kcb-pierre mb-4">Vous ne suivez pas encore d'artiste</p>
            <p className="text-sm text-kcb-sable">Explorez le catalogue et suivez vos artistes préférés</p>
          </div>
        )}

        {artists.length > 0 && (
          <div className="space-y-2">
            {artists.map((artist) => (
              <div
                key={artist.id}
                className="flex items-center gap-4 bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-4 hover:border-white/[0.12] transition group"
              >
                {artist.image && (
                  <img
                    src={artist.image}
                    alt={artist.name}
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{artist.name}</h3>
                  {artist.has_new_work && (
                    <span className="inline-block mt-1 text-xs text-kcb-or font-medium bg-kcb-noir px-2 py-1 rounded">
                      ✨ Nouvelle œuvre disponible
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleUnfollow(artist.id)}
                  className="p-2 text-kcb-pierre hover:text-red-400 hover:bg-kcb-noir rounded-[4px] transition opacity-0 group-hover:opacity-100"
                  title="Ne plus suivre"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
