import { AlertTriangle } from 'lucide-react'

/**
 * Design System - Error State Component
 *
 * Affiche un vrai message d'erreur quand une API ne répond pas,
 * à la place d'un état vide ou de chiffres de remplacement.
 *
 * @param {object} props
 * @param {string} [props.title] - Titre du message
 * @param {Error|string} [props.error] - Erreur à afficher
 * @param {function} [props.onRetry] - Handler du bouton "Réessayer"
 * @param {string} [props.className] - Classes additionnelles
 */
export function ErrorState({
  title = 'Impossible de charger les données',
  error,
  onRetry,
  className = '',
}) {
  const message = typeof error === 'string' ? error : error?.message
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-4 rounded-[4px] border bg-red-500/10 border-red-500/30 text-red-300 ${className}`}
    >
      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-semibold text-sm">{title}</p>
        {message && <p className="text-xs mt-1 text-red-300/80">{message}</p>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs px-3 py-1 rounded-[4px] border border-red-500/40 hover:bg-red-500/20 transition"
        >
          Réessayer
        </button>
      )}
    </div>
  )
}
