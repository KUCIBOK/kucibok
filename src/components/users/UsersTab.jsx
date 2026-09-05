import { Hammer, Image, Plus, Shield, User, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useUsersContext } from '../../store/UsersStore'
import { UsersTable } from './UsersTable'
import { useAuth } from '../../store/AuthContext'
import { getAllVisitors } from '../../api/useVisitor'
import { Modal, Input, Select, Button, toast } from '../ui'

export function UsersTab() {
  const { artists, buyers, curators, users, loading } = useUsersContext()
  const { user } = useAuth()
  const [state, setState] = useState({
    addUser: false,
    visitor: [],
    visitorsThisMonth: [],
  })
  useEffect(() => {
    const fetchVisitors = async () => {
      const visitors = await getAllVisitors()
      if (visitors?.length > 0) {
        setState((prev) => ({
          ...prev,
          visitor: visitors,
          visitorsThisMonth: visitors.filter(
            (visitor) => new Date(visitor.created_at).getMonth() === new Date().getMonth()
          ),
        }))
      }
    }
    fetchVisitors()
  }, [])

  return (
    <>
      <div className="rounded-[4px] bg-kcb-ardoise shadow-none">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-semibold text-white/90">Gestion des utilisateurs</h2>
          <button
            onClick={() => setState({ ...state, addUser: true })}
            className="rounded-[4px] bg-kcb-or hover:bg-kcb-bronze text-kcb-noir text-white text-xs font-medium py-2 px-3 flex items-center gap-2 transition shadow-none border-none"
          >
            <Plus className="w-4 h-4 text-white" />
            Ajouter un admin
          </button>
        </div>
        <div className="flex md:flex-row flex-col gap-4 w-full">
          <div className="w-full rounded-[4px] p-4 bg-kcb-noir/80 text-sm flex flex-col gap-1">
            <div className="flex justify-between items-center text-white/70 text-xs">
              <span>Utilisateurs totaux</span>
              <Users className="w-4 h-4 text-kcb-pierre" />
            </div>
            <span className="text-xl font-bold text-white mt-1 tabular-nums">
              {loading ? '—' : users?.length ?? 0}
            </span>
          </div>
          <div className="w-full rounded-[4px] p-4 bg-kcb-noir/80 text-sm flex flex-col gap-1">
            <div className="flex justify-between items-center text-white/70 text-xs">
              <span>Artistes</span>
              <Image className="w-4 h-4 text-kcb-pierre" />
            </div>
            <span className="text-xl font-bold text-white mt-1 tabular-nums">
              {loading ? '—' : artists?.length ?? 0}
            </span>
          </div>
          <div className="w-full rounded-[4px] p-4 bg-kcb-noir/80 text-sm flex flex-col gap-1">
            <div className="flex justify-between items-center text-white/70 text-xs">
              <span>Collectionneurs</span>
              <User className="w-4 h-4 text-kcb-pierre" />
            </div>
            <span className="text-xl font-bold text-white mt-1 tabular-nums">
              {loading ? '—' : buyers?.length ?? 0}
            </span>
          </div>
          <div className="w-full rounded-[4px] p-4 bg-kcb-noir/80 text-sm flex flex-col gap-1">
            <div className="flex justify-between items-center text-white/70 text-xs">
              <span>Professionnels</span>
              <Shield className="w-4 h-4 text-kcb-pierre" />
            </div>
            <span className="text-xl font-bold text-white mt-1 tabular-nums">
              {loading ? '—' : curators?.length ?? 0}
            </span>
          </div>
        </div>

        <div className="my-6">
          {!loading && <UsersTable users={users.filter((item) => item?._id !== user?._id)} />}
        </div>
      </div>
      {state?.addUser && <AddUserModal closeModal={() => setState({ ...state, addUser: false })} />}
    </>
  )
}

function AddUserModal({ closeModal }) {
  const { addUser } = useUsersContext()
  const [state, setState] = useState({
    name: '',
    email: '',
    role: 'admin',
    password: '',
    loading: false,
  })

  const roleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'superadmin', label: 'Super Admin' },
  ]

  const handleAddUser = async (e) => {
    e.preventDefault()
    try {
      setState((s) => ({ ...s, loading: true }))
      const user = await addUser({
        name: state.name,
        email: state.email,
        role: state.role,
        password: state.password,
      })
      if (user?._id) {
        toast.success('? Admin ajout�')
        closeModal()
      } else {
        toast.error('� ' + (user?.error || 'Erreur'))
      }
      setState((s) => ({ ...s, loading: false }))
    } catch (error) {
      toast.error('� Erreur serveur')
      setState((s) => ({ ...s, loading: false }))
    }
  }

  return (
    <Modal isOpen={true} onClose={closeModal} title="Ajouter un admin" size="sm">
      <form onSubmit={handleAddUser} className="space-y-4">
        <Input
          label="Nom"
          value={state.name}
          onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
          placeholder="Nom de l'admin"
          minLength={3}
          required
        />

        <Input
          label="Email"
          type="email"
          value={state.email}
          onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
          placeholder="Email de l'admin"
          minLength={5}
          required
        />

        <Input
          label="Mot de passe"
          type="password"
          value={state.password}
          onChange={(e) => setState((s) => ({ ...s, password: e.target.value }))}
          placeholder="Mot de passe"
          minLength={5}
          required
        />

        <Select
          label="R�le"
          options={roleOptions}
          value={state.role}
          onChange={(value) => setState((s) => ({ ...s, role: value }))}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={closeModal}>
            Annuler
          </Button>
          <Button type="submit" disabled={state.loading} loading={state.loading}>
            Ajouter
          </Button>
        </div>
      </form>
    </Modal>
  )
}
