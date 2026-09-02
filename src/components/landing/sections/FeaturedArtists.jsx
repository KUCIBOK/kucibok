import { useEffect, useState } from 'react'
import { Palette } from 'lucide-react'
import { useArtist } from '../../api/useArtistContextQuery'
import { ArtistList } from '../../artists/ArtistsList'

export default function FeaturedArtists() {
  const { artists } = useArtist()
  const artistsWithImage = artists?.filter(
    (item) =>
      item?.artworkCount >= 3 &&
      item?.image &&
      item?.image !=
        'https://t3.ftcdn.net/jpg/05/16/27/58/360_F_516275801_f3Fsp17x6HQK0xQgDQEELoTuERO4SsWV.jpg'
  )
  const [featuredArtists, setFeaturedArtists] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (artists.length > 0) {
      // Prend les 6 premiers artistes ou tous si moins de 6
      const featured = artistsWithImage.slice(0, 6)
      setFeaturedArtists(featured)
      setLoading(false)
    }
  }, [artists])

  return (
    <div className="py-16 bg-gradient-to-b from-[#020817] to-[#0f172a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center mb-4">
            <Palette className="w-8 h-8 text-[#7170c4] mr-2" />
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Artistes à découvrir</h2>
          </div>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Une sélection des talents émergents de la scène artistique africaine
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-800 rounded"></div>
                  <div className="h-4 bg-gray-800 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <ArtistList
              artists={featuredArtists}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
            />
            {artists.length > 6 && (
              <div className="text-center mt-12">
                <a
                  href="/artists"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-[4px] text-white bg-[#7170c4] hover:bg-[#5a5a9c] transition-colors"
                >
                  Voir tous les artistes
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
