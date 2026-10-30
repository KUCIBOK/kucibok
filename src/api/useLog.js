import { utils } from './useAPI'
const { api } = utils

export async function createLog(payload) {
  try {
    const response = await fetch(`${api}/log`, {
      ...utils.options,
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const log = await response.json()
    if (log?._id) {
      return log
    }
    return {
      error: log?.error || log?.message,
    }
  } catch (error) {
    return {
      error: error.messag,
    }
  }
}

export async function getAllLog() {
  try {
    const response = await fetch(`${api}/log`, { ...utils.options })
    const logs = await response.json()
    if (Array.isArray(logs)) {
      return logs
    }
    return {
      error: logs.message || logs.error,
    }
  } catch (error) {
    return {
      error: error.message,
    }
  }
}
