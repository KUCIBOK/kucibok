import { useEffect, useState } from 'react'
import { useAuth } from '../../store/AuthContext'
import { Camera, Copy } from 'lucide-react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { ChangePassword } from '../auth/ChangePassword'
import { Tabs, Input, Select, Button, toast } from '../ui'
import { useT } from '../../i18n'
import { artistT } from '../../i18n/artist'

export const Profile = () => {
  const { user, artistProfile, updateUser, updateArtist } = useAuth()
  const t = useT(artistT).profile
  const [state, setState] = useState({
    name: user?.name,
    email: user?.email,
    telephone: user?.telephone,
    username: artistProfile?.username,
    country: artistProfile?.country,
    biography: artistProfile?.biography,
    portfolio: artistProfile?.portfolio,
    image: artistProfile?.image,
    facebook: artistProfile?.socials?.facebook || '',
    twitter: artistProfile?.socials?.twitter || '',
    instagram: artistProfile?.socials?.instagram || '',

    countries: [],
    loading: false,
    error: '',
    show: artistProfile?.image,
  })

  useEffect(() => {
    const fetchCountries = async () => {
      const response = await fetch('/data/countries.json')
      const data = await response.json()
      setState((prev) => ({ ...prev, countries: data }))
    }
    fetchCountries()
  }, [])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setState((prev) => ({ ...prev, error: t.errors.imageSize }))
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setState((prev) => ({ ...prev, show: reader.result, image: file, error: '' }))
    }
    reader.readAsDataURL(file)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
      setState({ ...state, loading: true })

      // ✅ Validation: Email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (state.email && !emailRegex.test(state.email)) {
        setState((prev) => ({ ...prev, loading: false, error: t.errors.invalidEmail }))
        return
      }

      // ✅ Validation: Biography minimum length (strip HTML tags for length check)
      const bioText = state.biography?.replace(/<[^>]*>/g, '') || ''
      if (!bioText || bioText.trim().length < 20) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: t.errors.biographyMin,
        }))
        return
      }

      // Update user fields (name, email, phone)
      const userPayload = {
        name: state?.name,
        email: state?.email,
        telephone: state?.telephone,
      }
      // ✅ FIX: Pass user.id as first parameter
      const updatedUser = await updateUser(user.id, userPayload)

      // Prepare artist fields for update
      const artistFields = { ...state }
      delete artistFields.loading
      delete artistFields.countries
      delete artistFields.error
      delete artistFields.show
      delete artistFields.addresskeyShow
      // Remove user fields (only send artist-specific fields)
      delete artistFields.name        // ← belongs to users table
      delete artistFields.email       // ← belongs to users table
      delete artistFields.telephone   // ← belongs to users table

      const formData = new FormData()
      Object.keys(artistFields).forEach((key) => {
        if (artistFields[key] !== null && artistFields[key] !== undefined) {
          formData.append(key, artistFields[key])
        }
      })

      // ✅ FIX: Validate artistProfile.id exists before updating
      if (!artistProfile?.id) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Erreur: Profil artiste non trouvé. Recharges la page.',
        }))
        return
      }

      // Update artist profile (passes artistProfile.id, not user.id)
      const updatedArtist = await updateArtist(artistProfile.id, formData)

      // Check if both updates succeeded
      if (
        (updatedUser?.id || updatedUser?._id) &&
        (updatedArtist?.id || updatedArtist?._id || updatedArtist?.userId)
      ) {
        setState((prev) => ({ ...prev, loading: false, error: '' }))
        toast.success(t.successSaved)
      } else if (updatedUser?.error) {
        setState((prev) => ({ ...prev, loading: false, error: updatedUser.error }))
      } else if (updatedArtist?.error) {
        setState((prev) => ({ ...prev, loading: false, error: updatedArtist.error }))
      } else {
        setState((prev) => ({ ...prev, loading: false, error: t.errors.saveError }))
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || t.errors.saveError,
      }))
    }
  }

  const countryOptions = state.countries.map((c) => ({ value: c.name, label: c.name }))

  const tabsData = [
    {
      value: 'personal',
      label: t.tabs.personal,
      content: (
        <div className="space-y-4">
          <Input
            label={t.fields.fullName}
            name="name"
            value={state?.name || ''}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            required
            placeholder={user?.name}
          />
          <Input
            label={t.fields.username}
            name="username"
            value={state?.username || ''}
            onChange={(e) => setState({ ...state, username: e.target.value })}
            required
            placeholder={artistProfile?.username}
          />
          <Input
            label={t.fields.phone}
            type="tel"
            name="telephone"
            value={state?.telephone || ''}
            onChange={(e) => setState({ ...state, telephone: e.target.value })}
            required
            minLength={13}
            maxLength={18}
            placeholder={t.fields.phonePlaceholder}
          />
          <Input
            label={t.fields.email}
            type="email"
            name="email"
            value={state?.email || ''}
            onChange={(e) => setState({ ...state, email: e.target.value })}
            required
            placeholder={user?.email}
          />
          <Select
            label={t.fields.country}
            options={countryOptions}
            value={state.country}
            onChange={(value) => setState({ ...state, country: value })}
            required
          />
        </div>
      ),
    },
    {
      value: 'biography',
      label: t.tabs.biography,
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-kcb-sable mb-2">{t.fields.biography}</label>
            <ReactQuill
              theme="snow"
              value={state.biography || ''}
              onChange={(value) => setState({ ...state, biography: value })}
              className="border border-white/[0.06] rounded-[4px] bg-white text-black"
              placeholder={t.fields.biographyPlaceholder}
            />
          </div>
          <Input
            label={t.fields.portfolio}
            type="url"
            name="portfolio"
            value={state?.portfolio || ''}
            onChange={(e) => setState({ ...state, portfolio: e.target.value })}
            placeholder={t.fields.portfolioPlaceholder}
          />
          <div>
            <label className="block text-sm font-medium text-kcb-sable mb-2">{t.fields.socialNetworks}</label>
            <div className="space-y-3 mt-3">
              <Input
                label="Facebook"
                type="url"
                value={state?.facebook || ''}
                onChange={(e) => setState({ ...state, facebook: e.target.value })}
                placeholder={t.fields.facebookPlaceholder}
              />
              <Input
                label="Twitter"
                type="url"
                value={state?.twitter || ''}
                onChange={(e) => setState({ ...state, twitter: e.target.value })}
                placeholder={t.fields.twitterPlaceholder}
              />
              <Input
                label="Instagram"
                type="url"
                value={state?.instagram || ''}
                onChange={(e) => setState({ ...state, instagram: e.target.value })}
                placeholder={t.fields.instagramPlaceholder}
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      value: 'security',
      label: t.tabs.security,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">{t.fields.changePassword}</h3>
            <ChangePassword />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">{t.fields.wallet}</h3>
            <div className="space-y-4">
              <Input
                label={t.fields.walletAddress}
                name="wallet_address"
                value={user?.wallet?.address || ''}
                readOnly
              />
              <div>
                <label className="block text-sm font-medium text-kcb-sable mb-2">{t.fields.privateKey}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={
                      user?.wallet?.privateKey
                        ? user.wallet.privateKey.slice(0, 6) +
                          '��������������������' +
                          user.wallet.privateKey.slice(-4)
                        : ''
                    }
                    className="flex-1 px-4 py-2 bg-kcb-noir border border-white/[0.06] rounded-[4px] text-white text-sm focus:outline-none font-mono"
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(user?.wallet?.privateKey || '')}
                    className="px-4 py-2 border border-white/[0.06] bg-kcb-noir rounded-[4px] hover:bg-kcb-ardoise transition"
                    title={t.fields.copyPrivateKey}
                  >
                    <Copy className="w-4 h-4 text-kcb-pierre" />
                  </button>
                </div>
                <p className="text-xs text-yellow-600 mt-1">{t.fields.privateKeyWarning}</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ]
  return (
    <section className="bg-kcb-ardoise rounded-[4px] shadow-md border border-white/[0.06] px-4 py-6 md:px-8 md:py-8 w-full mx-auto">
      <form onSubmit={handleUpdate} method="post" className="space-y-6">
        {state.error && (
          <div className="text-red-300 text-center bg-red-900/20 border border-red-900 rounded-[4px] p-2 text-xs">
            {state.error}
          </div>
        )}
        {/* Profile Header */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Avatar Section */}
          <div className="rounded-[4px] border border-white/[0.06] bg-kcb-ardoise p-6 flex flex-col items-center gap-4 h-fit lg:w-72">
            <div className="text-center">
              {state?.image ? (
                <img
                  src={state?.show}
                  alt="Profile"
                  className="w-28 h-28 object-cover rounded-full mb-4 mx-auto border-4 border-white/[0.06] shadow"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-kcb-ardoise mb-4 flex justify-center items-center mx-auto border-4 border-white/[0.06]">
                  <Camera className="w-10 h-10 text-kcb-pierre" />
                </div>
              )}
              <p className="font-sans text-white font-medium text-base mb-3">{user?.name}</p>
              <button
                type="button"
                onClick={() => document.getElementById('profile-image').click()}
                className="border border-white/[0.06] bg-kcb-ardoise w-full rounded-[4px] text-xs text-kcb-sable font-medium px-3 py-2 hover:bg-kcb-ardoise transition"
              >
                {t.avatar.editPhoto}
              </button>
              <input
                id="profile-image"
                className="hidden"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>
            <div className="w-full pt-4 border-t border-white/[0.06] space-y-2">
              <div className="flex justify-between text-xs text-kcb-pierre">
                <span>{t.avatar.accountCreated}</span>
                <span>{new Date(user?.created_at)?.toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-xs text-kcb-pierre">
                <span>{t.avatar.publishedArtworks}</span>
                <span>{artistProfile?.artworkCount || 0}</span>
              </div>
            </div>
          </div>

          {/* Tabs Section */}
          <div className="flex-1">
            <Tabs tabs={tabsData} defaultValue="personal" variant="line" />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4 border-t border-white/[0.06]">
          <Button type="submit" disabled={state?.loading} loading={state?.loading} size="lg">
            {t.save}
          </Button>
        </div>
      </form>
    </section>
  )
}
