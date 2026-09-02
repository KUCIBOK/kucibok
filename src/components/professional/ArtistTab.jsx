import { useArtist } from '../../api/useArtistContextQuery'
import { ArtistTable } from '../artists/ArtistTable'

export function ArtistTab() {
  const { myArtists } = useArtist()
  return (
    <>
      <div className="rounded-[4px] border bg-kcb-ardoise shadow-sm p-6">
        <div className="my-4 overflow-auto">
          <ArtistTable artists={myArtists} />
        </div>
      </div>
    </>
  )
}
