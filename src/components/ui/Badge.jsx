import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

/**
 * Design System - Badge Component
 *
 * Small status indicators and labels
 *
 * Variants:
 * - default: Gray
 * - success: Green
 * - warning: Yellow
 * - danger: Red
 * - info: Blue
 * - primary: KCB gold (kcb-or)
 */

const variants = {
  default: 'bg-white/[0.06] text-kcb-sable border-white/[0.08]',
  success: 'bg-green-900/20 text-green-400 border-green-700',
  warning: 'bg-yellow-900/20 text-yellow-400 border-yellow-700',
  danger: 'bg-red-900/20 text-red-400 border-red-700',
  info: 'bg-blue-900/20 text-blue-400 border-blue-700',
  primary: 'bg-kcb-or/10 text-kcb-or border-kcb-or/30',
}

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
}

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  icon: Icon,
  dot = false,
  removable = false,
  onRemove,
  className = '',
}) {
  const baseStyles =
    'inline-flex items-center gap-1.5 font-medium border rounded-full transition-colors'
  const variantStyles = variants[variant] || variants.default
  const sizeStyles = sizes[size] || sizes.sm

  return (
    <span className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}>
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${variant === 'success' ? 'bg-green-400' : variant === 'warning' ? 'bg-yellow-400' : variant === 'danger' ? 'bg-red-400' : 'bg-kcb-pierre'}`}
        />
      )}
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
      {removable && onRemove && (
        <button
          onClick={onRemove}
          className="hover:opacity-70 transition-opacity"
          aria-label="Remove"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  )
}

export function StatusBadge({ status, className = '' }) {
  const statusConfig = {
    active: { variant: 'success', icon: CheckCircle, label: 'Actif' },
    pending: { variant: 'warning', icon: AlertTriangle, label: 'En attente' },
    inactive: { variant: 'default', icon: Info, label: 'Inactif' },
    error: { variant: 'danger', icon: AlertCircle, label: 'Erreur' },
    approved: { variant: 'success', icon: CheckCircle, label: 'Approuvé' },
    rejected: { variant: 'danger', icon: X, label: 'Rejeté' },
    sold: { variant: 'default', icon: Info, label: 'Vendu' },
    draft: { variant: 'default', icon: Info, label: 'Brouillon' },
  }

  const config = statusConfig[status] || statusConfig.draft

  return (
    <Badge variant={config.variant} icon={config.icon} className={className}>
      {config.label}
    </Badge>
  )
}

export default Badge
