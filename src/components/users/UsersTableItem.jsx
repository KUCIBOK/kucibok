import { User } from 'lucide-react'
import { UserTableItemActions } from './UsersTableItemActions'

export function UsersTableItem({ user }) {
  const isActive = user?.isActive ?? user?.is_active ?? false

  return (
    <>
      <tr className="align-middle hover:bg-kcb-ardoise/60 transition">
        <td className="flex items-center gap-2 py-2">
          <span className="rounded-full bg-earth/20 p-1.5 flex items-center justify-center">
            <User className="w-4 h-4 text-earth" />
          </span>
          <span className="text-white/90 text-sm font-medium">{user?.name}</span>
        </td>
        <td className="text-white/70 text-sm align-middle">{user?.email}</td>
        <td className="text-white/60 text-xs align-middle">
          {user?.role == 'admin' && 'Administrateur'}
          {user?.role == 'artist' && 'Artiste'}
          {user?.role == 'buyer' && 'Acheteur'}
          {user?.role == 'curator' && 'Curateur'}
        </td>
        <td className="align-middle">
          {isActive ? (
            <span className="inline-block rounded-full bg-green-700/20 text-green-400 px-3 py-0.5 text-xs font-medium">
              Actif
            </span>
          ) : (
            <span className="inline-block rounded-full bg-red-700/20 text-red-400 px-3 py-0.5 text-xs font-medium">
              Suspendu
            </span>
          )}
        </td>
        <td className="text-white/60 text-xs align-middle">
          {user?.telephone || <span className="text-kcb-pierre">Non renseigné</span>}
        </td>
        <td className="text-white/60 text-xs align-middle">
          {new Date(user?.created_at).toLocaleDateString()}
        </td>
        <td className="align-middle">
          {user?.status === 'published' && (
            <span className="inline-block rounded-full bg-green-700/10 text-green-400 px-2 py-0.5 text-xs font-medium">
              Publié
            </span>
          )}
          {user?.status === 'archived' && (
            <span className="inline-block rounded-full bg-amber-700/10 text-amber-400 px-2 py-0.5 text-xs font-medium">
              Archivé
            </span>
          )}
        </td>
        <td className="align-middle">
          <UserTableItemActions user={user} />
        </td>
      </tr>
    </>
  )
}
