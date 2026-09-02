import { AuctionsList } from '../auction/AuctionsList'
import { useMyArtworks } from '../../api/useAdminArtworksQuery' /* ✨ React Query */

export function AuctionTab() {
  const { data: myArtworks = [] } = useMyArtworks() /* ✨ React Query */
  return (
    <>
      <div className="rounded-[4px] border bg-kcb-ardoise shadow-sm p-6">
        <div className="my-4 overflow-auto">
          <AuctionsList artworks={myArtworks} />
        </div>
      </div>
    </>
  )
}
