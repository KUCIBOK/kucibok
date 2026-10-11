/**
 * Concierge Service API
 * Handles service listings, booking management, and payment workflows
 * Protected by JWT auth + RLS (Supabase)
 */

import { supabaseAdmin } from './_lib/supabase.js'
import { checkAuth, respondError, respondJSON } from './_lib/response.js'

/**
 * GET /api/concierge/services
 * List all active concierge services
 */
async function handleGetServices(req) {
  try {
    const { data, error } = await supabaseAdmin
      .from('concierge_services')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      return respondError(500, error.message)
    }

    return respondJSON(200, { data })
  } catch (err) {
    console.error('handleGetServices error:', err)
    return respondError(500, err.message)
  }
}

/**
 * GET /api/concierge/services/:serviceId
 * Get a single service with details
 */
async function handleGetService(req, serviceId) {
  if (!serviceId) {
    return respondError(400, 'serviceId required')
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('concierge_services')
      .select('*')
      .eq('id', serviceId)
      .single()

    if (error || !data) {
      return respondError(404, 'Service not found')
    }

    return respondJSON(200, { data })
  } catch (err) {
    console.error('handleGetService error:', err)
    return respondError(500, err.message)
  }
}

/**
 * POST /api/concierge/bookings
 * Create a new booking request
 * Body: { serviceId, requestedStartDate, requestedEndDate?, notes? }
 */
async function handleCreateBooking(req, userId) {
  const { serviceId, requestedStartDate, requestedEndDate, notes } = req.body

  if (!serviceId || !requestedStartDate) {
    return respondError(400, 'serviceId and requestedStartDate required')
  }

  try {
    // Get service details
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('concierge_services')
      .select('*')
      .eq('id', serviceId)
      .eq('is_active', true)
      .single()

    if (serviceError || !service) {
      return respondError(404, 'Service not found')
    }

    // Create booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('concierge_bookings')
      .insert([
        {
          user_id: userId,
          service_id: serviceId,
          requested_start_date: requestedStartDate,
          requested_end_date: requestedEndDate || requestedStartDate,
          notes: notes || '',
          amount: service.price,
          currency: service.currency,
          status: 'pending',
          payment_status: 'pending',
        },
      ])
      .select()
      .single()

    if (bookingError) {
      return respondError(500, `Failed to create booking: ${bookingError.message}`)
    }

    // Log to history
    await supabaseAdmin
      .from('concierge_history')
      .insert([
        {
          booking_id: booking.id,
          event_type: 'created',
          new_status: 'pending',
          changed_by_user_id: userId,
        },
      ])
      .catch(() => {}) // Non-critical

    return respondJSON(200, { data: booking })
  } catch (err) {
    console.error('handleCreateBooking error:', err)
    return respondError(500, err.message)
  }
}

/**
 * GET /api/concierge/bookings
 * Get all bookings for the authenticated user
 * Query: ?status=pending&limit=10
 */
async function handleGetBookings(req, userId) {
  const url = new URL(req.url, 'http://localhost')
  const status = url.searchParams.get('status')
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 10, 50)

  try {
    let query = supabaseAdmin
      .from('concierge_bookings')
      .select(`
        *,
        concierge_services (
          name,
          description,
          icon_name,
          duration,
          price,
          currency,
          deliverables
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    query = query.limit(limit)

    const { data, error } = await query

    if (error) {
      return respondError(500, error.message)
    }

    return respondJSON(200, { data })
  } catch (err) {
    console.error('handleGetBookings error:', err)
    return respondError(500, err.message)
  }
}

/**
 * GET /api/concierge/bookings/:bookingId
 * Get a single booking with full details
 */
async function handleGetBooking(req, userId, bookingId) {
  if (!bookingId) {
    return respondError(400, 'bookingId required')
  }

  try {
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('concierge_bookings')
      .select(`
        *,
        concierge_services (
          name,
          description,
          icon_name,
          duration,
          price,
          currency,
          deliverables,
          turnaround_days
        )
      `)
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single()

    if (bookingError || !booking) {
      return respondError(404, 'Booking not found')
    }

    // Get history
    const { data: history } = await supabaseAdmin
      .from('concierge_history')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true })

    return respondJSON(200, { data: { ...booking, history } })
  } catch (err) {
    console.error('handleGetBooking error:', err)
    return respondError(500, err.message)
  }
}

/**
 * PUT /api/concierge/bookings/:bookingId
 * Update a booking (status, notes, etc.)
 * Body: { status?, notes?, requestedStartDate? }
 * Only user or admin can update
 */
async function handleUpdateBooking(req, userId, bookingId) {
  const { status, notes, requestedStartDate } = req.body

  if (!bookingId) {
    return respondError(400, 'bookingId required')
  }

  // Get current booking
  const { data: currentBooking, error: fetchError } = await supabaseAdmin
    .from('concierge_bookings')
    .select('*')
    .eq('id', bookingId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !currentBooking) {
    return respondError(404, 'Booking not found')
  }

  const updates = {}
  if (status && status !== currentBooking.status) updates.status = status
  if (notes !== undefined) updates.notes = notes
  if (requestedStartDate) updates.requested_start_date = requestedStartDate

  if (Object.keys(updates).length === 0) {
    return respondError(400, 'No valid fields to update')
  }

  try {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('concierge_bookings')
      .update(updates)
      .eq('id', bookingId)
      .select()
      .single()

    if (updateError) {
      return respondError(500, updateError.message)
    }

    // Log status change
    if (status && status !== currentBooking.status) {
      await supabaseAdmin
        .from('concierge_history')
        .insert([
          {
            booking_id: bookingId,
            event_type: 'status_changed',
            old_status: currentBooking.status,
            new_status: status,
            changed_by_user_id: userId,
          },
        ])
        .catch(() => {})
    }

    return respondJSON(200, { data: updated })
  } catch (err) {
    console.error('handleUpdateBooking error:', err)
    return respondError(500, err.message)
  }
}

/**
 * DELETE /api/concierge/bookings/:bookingId
 * Cancel a booking (soft delete by setting status to 'cancelled')
 */
async function handleCancelBooking(req, userId, bookingId) {
  if (!bookingId) {
    return respondError(400, 'bookingId required')
  }

  try {
    const { data: booking } = await supabaseAdmin
      .from('concierge_bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single()

    if (!booking) {
      return respondError(404, 'Booking not found')
    }

    // Update status to cancelled
    const { data: cancelled, error } = await supabaseAdmin
      .from('concierge_bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .select()
      .single()

    if (error) {
      return respondError(500, error.message)
    }

    // Log cancellation
    await supabaseAdmin
      .from('concierge_history')
      .insert([
        {
          booking_id: bookingId,
          event_type: 'cancelled',
          old_status: booking.status,
          new_status: 'cancelled',
          changed_by_user_id: userId,
        },
      ])
      .catch(() => {})

    return respondJSON(200, { data: cancelled })
  } catch (err) {
    console.error('handleCancelBooking error:', err)
    return respondError(500, err.message)
  }
}

/**
 * POST /api/concierge/bookings/:bookingId/confirm-payment
 * Mark payment as completed (simplified for now, no real payment processing)
 */
async function handleConfirmPayment(req, userId, bookingId) {
  if (!bookingId) {
    return respondError(400, 'bookingId required')
  }

  try {
    const { data: booking } = await supabaseAdmin
      .from('concierge_bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single()

    if (!booking) {
      return respondError(404, 'Booking not found')
    }

    // Update payment status and booking status
    const { data: updated, error } = await supabaseAdmin
      .from('concierge_bookings')
      .update({
        payment_status: 'completed',
        status: 'confirmed',
      })
      .eq('id', bookingId)
      .select()
      .single()

    if (error) {
      return respondError(500, error.message)
    }

    return respondJSON(200, { data: updated })
  } catch (err) {
    console.error('handleConfirmPayment error:', err)
    return respondError(500, err.message)
  }
}

/**
 * Route dispatcher
 */
export default async function handler(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname
  const segments = pathname.split('/').filter(Boolean)

  // GET /api/concierge/services (public)
  if (segments[1] === 'concierge' && segments[2] === 'services' && !segments[3] && req.method === 'GET') {
    return handleGetServices(req)(res)
  }

  // GET /api/concierge/services/:serviceId (public)
  if (segments[1] === 'concierge' && segments[2] === 'services' && segments[3] && !segments[4] && req.method === 'GET') {
    return handleGetService(req, segments[3])(res)
  }

  // Protected routes below
  const auth = await checkAuth(req)
  if (auth.error) return respondError(auth.status, auth.error)(res)

  const userId = auth.userId
  const bookingId = segments[3]

  // POST /api/concierge/bookings
  if (segments[1] === 'concierge' && segments[2] === 'bookings' && !segments[3] && req.method === 'POST') {
    return handleCreateBooking(req, userId)(res)
  }

  // GET /api/concierge/bookings
  if (segments[1] === 'concierge' && segments[2] === 'bookings' && !segments[3] && req.method === 'GET') {
    return handleGetBookings(req, userId)(res)
  }

  // GET /api/concierge/bookings/:bookingId
  if (segments[1] === 'concierge' && segments[2] === 'bookings' && bookingId && !segments[4] && req.method === 'GET') {
    return handleGetBooking(req, userId, bookingId)(res)
  }

  // PUT /api/concierge/bookings/:bookingId
  if (segments[1] === 'concierge' && segments[2] === 'bookings' && bookingId && !segments[4] && req.method === 'PUT') {
    return handleUpdateBooking(req, userId, bookingId)(res)
  }

  // DELETE /api/concierge/bookings/:bookingId
  if (segments[1] === 'concierge' && segments[2] === 'bookings' && bookingId && !segments[4] && req.method === 'DELETE') {
    return handleCancelBooking(req, userId, bookingId)(res)
  }

  // POST /api/concierge/bookings/:bookingId/confirm-payment
  if (segments[1] === 'concierge' && segments[2] === 'bookings' && bookingId && segments[4] === 'confirm-payment' && req.method === 'POST') {
    return handleConfirmPayment(req, userId, bookingId)(res)
  }

  return respondError(404, 'Route not found')(res)
}
