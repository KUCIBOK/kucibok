import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Image,
  Plus,
  Search,
  XCircle,
} from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SeeAction } from './SeeAction'
import { ApproveAction } from './ApproveAction'
import { DownloadAction } from './DownloadAction'
import { UpdateEtherscan } from './UpdateEtherscan'
import { UpdateArtworkAction } from './UpdateArtworkAction'
import { GenerateCertificateAction } from './GenerateCertificateAction'
import { DataTable, Badge, StatusBadge, EmptyState } from '../ui'

export const ArtworksList = ({ artworks, user }) => {
  const getStatusVariant = (status) => {
    switch (status) {
      case 'approved':
        return 'success'
      case 'pending':
        return 'warning'
      case 'rejected':
        return 'danger'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'approved':
        return 'Approuvée'
      case 'pending':
        return 'En attente'
      case 'rejected':
        return 'Refusée'
      default:
        return status
    }
  }

  const columns = [
    {
      header: 'Aperçu',
      accessor: 'image',
      render: (value, row) => {
        const imageUrl = value || '/images/placeholder-artwork.svg'
        return (
          <div className="h-10 w-10 rounded-[4px] bg-kcb-noir flex items-center justify-center overflow-hidden">
            <img
              loading="lazy"
              src={imageUrl}
              alt={row.title}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.src = '/images/placeholder-artwork.svg'
              }}
            />
          </div>
        )
      },
    },
    {
      header: 'Titre',
      accessor: 'title',
      sortable: true,
    },
    {
      header: 'Artiste',
      accessor: 'artist',
      sortable: true,
    },
    ...(user?.role !== 'buyer'
      ? [
          {
            header: 'Créé',
            accessor: 'created_at',
            sortable: true,
            render: (value) => {
              if (!value) return '—'
              const date = new Date(value)
              return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR')
            },
          },
          {
            header: 'Statut',
            accessor: 'status',
            render: (value) => (
              <StatusBadge status={getStatusVariant(value)}>{getStatusLabel(value)}</StatusBadge>
            ),
          },
        ]
      : [
          {
            header: 'Aquis le',
            accessor: 'acquired',
            sortable: true,
            render: (value) => new Date(value).toLocaleDateString('fr-FR'),
          },
        ]),
    {
      header: 'Prix',
      accessor: 'price',
      sortable: true,
      render: (value, row) => `${value?.toLocaleString('fr-FR')} ${row.currency || ''}`,
    },
    {
      header: 'Visitée',
      accessor: 'visited',
      sortable: true,
    },
    {
      header: 'Etherscan',
      accessor: 'etherscan',
      render: (value) =>
        value ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-kcb-or hover:underline"
          >
            Voir
          </a>
        ) : (
          <span className="text-kcb-pierre italic text-xs">À venir</span>
        ),
    },
    {
      header: 'Certificat',
      accessor: 'certificate_path',
      render: (value, row) => <GenerateCertificateAction artwork={row} user={user} />,
    },
    {
      header: 'Actions',
      accessor: '_id',
      render: (value, row) => (
        <div className="flex justify-end items-center gap-2">
          <DownloadAction artwork={row} />
          <SeeAction user={user} artwork={row} />
          {user?.role !== 'buyer' && <UpdateArtworkAction artwork={row} />}
          {user?.role === 'admin' && <ApproveAction artwork={row} />}
          {user?.role === 'admin' && <UpdateEtherscan artwork={row} />}
        </div>
      ),
    },
  ]

  if (!artworks || artworks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Image className="w-12 h-12 text-kcb-pierre/40" />
        <p className="text-kcb-pierre text-sm">Vous n'avez pas encore soumis d'œuvre.</p>
        {user?.role === 'artist' && (
          <Link
            to="/dashboard/artist/submit-artwork"
            className="flex items-center gap-2 bg-kcb-or text-kcb-noir px-4 py-2 rounded-[4px] text-sm font-semibold hover:bg-kcb-bronze transition"
          >
            <Plus className="w-4 h-4" />
            Soumettre une première œuvre
          </Link>
        )}
      </div>
    )
  }

  return (
    <DataTable
      data={artworks}
      columns={columns}
      searchable={true}
      pagination={true}
      pageSize={40}
      emptyMessage="Aucune œuvre trouvée"
    />
  )
}
