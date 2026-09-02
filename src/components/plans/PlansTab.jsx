import { useState } from 'react'
import {
  Plus,
  Shield,
  Users,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Layers,
} from 'lucide-react'
import { usePlanStore } from '../../api/usePlanQuery'
import { PlansListItemActions } from './PlansListItemActions'
import { Modal, Input, Select, Button, toast } from '../ui'

const LEVEL_CONFIG = {
  0:   { border: 'border-white/[0.08]',      badge: 'bg-white/[0.07] text-kcb-pierre',     dot: 'bg-kcb-pierre'   },
  27:  { border: 'border-[#9B4D96]/30',      badge: 'bg-[#9B4D96]/15 text-[#c084d8]',      dot: 'bg-[#9B4D96]'   },
  67:  { border: 'border-kcb-or/30',         badge: 'bg-kcb-or/15 text-kcb-or',            dot: 'bg-kcb-or'       },
  147: { border: 'border-emerald-500/25',    badge: 'bg-emerald-500/15 text-emerald-300',   dot: 'bg-emerald-400'  },
}

function levelOf(price) {
  if (price >= 147) return 147
  if (price >= 67) return 67
  if (price >= 27) return 27
  return 0
}

function PlanCard({ plan }) {
  const cfg = LEVEL_CONFIG[levelOf(plan.price)]
  const [open, setOpen] = useState(false)

  return (
    <div className={`bg-kcb-noir/50 border rounded-[4px] flex flex-col ${cfg.border}`}>
      {/* Top */}
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.badge}`}>
              {plan.role === 'buyer' ? 'Acheteur' : plan.role === 'curator' ? 'Curateur' : plan.role ?? '—'}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white truncate">{plan.name}</h3>
          {plan.description && (
            <p className="text-xs text-kcb-pierre mt-0.5 leading-snug line-clamp-2">{plan.description}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold text-white">
            {plan.price === 0 ? 'Gratuit' : `${plan.price?.toLocaleString('fr-FR')}`}
          </p>
          {plan.price > 0 && (
            <p className="text-xs text-kcb-pierre">{plan.currency} / mois</p>
          )}
        </div>
      </div>

      {/* Features toggle */}
      <div className="px-4 pb-3">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-xs text-kcb-pierre hover:text-white transition"
        >
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {plan.features?.length ?? 0} fonctionnalité{plan.features?.length !== 1 ? 's' : ''}
        </button>
        {open && plan.features?.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {plan.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-kcb-sable">
                <Check className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 mt-auto border-t border-white/[0.04] pt-3">
        <PlansListItemActions plan={plan} />
      </div>
    </div>
  )
}

function PlansGroup({ title, icon: Icon, plans, color, loading, onAdd }) {
  return (
    <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          {title}
          <span className="text-xs font-normal text-kcb-pierre">({plans?.length ?? 0})</span>
        </h2>
        {onAdd && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 text-xs bg-kcb-or hover:bg-kcb-bronze text-kcb-noir font-semibold px-3 py-1.5 rounded-[4px] transition"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-kcb-or border-t-transparent rounded-full animate-spin" />
        </div>
      ) : plans?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...plans].sort((a, b) => a.price - b.price).map((plan) => (
            <PlanCard key={plan.id ?? plan._id} plan={plan} />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-kcb-pierre text-sm border border-dashed border-white/[0.06] rounded-[4px]">
          Aucun plan.{' '}
          {onAdd && (
            <button onClick={onAdd} className="text-kcb-or underline">
              Créer le premier
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function PlansTab() {
  const { buyerPlans, curatorPlans, plans, loading } = usePlanStore()
  const [showAdd, setShowAdd] = useState(false)

  const currencies = [...new Set((plans ?? []).map((p) => p.currency))].filter(Boolean)
  const mrr = (plans ?? []).reduce((s, p) => s + (p.price ?? 0), 0)

  return (
    <div className="space-y-6 pb-8">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Plans configurés', value: plans?.length ?? 0, icon: Layers, color: 'text-white' },
          { label: 'Plans acheteurs', value: buyerPlans?.length ?? 0, icon: Users, color: 'text-[#9B4D96]' },
          { label: 'Plans curateurs', value: curatorPlans?.length ?? 0, icon: Shield, color: 'text-kcb-or' },
          { label: 'Devises actives', value: currencies.join(' · ') || '—', icon: CreditCard, color: 'text-emerald-400' },
        ].map((k, i) => (
          <div key={i} className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/[0.04] flex items-center justify-center flex-shrink-0">
              <k.icon className={`w-4 h-4 ${k.color}`} />
            </div>
            <div>
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-kcb-pierre leading-tight">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <PlansGroup
        title="Plans Acheteurs & Collectionneurs"
        icon={Users}
        color="text-[#9B4D96]"
        plans={buyerPlans}
        loading={loading}
        onAdd={() => setShowAdd(true)}
      />

      <PlansGroup
        title="Plans Curateurs & Advisors"
        icon={Shield}
        color="text-kcb-or"
        plans={curatorPlans}
        loading={loading}
      />

      {showAdd && <AddPlanModal closeModal={() => setShowAdd(false)} />}
    </div>
  )
}

function AddPlanModal({ closeModal }) {
  const { addPlan } = usePlanStore()
  const [state, setState] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'EUR',
    duration: 'monthly',
    role: 'buyer',
    features: [],
    feature: '',
    loading: false,
  })

  const currencyOptions = [
    { value: 'XOF', label: 'XOF' },
    { value: 'USD', label: 'USD' },
    { value: 'EUR', label: 'EUR' },
  ]
  const durationOptions = [
    { value: 'monthly', label: 'Mensuel' },
    { value: 'yearly', label: 'Annuel' },
  ]
  const roleOptions = [
    { value: 'buyer', label: 'Acheteur' },
    { value: 'curator', label: 'Curateur' },
  ]

  const handleAddPlan = async (e) => {
    e.preventDefault()
    if (state.features.length === 0) {
      toast.error('× Ajoutez au moins une fonctionnalité')
      return
    }
    setState((s) => ({ ...s, loading: true }))
    const plan = await addPlan({
      name: state.name,
      description: state.description,
      price: state.price,
      currency: state.currency,
      duration: state.duration,
      role: state.role,
      features: state.features,
    })
    setState((s) => ({ ...s, loading: false }))
    if (plan?.id) {
      toast.success('✓ Plan ajouté')
      closeModal()
    } else {
      toast.error('× ' + (plan?.error || 'Erreur'))
    }
  }

  return (
    <Modal isOpen={true} onClose={closeModal} title="Ajouter un plan" size="md">
      <form onSubmit={handleAddPlan} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nom du plan"
            value={state.name}
            onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            placeholder="Nom du plan"
            minLength={3}
            required
          />
          <Input
            label="Prix"
            type="number"
            min={0}
            max={65590}
            value={state.price}
            onChange={(e) => setState((s) => ({ ...s, price: e.target.value }))}
            placeholder="Prix"
            required
          />
        </div>
        <Input
          label="Description"
          value={state.description}
          onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
          placeholder="Description du plan"
          minLength={5}
          required
        />
        <div className="grid grid-cols-3 gap-2">
          <Select label="Devise" options={currencyOptions} value={state.currency} onChange={(v) => setState((s) => ({ ...s, currency: v }))} />
          <Select label="Durée" options={durationOptions} value={state.duration} onChange={(v) => setState((s) => ({ ...s, duration: v }))} />
          <Select label="Rôle" options={roleOptions} value={state.role} onChange={(v) => setState((s) => ({ ...s, role: v }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-kcb-sable mb-2">Fonctionnalités</label>
          <div className="flex gap-2">
            <Input
              value={state.feature}
              onChange={(e) => setState((s) => ({ ...s, feature: e.target.value }))}
              placeholder="Ajouter une fonctionnalité"
              className="flex-1"
            />
            <Button
              type="button"
              onClick={() => {
                if (state.feature) {
                  setState((s) => ({ ...s, features: [...s.features, s.feature], feature: '' }))
                }
              }}
              disabled={!state.feature}
            >
              +
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            {state.features.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-kcb-or/20 border border-kcb-or/30 rounded-full px-3 py-1 text-xs">
                <span className="text-kcb-or">{f}</span>
                <button
                  type="button"
                  onClick={() => setState((s) => ({ ...s, features: s.features.filter((_, j) => j !== i) }))}
                  className="text-red-400 hover:text-red-300 leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
          <Button type="submit" disabled={state.loading} loading={state.loading}>Ajouter</Button>
        </div>
      </form>
    </Modal>
  )
}
