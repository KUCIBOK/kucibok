/**
 * Budget Tracking API
 * Handles CRUD operations for budget records, lines, and transactions
 * Protected by JWT auth + RLS (Supabase)
 */

import { supabaseAdmin } from './_lib/supabase.js'
import { checkAuth, respondError, respondJSON } from './_lib/response.js'

/**
 * POST /api/budgets/create
 * Create a new budget record with initial budget lines
 * Body: { totalAmount, currency, lines: [ { category, allocated, notes } ] }
 */
async function handleCreateBudget(req, userId) {
  const { totalAmount, currency, lines } = req.body

  // Validation
  if (!totalAmount || totalAmount <= 0) {
    return respondError(400, 'totalAmount must be > 0')
  }
  if (!['EUR', 'GBP', 'USD', 'XOF'].includes(currency)) {
    return respondError(400, 'Invalid currency')
  }
  if (!Array.isArray(lines)) {
    return respondError(400, 'lines must be an array')
  }

  try {
    // Insert budget record
    const { data: budgetRecord, error: budgetError } = await supabaseAdmin
      .from('budget_records')
      .insert([
        {
          user_id: userId,
          total_amount: parseFloat(totalAmount),
          currency,
          status: 'active',
        },
      ])
      .select()
      .single()

    if (budgetError || !budgetRecord) {
      return respondError(500, `Failed to create budget: ${budgetError?.message}`)
    }

    // Insert budget lines if provided
    if (lines.length > 0) {
      const linesToInsert = lines.map((line) => ({
        budget_id: budgetRecord.id,
        category: line.category,
        allocated: parseFloat(line.allocated) || 0,
        spent: 0,
        notes: line.notes || '',
      }))

      const { error: linesError } = await supabaseAdmin
        .from('budget_lines')
        .insert(linesToInsert)

      if (linesError) {
        console.error('Failed to insert budget lines:', linesError)
        // Budget created but lines failed — still return success with partial data
      }
    }

    return respondJSON(200, { data: budgetRecord })
  } catch (err) {
    console.error('handleCreateBudget error:', err)
    return respondError(500, err.message)
  }
}

/**
 * GET /api/budgets/list
 * Get all budgets for the authenticated user
 * Query: ?status=active&limit=10
 */
async function handleGetBudgets(req, userId) {
  const url = new URL(req.url, 'http://localhost')
  const status = url.searchParams.get('status') || 'active'
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 10, 50)

  try {
    let query = supabaseAdmin
      .from('budget_records')
      .select(`
        id,
        total_amount,
        currency,
        spent,
        allocated,
        status,
        notes,
        created_at,
        updated_at,
        budget_lines (
          id,
          category,
          allocated,
          spent,
          notes,
          updated_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    query = query.limit(limit)

    const { data, error } = await query

    if (error) {
      return respondError(500, error.message)
    }

    return respondJSON(200, { data })
  } catch (err) {
    console.error('handleGetBudgets error:', err)
    return respondError(500, err.message)
  }
}

/**
 * GET /api/budgets/:id
 * Get a single budget with all details
 */
async function handleGetBudget(req, userId, budgetId) {
  if (!budgetId) {
    return respondError(400, 'budgetId required')
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('budget_records')
      .select(`
        id,
        total_amount,
        currency,
        spent,
        allocated,
        status,
        notes,
        created_at,
        updated_at,
        budget_lines (
          id,
          category,
          allocated,
          spent,
          notes,
          updated_at
        ),
        budget_transactions (
          id,
          description,
          amount,
          transaction_date,
          category,
          notes,
          created_at
        )
      `)
      .eq('id', budgetId)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return respondError(404, 'Budget not found')
    }

    return respondJSON(200, { data })
  } catch (err) {
    console.error('handleGetBudget error:', err)
    return respondError(500, err.message)
  }
}

/**
 * PUT /api/budgets/:id
 * Update budget record
 * Body: { totalAmount?, currency?, status?, notes? }
 */
async function handleUpdateBudget(req, userId, budgetId) {
  const { totalAmount, currency, status, notes } = req.body

  if (!budgetId) {
    return respondError(400, 'budgetId required')
  }

  // Build update object
  const updates = {}
  if (totalAmount !== undefined && totalAmount > 0) updates.total_amount = parseFloat(totalAmount)
  if (currency && ['EUR', 'GBP', 'USD', 'XOF'].includes(currency)) updates.currency = currency
  if (status && ['active', 'closed', 'archived'].includes(status)) updates.status = status
  if (notes !== undefined) updates.notes = notes

  if (Object.keys(updates).length === 0) {
    return respondError(400, 'No valid fields to update')
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('budget_records')
      .update(updates)
      .eq('id', budgetId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error || !data) {
      return respondError(404, 'Budget not found or update failed')
    }

    return respondJSON(200, { data })
  } catch (err) {
    console.error('handleUpdateBudget error:', err)
    return respondError(500, err.message)
  }
}

/**
 * DELETE /api/budgets/:id
 * Delete a budget (and all associated lines/transactions via CASCADE)
 */
async function handleDeleteBudget(req, userId, budgetId) {
  if (!budgetId) {
    return respondError(400, 'budgetId required')
  }

  try {
    const { error } = await supabaseAdmin
      .from('budget_records')
      .delete()
      .eq('id', budgetId)
      .eq('user_id', userId)

    if (error) {
      return respondError(500, error.message)
    }

    return respondJSON(200, { message: 'Budget deleted' })
  } catch (err) {
    console.error('handleDeleteBudget error:', err)
    return respondError(500, err.message)
  }
}

/**
 * POST /api/budgets/:id/lines
 * Add a budget line to an existing budget
 * Body: { category, allocated, notes? }
 */
async function handleAddBudgetLine(req, userId, budgetId) {
  const { category, allocated, notes } = req.body

  if (!budgetId) {
    return respondError(400, 'budgetId required')
  }
  if (!category || !allocated || allocated <= 0) {
    return respondError(400, 'category and allocated (>0) required')
  }

  try {
    // Verify budget belongs to user
    const { data: budget } = await supabaseAdmin
      .from('budget_records')
      .select('id')
      .eq('id', budgetId)
      .eq('user_id', userId)
      .single()

    if (!budget) {
      return respondError(404, 'Budget not found')
    }

    // Insert line
    const { data, error } = await supabaseAdmin
      .from('budget_lines')
      .insert([
        {
          budget_id: budgetId,
          category,
          allocated: parseFloat(allocated),
          spent: 0,
          notes: notes || '',
        },
      ])
      .select()
      .single()

    if (error) {
      return respondError(500, error.message)
    }

    return respondJSON(200, { data })
  } catch (err) {
    console.error('handleAddBudgetLine error:', err)
    return respondError(500, err.message)
  }
}

/**
 * PUT /api/budgets/:id/lines/:lineId
 * Update a budget line
 * Body: { category?, allocated?, spent?, notes? }
 */
async function handleUpdateBudgetLine(req, userId, budgetId, lineId) {
  const { category, allocated, spent, notes } = req.body

  if (!budgetId || !lineId) {
    return respondError(400, 'budgetId and lineId required')
  }

  const updates = {}
  if (category) updates.category = category
  if (allocated !== undefined && allocated >= 0) updates.allocated = parseFloat(allocated)
  if (spent !== undefined && spent >= 0) updates.spent = parseFloat(spent)
  if (notes !== undefined) updates.notes = notes

  if (Object.keys(updates).length === 0) {
    return respondError(400, 'No valid fields to update')
  }

  try {
    // Verify line belongs to user's budget
    const { data: line, error: lineError } = await supabaseAdmin
      .from('budget_lines')
      .select('budget_id')
      .eq('id', lineId)
      .single()

    if (!line || line.budget_id !== budgetId) {
      return respondError(404, 'Budget line not found')
    }

    // Verify budget belongs to user
    const { data: budget } = await supabaseAdmin
      .from('budget_records')
      .select('id')
      .eq('id', budgetId)
      .eq('user_id', userId)
      .single()

    if (!budget) {
      return respondError(404, 'Budget not found')
    }

    // Update line
    const { data, error } = await supabaseAdmin
      .from('budget_lines')
      .update(updates)
      .eq('id', lineId)
      .select()
      .single()

    if (error) {
      return respondError(500, error.message)
    }

    return respondJSON(200, { data })
  } catch (err) {
    console.error('handleUpdateBudgetLine error:', err)
    return respondError(500, err.message)
  }
}

/**
 * DELETE /api/budgets/:id/lines/:lineId
 */
async function handleDeleteBudgetLine(req, userId, budgetId, lineId) {
  if (!budgetId || !lineId) {
    return respondError(400, 'budgetId and lineId required')
  }

  try {
    // Verify budget belongs to user
    const { data: budget } = await supabaseAdmin
      .from('budget_records')
      .select('id')
      .eq('id', budgetId)
      .eq('user_id', userId)
      .single()

    if (!budget) {
      return respondError(404, 'Budget not found')
    }

    const { error } = await supabaseAdmin
      .from('budget_lines')
      .delete()
      .eq('id', lineId)
      .eq('budget_id', budgetId)

    if (error) {
      return respondError(500, error.message)
    }

    return respondJSON(200, { message: 'Line deleted' })
  } catch (err) {
    console.error('handleDeleteBudgetLine error:', err)
    return respondError(500, err.message)
  }
}

/**
 * POST /api/budgets/:id/transactions
 * Add a transaction to budget
 * Body: { description, amount, transactionDate, category?, notes? }
 */
async function handleAddTransaction(req, userId, budgetId) {
  const { description, amount, transactionDate, category, notes } = req.body

  if (!budgetId || !description || !amount || !transactionDate) {
    return respondError(400, 'description, amount, transactionDate required')
  }

  try {
    // Verify budget belongs to user
    const { data: budget } = await supabaseAdmin
      .from('budget_records')
      .select('id')
      .eq('id', budgetId)
      .eq('user_id', userId)
      .single()

    if (!budget) {
      return respondError(404, 'Budget not found')
    }

    const { data, error } = await supabaseAdmin
      .from('budget_transactions')
      .insert([
        {
          budget_id: budgetId,
          description,
          amount: parseFloat(amount),
          transaction_date: transactionDate,
          category: category || null,
          notes: notes || '',
        },
      ])
      .select()
      .single()

    if (error) {
      return respondError(500, error.message)
    }

    return respondJSON(200, { data })
  } catch (err) {
    console.error('handleAddTransaction error:', err)
    return respondError(500, err.message)
  }
}

/**
 * Route dispatcher
 */
export default async function handler(req, res) {
  const auth = await checkAuth(req)
  if (auth.error) return respondError(auth.status, auth.error)(res)

  const userId = auth.userId
  const pathname = new URL(req.url, 'http://localhost').pathname
  const segments = pathname.split('/').filter(Boolean)

  // /api/budgets/create
  if (segments[1] === 'budgets' && segments[2] === 'create' && req.method === 'POST') {
    return handleCreateBudget(req, userId)(res)
  }

  // /api/budgets/list
  if (segments[1] === 'budgets' && segments[2] === 'list' && req.method === 'GET') {
    return handleGetBudgets(req, userId)(res)
  }

  // /api/budgets/:id
  const budgetId = segments[2]
  if (segments[1] === 'budgets' && budgetId && !segments[3]) {
    if (req.method === 'GET') return handleGetBudget(req, userId, budgetId)(res)
    if (req.method === 'PUT') return handleUpdateBudget(req, userId, budgetId)(res)
    if (req.method === 'DELETE') return handleDeleteBudget(req, userId, budgetId)(res)
  }

  // /api/budgets/:id/lines
  const lineId = segments[4]
  if (segments[1] === 'budgets' && budgetId && segments[3] === 'lines') {
    if (req.method === 'POST' && !lineId)
      return handleAddBudgetLine(req, userId, budgetId)(res)
    if (req.method === 'PUT' && lineId)
      return handleUpdateBudgetLine(req, userId, budgetId, lineId)(res)
    if (req.method === 'DELETE' && lineId)
      return handleDeleteBudgetLine(req, userId, budgetId, lineId)(res)
  }

  // /api/budgets/:id/transactions
  if (segments[1] === 'budgets' && budgetId && segments[3] === 'transactions') {
    if (req.method === 'POST') return handleAddTransaction(req, userId, budgetId)(res)
  }

  return respondError(404, 'Route not found')(res)
}
