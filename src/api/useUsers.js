import { utils } from './useAPI'
const { api } = utils

export async function getAllUsers() {
  try {
    // Use /api/admin/users-list to bypass RLS (requires admin auth)
    const response = await fetch(`${api}/admin/users-list`, { ...utils.options })
    const json = await response.json()
    const users = json?.users ?? json?.data ?? json
    if (users?.length > 0) {
      return users
    }
    return {
      error: json?.error || json?.message,
    }
  } catch (error) {
    return {
      error: error.message,
    }
  }
}

export async function createUser(payload) {
  try {
    const response = await fetch(`${api}/auth`, {
      ...utils.options,
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const body = await response.json()
    const user = body?.data ?? body
    if (user?.id || user?._id) {
      return user
    }
    return {
      error: body?.message || body?.error,
    }
  } catch (error) {
    return {
      error: error.message,
    }
  }
}

export async function updateUser(id, payload) {
  try {
    const response = await fetch(`${api}/auth/${id}`, {
      ...utils.options,
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    const body = await response.json()
    const user = body?.data ?? body
    if (user?.role || user?.id || user?._id) {
      return user
    }
    return {
      error: body?.message || body?.error,
    }
  } catch (error) {
    return {
      error: error.message,
    }
  }
}

export async function deleteUser(id) {
  try {
    const response = await fetch(`${api}/auth/${id}`, {
      ...utils.options,
      method: 'DELETE',
    })
    const body = await response.json()
    const user = body?.data ?? body
    if (user?.id || user?._id) {
      return user
    }
    return {
      error: body?.message || body?.error,
    }
  } catch (error) {
    return {
      error: error.message,
    }
  }
}

export async function setUserStatus(id) {
  try {
    const response = await fetch(`${api}/auth/status/${id}`, { ...utils.options })
    const body = await response.json()
    const user = body?.data ?? body
    if (user?.id || user?._id) {
      return user
    }
    return {
      error: body?.error || body?.message,
    }
  } catch (error) {
    return {
      error: error.message,
    }
  }
}

export async function exportExcelData() {
  try {
    const response = await fetch(`${api}/auth/export/excel`, {
      ...utils.options,
      method: 'GET',
    })
    if (!response.ok) throw new Error('Erreur lors du téléchargement')
    const blob = await response.blob()
    if (blob) {
      return blob
    }
  } catch (error) {
    return {
      error: error.message,
    }
  }
}
