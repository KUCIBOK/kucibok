import { utils } from './useAPI'
const { api } = utils

export async function addClient(payload) {
  try {
    const response = await fetch(`${api}/clients/add`, {
      ...utils.options,
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const client = await response.json()
    if (client?.client?._id) {
      return client.client
    }
    return {
      error: client?.message || client?.error || "Erreur lors de l'ajout du client",
    }
  } catch (error) {
    return {
      error: error.message,
    }
  }
}

export async function uploadClientsFromFile(file) {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${api}/clients/upload`, {
      method: 'POST',
      headers: {
        Authorization: utils.options.headers.Authorization,
        'kcb-api-key': utils.options.headers['kcb-api-key'],
      },
      body: formData,
    })

    const result = await response.json()
    if (response.ok) {
      return result
    }
    return {
      error: result?.message || result?.error || "Erreur lors de l'import",
    }
  } catch (error) {
    return {
      error: error.message,
    }
  }
}

export async function getAllClients() {
  try {
    // Use /api/admin/clients-list to bypass RLS (requires admin auth)
    const response = await fetch(`${api}/admin/clients-list`, {
      ...utils.options,
      method: 'GET',
    })

    const data = await response.json()
    if (response.ok) {
      return data.clients || data?.data?.clients || data
    }
    return {
      error: data?.message || data?.error || 'Erreur lors de la récupération',
    }
  } catch (error) {
    return {
      error: error.message,
    }
  }
}

export async function getClientsByArtist() {
  try {
    const response = await fetch(`${api}/clients/all`, {
      ...utils.options,
      method: 'GET',
    })

    const data = await response.json()
    if (response.ok) {
      return data.clients
    }
    return {
      error: data?.message || data?.error || 'Erreur lors de la récupération',
    }
  } catch (error) {
    return {
      error: error.message,
    }
  }
}

export async function updateClient(id, payload) {
  try {
    const response = await fetch(`${api}/clients/update/${id}`, {
      ...utils.options,
      method: 'PUT',
      body: JSON.stringify(payload),
    })

    const client = await response.json()
    if (client?.client?._id) {
      return client.client
    }
    return {
      error: client?.message || client?.error || 'Erreur lors de la mise à jour',
    }
  } catch (error) {
    return {
      error: error.message,
    }
  }
}

export async function deleteClient(id) {
  try {
    const response = await fetch(`${api}/clients/delete/${id}`, {
      ...utils.options,
      method: 'DELETE',
    })

    const result = await response.json()
    if (response.ok) {
      return result
    }
    return {
      error: result?.message || result?.error || 'Erreur lors de la suppression',
    }
  } catch (error) {
    return {
      error: error.message,
    }
  }
}
