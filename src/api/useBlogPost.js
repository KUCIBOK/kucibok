import { utils } from './useAPI'
const { api } = utils

function unwrapList(body) {
  const data = body?.data ?? body
  return Array.isArray(data) ? data : null
}

function unwrapItem(body) {
  const data = body?.data ?? body
  return data?.id || data?._id ? data : null
}

export async function createBlogPost(payload) {
  try {
    const { 'Content-Type': _ct, ...authHeaders } = utils.options.headers
    const response = await fetch(`${api}/blog`, {
      method: 'POST',
      headers: authHeaders,
      body: payload,
    })
    const body = await response.json()
    const post = unwrapItem(body)
    if (post) return post
    return { error: body?.error || body?.message }
  } catch (error) {
    return { error: error.message }
  }
}

export async function getBlogPosts() {
  try {
    const response = await fetch(`${api}/blog`, { ...utils.options })
    const body = await response.json()
    const posts = unwrapList(body)
    if (posts?.length >= 1) return posts
    return { error: body?.error || body?.message }
  } catch (error) {
    return { error: error.message }
  }
}

export async function getPublishedPosts() {
  try {
    const response = await fetch(`${api}/blog/published`, { ...utils.options })
    const body = await response.json()
    const posts = unwrapList(body)
    if (posts) return posts
    return { error: body?.error || body?.message }
  } catch (error) {
    return { error: error.message }
  }
}

export async function getArchivedPosts() {
  try {
    const response = await fetch(`${api}/blog/archived`, { ...utils.options })
    const body = await response.json()
    const posts = unwrapList(body)
    if (posts) return posts
    return { error: body?.error || body?.message }
  } catch (error) {
    return { error: error.message }
  }
}

export async function getPublishedPostsByUserId(id) {
  try {
    const response = await fetch(`${api}/blog/published/user${id}`, { ...utils.options })
    const body = await response.json()
    const posts = unwrapList(body)
    if (posts?.length >= 1) return posts
    return { error: body?.error || body?.message }
  } catch (error) {
    return { error: error.message }
  }
}

export async function getDraftPostsByUserId(id) {
  try {
    const response = await fetch(`${api}/blog/draft/user${id}`, { ...utils.options })
    const body = await response.json()
    const posts = unwrapList(body)
    if (posts?.length >= 1) return posts
    return { error: body?.error || body?.message }
  } catch (error) {
    return { error: error.message }
  }
}

export async function getArchivedPostsByUserId(id) {
  try {
    const response = await fetch(`${api}/blog/archived/user${id}`, { ...utils.options })
    const body = await response.json()
    const posts = unwrapList(body)
    if (posts?.length >= 1) return posts
    return { error: body?.error || body?.message }
  } catch (error) {
    return { error: error.message }
  }
}

export async function archivePost(id) {
  try {
    const response = await fetch(`${api}/blog/archive/${id}`, { ...utils.options, method: 'POST' })
    const body = await response.json()
    const post = unwrapItem(body)
    if (post) return post
    return { error: body?.error || body?.message }
  } catch (error) {
    return { error: error.message }
  }
}

export async function publishPost(id) {
  try {
    const response = await fetch(`${api}/blog/publish/${id}`, { ...utils.options, method: 'POST' })
    const body = await response.json()
    const post = unwrapItem(body)
    if (post) return post
    return { error: body?.error || body?.message }
  } catch (error) {
    return { error: error.message }
  }
}

export async function getBlogPost(id) {
  try {
    const response = await fetch(`${api}/blog/${id}`, { ...utils.options })
    const body = await response.json()
    const post = unwrapItem(body)
    if (post) return post
    return { error: body?.error || body?.message }
  } catch (error) {
    return { error: error.message }
  }
}

export async function updateBlogPost(id, payload) {
  try {
    const { 'Content-Type': _ct, ...authHeaders } = utils.options.headers
    const response = await fetch(`${api}/blog/${id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: payload,
    })
    const body = await response.json()
    const post = unwrapItem(body)
    if (post) return post
    return { error: body?.error || body?.message }
  } catch (error) {
    return { error: error.message }
  }
}

export async function addComment(id, payload) {
  try {
    const response = await fetch(`${api}/blog/comment/${id}`, {
      ...utils.options,
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const body = await response.json()
    const post = unwrapItem(body)
    if (post) return post
    return { error: body?.error || body?.message }
  } catch (error) {
    return { error: error.message }
  }
}
