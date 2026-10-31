import { utils } from './useAPI'
const { api } = utils
export async function createReview(payload) {
  try {
    const response = await fetch(`${api}/review`, {
      ...utils.options,
      method: 'POST',
      body: JSON.stringify({
        ...payload,
      }),
    })
    const review = await response.json()
    if (review?.id) {
      return review
    }
    return {
      error: review?.error || review?.message,
    }
  } catch (error) {
    return {
      error: error.message,
    }
  }
}

export async function getReviewsByArtworkId(id) {
  try {
    const response = await fetch(`${api}/review/artwork/${id}`, {
      ...utils.options,
    })
    const reviews = await response.json()
    if (Array.isArray(reviews)) {
      return reviews
    }
    return {
      error: reviews?.error || reviews?.message,
    }
  } catch (error) {
    return {
      error: error.message,
    }
  }
}
