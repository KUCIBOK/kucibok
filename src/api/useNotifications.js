import { useState } from 'react'
import { utils } from './useAPI'

const { api } = utils

/**
 * Sourcing Inquiry — Submit B2B partnership request
 * @param {Object} payload - { organization, purpose, budget?, message }
 */
export async function submitSourcingInquiry(payload) {
  try {
    const response = await fetch(`${api}/sourcing/inquiry`, {
      ...utils.options,
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const body = await response.json()
    if (!response.ok) {
      return { error: body?.error ?? 'Failed to submit inquiry' }
    }
    return body?.data ?? body
  } catch (error) {
    return { error: error.message }
  }
}

/**
 * Delivery Request — Create logistics booking
 * @param {Object} payload - { artwork_ids, destination_country, delivery_type?, special_instructions? }
 */
export async function submitDeliveryRequest(payload) {
  try {
    const response = await fetch(`${api}/delivery/request`, {
      ...utils.options,
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const body = await response.json()
    if (!response.ok) {
      return { error: body?.error ?? 'Failed to create delivery request' }
    }
    return body?.data ?? body
  } catch (error) {
    return { error: error.message }
  }
}

/**
 * Payment Webhook — Log payment notification
 * @param {Object} payload - { transaction_id, status, amount, user_id?, type?, currency? }
 */
export async function logPaymentWebhook(payload) {
  try {
    const response = await fetch(`${api}/payments/webhook`, {
      ...utils.options,
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const body = await response.json()
    if (!response.ok) {
      return { error: body?.error ?? 'Failed to log payment' }
    }
    return body?.data ?? body
  } catch (error) {
    return { error: error.message }
  }
}

/**
 * Generate Certificate — Create KCB certificate for artwork
 * @param {Object} payload - { artwork_id, artist_name, artwork_title, dimensions?, medium?, year? }
 */
export async function generateCertificate(payload) {
  try {
    const response = await fetch(`${api}/certificates/generate`, {
      ...utils.options,
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const body = await response.json()
    if (!response.ok) {
      return { error: body?.error ?? 'Failed to generate certificate' }
    }
    return body?.data ?? body
  } catch (error) {
    return { error: error.message }
  }
}

/**
 * Submit Comment/Review — Add comment to artwork
 * @param {string} artworkId - Artwork ID
 * @param {Object} payload - { text, rating? (1-5) }
 */
export async function submitArtworkComment(artworkId, payload) {
  try {
    const response = await fetch(`${api}/comments/artwork/${artworkId}`, {
      ...utils.options,
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const body = await response.json()
    if (!response.ok) {
      return { error: body?.error ?? 'Failed to submit comment' }
    }
    return body?.data ?? body
  } catch (error) {
    return { error: error.message }
  }
}

/**
 * Report Error — Submit error report to admin
 * @param {Object} payload - { error_type, error_message, page_url?, user_agent?, additional_context? }
 */
export async function reportError(payload) {
  try {
    const response = await fetch(`${api}/errors/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'kcb-api-key': import.meta.env.VITE_API_KEY,
      },
      body: JSON.stringify(payload),
    })
    const body = await response.json()
    if (!response.ok) {
      return { error: body?.error ?? 'Failed to report error' }
    }
    return body?.data ?? body
  } catch (error) {
    return { error: error.message }
  }
}

/**
 * Hook: useSourcingInquiry
 * Submit sourcing inquiry for B2B partnerships
 */
export function useSourcingInquiry() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (organization, purpose, budget, message) => {
    setLoading(true)
    setError(null)
    try {
      const result = await submitSourcingInquiry({ organization, purpose, budget, message })
      if (result.error) {
        setError(result.error)
        return { error: result.error }
      }
      return { success: true, data: result }
    } catch (err) {
      setError(err.message)
      return { error: err.message }
    } finally {
      setLoading(false)
    }
  }

  return { submit, loading, error }
}

/**
 * Hook: useDeliveryRequest
 * Create logistics booking request
 */
export function useDeliveryRequest() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (artwork_ids, destination_country, delivery_type, special_instructions) => {
    setLoading(true)
    setError(null)
    try {
      const result = await submitDeliveryRequest({
        artwork_ids,
        destination_country,
        delivery_type,
        special_instructions,
      })
      if (result.error) {
        setError(result.error)
        return { error: result.error }
      }
      return { success: true, data: result }
    } catch (err) {
      setError(err.message)
      return { error: err.message }
    } finally {
      setLoading(false)
    }
  }

  return { submit, loading, error }
}

/**
 * Hook: useCertificate
 * Generate KCB certificate for artwork
 */
export function useCertificate() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const generate = async (artwork_id, artist_name, artwork_title, dimensions, medium, year) => {
    setLoading(true)
    setError(null)
    try {
      const result = await generateCertificate({
        artwork_id,
        artist_name,
        artwork_title,
        dimensions,
        medium,
        year,
      })
      if (result.error) {
        setError(result.error)
        return { error: result.error }
      }
      return { success: true, data: result }
    } catch (err) {
      setError(err.message)
      return { error: err.message }
    } finally {
      setLoading(false)
    }
  }

  return { generate, loading, error }
}

/**
 * Hook: useArtworkComment
 * Submit review/comment for artwork
 */
export function useArtworkComment() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (artworkId, text, rating) => {
    setLoading(true)
    setError(null)
    try {
      const result = await submitArtworkComment(artworkId, { text, rating })
      if (result.error) {
        setError(result.error)
        return { error: result.error }
      }
      return { success: true, data: result }
    } catch (err) {
      setError(err.message)
      return { error: err.message }
    } finally {
      setLoading(false)
    }
  }

  return { submit, loading, error }
}

/**
 * Hook: useErrorReporter
 * Report application errors to admin
 */
export function useErrorReporter() {
  const [loading, setLoading] = useState(false)

  const report = async (error_type, error_message, page_url, additional_context) => {
    setLoading(true)
    try {
      const result = await reportError({
        error_type,
        error_message,
        page_url: page_url || window.location.href,
        user_agent: navigator.userAgent,
        additional_context,
      })
      return { success: !result.error }
    } catch (err) {
      console.error('Failed to report error:', err)
      return { success: false }
    } finally {
      setLoading(false)
    }
  }

  return { report, loading }
}
