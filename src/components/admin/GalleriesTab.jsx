import { useGalleries } from '../../api/useGalleriesQuery.js'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { importGalleries } from '../../api/useGallery'
import { useToast } from '../../store/ToastContext'

export default function GalleriesTab() {
  const { galleries, total, filtered, refresh } = useGalleries()
  const { makeToast } = useToast()

  const [state, setState] = useState({
    set: galleries.slice(0, 40),
    galleries: galleries,
  })

  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [file, setFile] = useState(null)
  const fileInputRef = useRef(null)

  // Export CSV helper
  const escapeCsv = (val) => {
    const s = String(val).replaceAll('"', '""')
    if (s.includes(',') || s.includes('\n') || s.includes('"')) return `"${s}"`
    return s
  }

  const handleExport = () => {
    const rows = [
      'name,email',
      ...state.galleries.map((g) => `${escapeCsv(g?.name || '')},${escapeCsv(g?.email || '')}`),
    ]
    const blob = new Blob([rows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `galleries_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Initial state sync
  useEffect(() => {
    setState({
      set: galleries.slice(0, 40),
      galleries: galleries,
    })
  }, [galleries])

  const handleSearch = (e) => {
    const s = e.target.value
    setSearch(s)
  }

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFile(file)
  }

  const handleSubmitImport = async () => {
    if (!file) {
      makeToast('Erreur', 'error', 'Veuillez sélectionner un fichier')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await importGalleries(formData)
      setImportResult(result)
      makeToast('Succès', 'success', `${result?.count || 0} galeries importées`)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      refresh()
    } catch (error) {
      makeToast('Erreur', 'error', error?.message || 'Import échoué')
    } finally {
      setUploading(false)
    }
  }

  const results = search.trim()
    ? state.galleries.filter(
        (g) =>
          g?.name?.toLowerCase?.().includes?.(search.toLowerCase()) ||
          g?.email?.toLowerCase?.().includes?.(search.toLowerCase())
      )
    : state.set

  const pages = Math.max(1, Math.ceil((state.galleries?.length || 0) / 40))
  const [page, setPage] = useState(1)

  const paginated = results.slice((page - 1) * 40, page * 40)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Galeries</h2>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={handleSearch}
            className="flex-1 px-4 py-2 bg-kcb-ardoise border border-white/10 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-kcb-or"
          />
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-kcb-or text-black rounded font-medium hover:bg-kcb-bronze transition"
          >
            Exporter CSV
          </button>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleImport}
              disabled={uploading}
              className="flex-1 px-4 py-2 bg-kcb-ardoise border border-white/10 rounded text-white file:mr-4 file:py-2 file:px-4 file:bg-kcb-or file:text-black file:rounded file:border-0 file:font-medium disabled:opacity-50"
            />
            <button
              onClick={handleSubmitImport}
              disabled={!file || uploading}
              className="px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition disabled:opacity-50"
            >
              {uploading ? 'Import...' : 'Importer CSV'}
            </button>
          </div>
          {importResult && (
            <div className="p-3 bg-green-900/20 border border-green-700/30 rounded text-green-400">
              {importResult?.message || `${importResult?.count} galeries importées avec succès`}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 font-semibold">Nom</th>
                <th className="text-left py-2 px-3 font-semibold">Email</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((gallery, i) => (
                <tr key={i} className="border-b border-white/10 hover:bg-kcb-ardoise/50">
                  <td className="py-2 px-3 text-white">{gallery?.name || '—'}</td>
                  <td className="py-2 px-3 text-kcb-pierre">{gallery?.email || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2 hover:bg-kcb-ardoise rounded disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-kcb-pierre">
              Page {page} / {pages}
            </span>
            <button
              onClick={() => setPage(Math.min(pages, page + 1))}
              disabled={page === pages}
              className="p-2 hover:bg-kcb-ardoise rounded disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
