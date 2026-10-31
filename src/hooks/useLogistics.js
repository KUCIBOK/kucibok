import { useState } from 'react'
import { utils } from '../api/useAPI'

const API_BASE_URL = `${utils.api}/logistics`

export function useLogistics() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Sync Kucibok deliveries with Logidoo
  const syncWithLogidoo = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/sync`, {
        method: 'POST',
        headers: utils.options.headers,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.message || 'Sync failed')
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Get tracking information
  const getTrackingInfo = async (trackingId) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/track/${trackingId}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.message || 'Failed to get tracking info')
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Get all Logidoo expeditions (admin only)
  const getLogidooExpeditions = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/expeditions`, {
        headers: utils.options.headers,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.message || 'Failed to get expeditions')
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Create new expedition
  const createExpedition = async (expeditionData) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/expeditions`, {
        method: 'POST',
        headers: utils.options.headers,
        body: JSON.stringify(expeditionData),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.message || 'Failed to create expedition')
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Get expedition by tracking number
  const getExpeditionByTracking = async (trackingNumber) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/expeditions/track/${trackingNumber}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.message || 'Failed to get expedition')
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Get shipping rates
  const getShippingRates = async (origin, destination, packageDetails) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/rates`, {
        method: 'POST',
        headers: utils.options.headers,
        body: JSON.stringify({ origin, destination, packageDetails }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.message || 'Failed to get rates')
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Get delivery zones
  const getDeliveryZones = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/zones`, {
        headers: utils.options.headers,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.message || 'Failed to get zones')
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Get pickup points
  const getPickupPoints = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/pickup-points`, {
        headers: utils.options.headers,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.message || 'Failed to get pickup points')
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Update delivery status from Logidoo
  const updateFromLogidoo = async (trackingId) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/update/${trackingId}`, {
        method: 'PUT',
        headers: utils.options.headers,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.message || 'Failed to update status')
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Cancel delivery
  const cancelDelivery = async (trackingId) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/cancel/${trackingId}`, {
        method: 'DELETE',
        headers: utils.options.headers,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.message || 'Failed to cancel delivery')
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    error,
    syncWithLogidoo,
    getTrackingInfo,
    getLogidooExpeditions,
    createExpedition,
    getExpeditionByTracking,
    getShippingRates,
    getDeliveryZones,
    getPickupPoints,
    updateFromLogidoo,
    cancelDelivery,
  }
}
