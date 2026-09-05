/**
 * CollectorProfile.jsx — Collector profile with subscription info
 * Refactor of Profile.jsx with dashboard-specific additions
 */

import { memo, useEffect, useState } from 'react'
import { useAuth } from '../../store/AuthContext'
import { Camera, Copy } from 'lucide-react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { ChangePassword } from '../auth/ChangePassword'
import { Tabs, Input, Select, Button, toast } from '../ui'
import { useT } from '../../i18n'
import { buyerT } from '../../i18n/buyer'

export const CollectorProfile = memo(() => {
  const { user, buyerProfile, updateUser, updateProfile } = useAuth()
  const t = useT(buyerT).profile
  const [state, setState] = useState({
    name: user?.name,
    email: user?.email,
    telephone: user?.telephone,

    // profile
    username: buyerProfile?.username,
    country: buyerProfile?.country,
    interests: buyerProfile?.interests,
    image: buyerProfile?.image,

    countries: [],
    loading: false,
    error: '',
    show: buyerProfile?.image,
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
      setState((prev) => ({ ...prev, error: t.errorImageSize }))
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
      setState((prev) => ({ ...prev, loading: true }))
      const userPayload = {
        name: state?.name,
        email: state?.email,
        telephone: state?.telephone,
      }
      const charge = { ...state }
      delete charge.loading
      delete charge.countries
      delete charge.error
      delete charge.show
      const formData = new FormData()
      Object.keys(charge).forEach((key) => {
        formData.append(key, charge[key])
      })
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (state.email && !emailRegex.test(state.email)) {
        setState((prev) => ({ ...prev, loading: false, error: t.errorInvalidEmail }))
        return
      }
      if (!state.interests || state.interests.length <= 20) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: t.errorInterestsTooShort,
        }))
        return
      }
      const updatedUser = await updateUser(userPayload)
      const updatedProfile = await updateProfile(formData)
      if (updatedUser?._id && updatedProfile?._id) {
        setState((prev) => ({ ...prev, loading: false, error: '' }))
        toast.success(t.successUpdate)
      }
    } catch (error) {
      setState({
        ...state,
        loading: false,
        error: error?.message || t.errorSave,
      })
    }
  }

  const countryOptions = state.countries.map((c) => ({ value: c.name, label: c.name }))

  const tabsData = [
    {
      value: 'personal',
      label: t.tabPersonal,
      content: (
        <div className="space-y-4">
          <Input
            label={t.labelName}
            name="name"
            value={state?.name || ''}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            required
            placeholder={user?.name}
          />
          <Input
            label={t.labelUsername}
            name="username"
            value={state?.username || ''}
            onChange={(e) => setState({ ...state, username: e.target.value })}
            required
            placeholder={buyerProfile?.username}
          />
          <Input
            label={t.labelPhone}
            type="tel"
            name="telephone"
            value={state?.telephone || ''}
            onChange={(e) => setState({ ...state, telephone: e.target.value })}
            required
            minLength={13}
            maxLength={18}
            placeholder={t.placeholderPhone}
          />
          <Input
            label={t.labelEmail}
            type="email"
            name="email"
            value={state?.email || ''}
            onChange={(e) => setState({ ...state, email: e.target.value })}
            required
            placeholder={user?.email}
          />
          <Select
            label={t.labelCountry}
            options={countryOptions}
            value={state.country}
            onChange={(value) => setState({ ...state, country: value })}
            required
          />
        </div>
      ),
    },
    {
      value: 'subscription',
      label: 'Abonnement',
      content: (
        <div className="space-y-4">
          <div className="bg-kcb-noir border border-white/[0.06] rounded-[4px] p-4">
            <p className="text-sm text-kcb-pierre mb-2">Plan actuel</p>
            <p className="text-lg font-semibold text-white mb-1">
              {buyerProfile?.subscription_plan || 'Gratuit'}
            </p>
            {buyerProfile?.subscription_renewal && (
              <p className="text-xs text-kcb-pierre">
                Renouvellement:{' '}
                {new Date(buyerProfile.subscription_renewal).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      value: 'interests',
      label: t.tabInterests,
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-kcb-sable mb-2">
              {t.labelArtisticInterests}
            </label>
            <ReactQuill
              theme="snow"
              value={state.interests || ''}
              onChange={(value) => setState({ ...state, interests: value })}
              className="border border-white/[0.08] rounded-[4px] bg-kcb-noir text-white"
              placeholder={t.placeholderInterests}
            />
          </div>
        </div>
      ),
    },
    {
      value: 'security',
      label: t.tabSecurity,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">{t.headingPassword}</h3>
            <ChangePassword />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">{t.headingWallet}</h3>
            <div className="space-y-4">
              <Input
                label={t.labelWalletAddress}
                name="wallet_address"
                value={user?.wallet?.address || ''}
                readOnly
              />
              <div>
                <label className="block text-sm font-medium text-kcb-sable mb-2">
                  {t.labelPrivateKey}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={
                      user?.wallet?.privateKey
                        ? user.wallet.privateKey.slice(0, 6) +
                          '••••••••••••••••••••' +
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
                    title={t.titleCopyKey}
                  >
                    <Copy className="w-4 h-4 text-kcb-pierre" />
                  </button>
                </div>
                <p className="text-xs text-yellow-600 mt-1">{t.warningPrivateKey}</p>
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
                {t.btnChangePhoto}
              </button>
              <input
                id="profile-image"
                className="hidden"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>
            <div className="w-full pt-4 border-t border-white/[0.06]">
              <div className="flex justify-between text-xs text-kcb-pierre">
                <span>{t.labelAccountCreated}</span>
                <span>{new Date(user?.created_at)?.toLocaleDateString()}</span>
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
            {t.btnSave}
          </Button>
        </div>
      </form>
    </section>
  )
})

CollectorProfile.displayName = 'CollectorProfile'
