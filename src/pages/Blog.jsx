import { Helmet } from 'react-helmet'
import { useEffect } from 'react'
import { BlogPostsList } from '../components/blog/BlogPostsList'
import { useBlogPosts } from '../api/useBlogQuery' /* ✨ React Query */
import RevealOnScroll from '../components/landing/RevealOnScroll'
import SectionLabel from '../components/landing/SectionLabel'

function BlogSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[4px] border border-white/[0.06] bg-kcb-ardoise/40 overflow-hidden animate-pulse"
        >
          <div className="h-48 bg-white/[0.06]" />
          <div className="p-4 space-y-2">
            <div className="h-4 bg-white/[0.06] rounded w-3/4" />
            <div className="h-3 bg-white/[0.06] rounded w-1/2" />
            <div className="h-3 bg-white/[0.06] rounded w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Blog() {
  const { data: blogPosts = [], isLoading: loading } = useBlogPosts() /* ✨ React Query */
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <>
      <Helmet>
        <title>Blog — Kucibok | Art africain, certification et marché</title>
        <meta
          name="description"
          content="Actualités, analyses et perspectives sur le marché de l'art africain, la certification des œuvres et la valorisation des artistes africains contemporains."
        />
        <meta property="og:title" content="Blog Kucibok — Art africain et certification" />
        <meta
          property="og:description"
          content="Actualités et analyses sur le marché de l'art africain, la traçabilité et la valorisation des œuvres."
        />
        <meta property="og:url" content="https://kucibok.com/blog" />
        <link rel="canonical" href="https://kucibok.com/blog" />
      </Helmet>
      <div className="min-h-screen bg-kcb-noir-deep pb-16">
        <section className="py-8 md:py-14">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <RevealOnScroll>
              <SectionLabel text="Blog" />
            </RevealOnScroll>
            <RevealOnScroll delay={0.1}>
              <h1 className="font-playfair font-bold text-[clamp(28px,3.5vw,48px)] text-white mt-4 mb-3">
                Notre Blog
              </h1>
            </RevealOnScroll>
            <RevealOnScroll delay={0.2}>
              <p className="text-kcb-pierre text-[15px] max-w-2xl mx-auto">
                Aperçus, histoires et mises à jour du monde de l'art numérique africain
              </p>
            </RevealOnScroll>
          </div>
        </section>
        <div className="max-w-6xl mx-auto px-4">
          <RevealOnScroll delay={0.25}>
            {loading ? (
              <BlogSkeleton />
            ) : blogPosts?.length >= 1 ? (
              <BlogPostsList blogPosts={[...blogPosts].reverse()} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 border border-white/[0.06] border-dashed rounded-[4px] w-full bg-kcb-ardoise/30">
                <h3 className="font-medium text-base text-kcb-pierre mb-1">
                  Aucun article pour le moment.
                </h3>
                <p className="text-xs text-kcb-pierre/60">
                  Revenez bientôt pour découvrir nos dernières histoires.
                </p>
              </div>
            )}
          </RevealOnScroll>
        </div>
      </div>
    </>
  )
}
