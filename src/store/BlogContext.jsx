import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import {
  archivePost,
  createBlogPost,
  getArchivedPosts,
  getPublishedPosts,
  publishPost,
  updateBlogPost,
} from '../api/useBlogPost'
import { createLog } from '../api/useLog'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'

const initialState = {
  blogPosts: [],
  archive: [],
  loading: true,
}

const BlogContext = createContext(initialState)

export function BlogContextProvider({ children }) {
  const [state, setState] = useState(initialState)
  const { user } = useAuth()
  const { makeToast } = useToast()
  useEffect(() => {
    const getPosts = async () => {
      const posts = await getPublishedPosts()
      if (posts?.length >= 1) {
        setState((prev) => ({
          ...prev,
          blogPosts: posts,
        }))
      }
    }
    const getArchives = async () => {
      const posts = await getArchivedPosts()
      if (posts?.length >= 1) {
        setState((prev) => ({
          ...prev,
          archive: posts,
        }))
      }
    }
    Promise.allSettled([getPosts(), getArchives()]).finally(() => {
      setState((prev) => ({ ...prev, loading: false }))
    })
  }, [makeToast, user?._id])

  const addPost = useCallback(async (payload) => {
    try {
      const post = await createBlogPost(payload)
      if (post?._id) {
        setState((prev) => ({
          ...prev,
          blogPosts: [post, ...prev.blogPosts],
        }))
        makeToast('Succès', 'success', "L'article a été ajouté et publié avec succès")
        await createLog({
          description: `L'article ${post?._id} a été ajouté et publié`,
          userId: user?._id,
        })
        return post
      }
      return {
        error: post?.message || post?.error,
      }
    } catch (error) {
      return {
        error: error.message,
      }
    }
  }, [makeToast, user?._id])

  const publishPostCtx = useCallback(async (id) => {
    try {
      const post = await publishPost(id)
      if (post?._id) {
        setState((prev) => ({
          ...prev,
          blogPosts: [post, ...prev.blogPosts],
          archive: prev.archive?.filter((item) => item._id != post?._id),
        }))
        makeToast('Succès', 'success', "L'article a été publié avec succès")
        await createLog({
          description: `L'article ${post?._id} a été publié`,
          userId: user?._id,
        })
        return post
      }
      return {
        error: post?.message || post?.error,
      }
    } catch (error) {
      return {
        error: error.message,
      }
    }
  }, [makeToast, user?._id])

  const archivePostCtx = useCallback(async (id) => {
    try {
      const post = await archivePost(id)
      if (post?._id) {
        setState((prev) => ({
          ...prev,
          archive: [post, ...prev.archive],
          blogPosts: prev.blogPosts?.filter((item) => item._id != post?._id),
        }))
        makeToast('Succès', 'success', "L'article a été archivé avec succès")
        await createLog({
          description: `L'article ${post?._id} a été archivé`,
          userId: user?._id,
        })
        return post
      }
      makeToast('Erreur', 'warning', post?.error)
      return {
        error: post?.message || post?.error,
      }
    } catch (error) {
      return {
        error: error.message,
      }
    }
  }, [makeToast, user?._id])

  const updatePost = useCallback(async (id, payload) => {
    try {
      const post = await updateBlogPost(id, payload)
      if (!post?._id) return { error: post?.message || post?.error }
      if (post?.status == 'published') {
        setState((prev) => ({
          ...prev,
          blogPosts: [
            post,
            ...(prev.blogPosts ?? []).filter((item) => item._id != post?._id),
          ],
        }))
      }
      if (post?.status == 'archived') {
        setState((prev) => ({
          ...prev,
          archive: [post, ...(prev.archive ?? []).filter((item) => item._id != post?._id)],
        }))
      }
      makeToast('Succès', 'success', "L'article a été mis à jour avec succès")
      await createLog({
        description: `L'article ${post?._id} a été mis à jour`,
        userId: user?._id,
      })
      return post
    } catch (error) {
      return {
        error: error.message,
      }
    }
  }, [makeToast, user?._id])

  const value = useMemo(() => ({
    blogPosts: state.blogPosts,
    archive: state.archive,
    loading: state.loading,
    addPost,
    publishPost: publishPostCtx,
    archivePost: archivePostCtx,
    updatePost,
  }), [state, addPost, publishPostCtx, archivePostCtx, updatePost])

  return (
    <BlogContext.Provider value={value}>
      {children}
    </BlogContext.Provider>
  )
}

export function useBlog() {
  return useContext(BlogContext)
}
