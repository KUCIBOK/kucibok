/**
 * ui.js — Traductions FR/EN pour toute l'interface dashboard et navigation.
 * Toutes les chaînes hardcodées des dashboards, sidebars et composants partagés.
 */

export const uiT = {
  fr: {
    sidebar: {
      searchPlaceholder: 'Rechercher...',
      back: 'Retour',
      logout: 'Déconnexion',
      upgrade: "Mettre à jour l'abonnement",
    },

    dashboards: {
      artist: {
        categories: {
          dashboard: 'Tableau de Bord',
          artworksAndSales: 'Mes Œuvres & Ventes',
          clientsAndComms: 'Clients & Communication',
          operations: 'Opérations',
          account: 'Compte',
          rewards: 'Rewards & Supplies',
        },
        items: {
          overview: 'Vue générale',
          analytics: 'Analytique',
          artworks: 'Mes Œuvres',
          certifications: 'Certifications KCB',
          sales: 'Mes Ventes',
          clients: 'Mes clients',
          notifications: 'Notifications',
          support: 'Support',
          logistics: 'Logistique',
          profile: 'Profil',
          subscription: 'Abonnement',
          rewards: 'Rewards & Supplies',
        },
        cta: 'Ajouter une œuvre',
        titles: {
          artworkSubmission: "Statut de soumission des œuvres d'art",
          artworkAnalytics: "Analytique des œuvres d'art",
        },
        breadcrumb: { defaultCategory: 'Dashboard', defaultPage: 'Vue générale' },
      },

      admin: {
        categories: {
          dashboard: 'Tableau de Bord',
          artworkManagement: 'Gestion Œuvres',
          usersAndClients: 'Utilisateurs & Clients',
          marketingAndComms: 'Marketing & Communication',
          operations: 'Opérations',
          subscriptionsAndPlans: 'Abonnements & Plans',
        },
        items: {
          dashboard: 'Dashboard',
          pending: 'En attente',
          approved: 'Approuvées',
          rejected: 'Rejetées',
          digitizations: 'Numérisations',
          auctions: 'Enchères',
          users: 'Utilisateurs',
          artists: 'Artistes',
          clientPortfolio: 'Portefeuille clients',
          scrapedGalleries: 'Galeries scrapées',
          blogPosts: 'Articles de blog',
          supportTickets: 'Support & Tickets',
          logistics: 'Logistiques',
          categories: 'Catégories',
          logs: 'Logs',
          plans: 'Plans',
          subscriptions: 'Abonnements',
        },
        titles: {
          pendingArtworks: "En attente d'examen",
          approvedArtworks: 'Oeuvres approuvées',
          rejectedArtworks: 'Oeuvres rejetées',
          deliveryRequests: 'Demandes de livraison',
          supportTickets: 'Support Client & Tickets',
          featureUnavailable: "Cette fonctionnalité n'est pas encore disponible.",
        },
        breadcrumb: { defaultCategory: 'Dashboard', defaultPage: 'Dashboard' },
      },

      advisor: {
        categories: {
          dashboard: 'Tableau de Bord',
          portfolios: 'Portefeuilles',
          tools: 'Outils',
          account: 'Compte',
        },
        items: {
          view360: 'Vue 360°',
          marketIntelligence: 'Intelligence marché',
          clients: 'Mes clients',
          dealPipeline: 'Deal pipeline',
          catalogue: 'Catalogue & Sourcing',
          reports: 'Rapports',
          profile: 'Profil',
          subscription: 'Abonnement',
        },
        breadcrumb: { defaultCategory: 'Dashboard', defaultPage: 'Vue 360°' },
      },

      professional: {
        categories: {
          dashboard: 'Tableau de Bord',
          discovery: 'Découverte',
          operations: 'Opérations',
          finance: 'Finance',
          training: 'Formation',
          account: 'Compte',
        },
        items: {
          overview: 'Vue générale',
          verifiedArtists: 'Artistes vérifiés',
          catalogue: 'Catalogue & Sourcing',
          logisticsHub: 'Centre logistique',
          conciergeServices: 'Services Concierge',
          budgetTracking: 'Suivi budget',
          learningHub: 'Hub éducatif',
          profile: 'Profil',
          subscription: 'Abonnement',
        },
        breadcrumb: { defaultCategory: 'Dashboard', defaultPage: 'Vue générale' },
      },

      buyer: {
        categories: {
          myAccount: 'Mon Compte',
        },
        items: {
          purchases: 'Mes achats',
          certificates: 'Mes certificats KCB',
          logistics: 'Logistique',
          profile: 'Profil',
        },
        titles: {
          purchases: 'Mes achats',
        },
        breadcrumb: { defaultCategory: 'Mon Compte', defaultPage: 'Mes achats' },
      },
    },
  },

  en: {
    sidebar: {
      searchPlaceholder: 'Search...',
      back: 'Back',
      logout: 'Logout',
      upgrade: 'Upgrade subscription',
    },

    dashboards: {
      artist: {
        categories: {
          dashboard: 'Dashboard',
          artworksAndSales: 'My Artworks & Sales',
          clientsAndComms: 'Clients & Communication',
          operations: 'Operations',
          account: 'Account',
          rewards: 'Rewards & Supplies',
        },
        items: {
          overview: 'Overview',
          analytics: 'Analytics',
          artworks: 'My Artworks',
          certifications: 'KCB Certifications',
          sales: 'My Sales',
          clients: 'My Clients',
          notifications: 'Notifications',
          support: 'Support',
          logistics: 'Logistics',
          profile: 'Profile',
          subscription: 'Subscription',
          rewards: 'Rewards & Supplies',
        },
        cta: 'Add an artwork',
        titles: {
          artworkSubmission: 'Artwork Submission Status',
          artworkAnalytics: 'Artwork Analytics',
        },
        breadcrumb: { defaultCategory: 'Dashboard', defaultPage: 'Overview' },
      },

      admin: {
        categories: {
          dashboard: 'Dashboard',
          artworkManagement: 'Artwork Management',
          usersAndClients: 'Users & Clients',
          marketingAndComms: 'Marketing & Communication',
          operations: 'Operations',
          subscriptionsAndPlans: 'Subscriptions & Plans',
        },
        items: {
          dashboard: 'Dashboard',
          pending: 'Pending',
          approved: 'Approved',
          rejected: 'Rejected',
          digitizations: 'Digitizations',
          auctions: 'Auctions',
          users: 'Users',
          artists: 'Artists',
          clientPortfolio: 'Client Portfolio',
          scrapedGalleries: 'Scraped Galleries',
          blogPosts: 'Blog Posts',
          supportTickets: 'Support & Tickets',
          logistics: 'Logistics',
          categories: 'Categories',
          logs: 'Logs',
          plans: 'Plans',
          subscriptions: 'Subscriptions',
        },
        titles: {
          pendingArtworks: 'Pending Review',
          approvedArtworks: 'Approved Artworks',
          rejectedArtworks: 'Rejected Artworks',
          deliveryRequests: 'Delivery Requests',
          supportTickets: 'Customer Support & Tickets',
          featureUnavailable: 'This feature is not yet available.',
        },
        breadcrumb: { defaultCategory: 'Dashboard', defaultPage: 'Dashboard' },
      },

      advisor: {
        categories: {
          dashboard: 'Dashboard',
          portfolios: 'Portfolios',
          tools: 'Tools',
          account: 'Account',
        },
        items: {
          view360: '360° View',
          marketIntelligence: 'Market Intelligence',
          clients: 'My Clients',
          dealPipeline: 'Deal Pipeline',
          catalogue: 'Catalogue & Sourcing',
          reports: 'Reports',
          profile: 'Profile',
          subscription: 'Subscription',
        },
        breadcrumb: { defaultCategory: 'Dashboard', defaultPage: '360° View' },
      },

      professional: {
        categories: {
          dashboard: 'Dashboard',
          discovery: 'Discovery',
          operations: 'Operations',
          finance: 'Finance',
          training: 'Training',
          account: 'Account',
        },
        items: {
          overview: 'Overview',
          verifiedArtists: 'Verified Artists',
          catalogue: 'Catalogue & Sourcing',
          logisticsHub: 'Logistics Hub',
          conciergeServices: 'Concierge Services',
          budgetTracking: 'Budget Tracking',
          learningHub: 'Learning Hub',
          profile: 'Profile',
          subscription: 'Subscription',
        },
        breadcrumb: { defaultCategory: 'Dashboard', defaultPage: 'Overview' },
      },

      buyer: {
        categories: {
          myAccount: 'My Account',
        },
        items: {
          purchases: 'My Purchases',
          certificates: 'My KCB Certificates',
          logistics: 'Logistics',
          profile: 'Profile',
        },
        titles: {
          purchases: 'My Purchases',
        },
        breadcrumb: { defaultCategory: 'My Account', defaultPage: 'My Purchases' },
      },
    },
  },
}
