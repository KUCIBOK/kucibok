import { lazy, Suspense } from 'react'
import { PageLoader } from '../components/loaders/PageLoader'
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { Layout } from '../pages/Layout'
const SignUp = lazy(() => import('../pages/auth/SignUp'))
const SignIn = lazy(() => import('../pages/auth/SignIn'))
const VerifyEmail = lazy(() => import('../pages/auth/VerifyEmail'))
const CheckEmail = lazy(() => import('../pages/auth/CheckEmail'))
const ResetPasswordForm = lazy(() => import('../pages/ForgotPassword'))
const ForgotPasswordForm = lazy(() => import('../pages/ForgotPasswordForm'))
const About = lazy(() => import('../pages/About'))
const Blog = lazy(() => import('../pages/Blog'))
const Artists = lazy(() => import('../pages/Artists'))
const Auctions = lazy(() => import('../pages/Auctions'))
const AuctionDetails = lazy(() => import('../pages/AuctionDetails'))
const Faq = lazy(() => import('../pages/Faq'))
const Contact = lazy(() => import('../pages/Contact'))
const Artwork = lazy(() => import('../pages/Artwork'))
const BlogPostDetails = lazy(() => import('../pages/BlogPostDetails'))
const ArtistDetails = lazy(() => import('../pages/Artist'))
const Error404 = lazy(() => import('../components/fallback/Error404'))
const Artist = lazy(() => import('../pages/dashboard/Artist'))
const SubmitArtwork = lazy(() => import('../pages/dashboard/SubmitArtwork'))
const Professional = lazy(() => import('../pages/dashboard/Professional'))
const Advisor = lazy(() => import('../pages/dashboard/Advisor'))
const SourcingArtworkDetail = lazy(() => import('../pages/dashboard/SourcingArtworkDetail'))
const BuyerAccount = lazy(() => import('../pages/dashboard/BuyerAccount'))
const Admin = lazy(() => import('../pages/dashboard/Admin'))
const ArtworkCheckout = lazy(() => import('../pages/ArtworkCheckout'))
const ArtworkPurchaseSuccess = lazy(() => import('../pages/ArtworkPurchaseSuccess'))
const ArtworkPurchaseFailed = lazy(() => import('../pages/ArtworkPurchaseFailed'))
const SubscriptionPlanCheckout = lazy(() => import('../pages/SubscriptionPlanCheckout'))
const SubscriptionPlanSuccess = lazy(() => import('../pages/SubscriptionSuccess'))
const SubscriptionPlanFailed = lazy(() => import('../pages/SubscriptionFailed'))
const PayDunyaSuccess = lazy(() => import('../pages/PayDunyaSuccess'))
const PayDunyaFailed = lazy(() => import('../pages/PayDunyaFailed'))
const PrivacyPolicy = lazy(() => import('../pages/PrivacyPolicy'))
const TermsAndConditions = lazy(() => import('../pages/TermsAndConditions'))
const SalesConditions = lazy(() => import('../pages/SalesConditions'))
const EthicChart = lazy(() => import('../pages/EthicChart'))
const Unsubscribe = lazy(() => import('../pages/Unsubscribe'))
const TrackingPage = lazy(() => import('../pages/TrackingPage'))
const AfricaLanding = lazy(() => import('../pages/AfricaLanding'))
const AfricaCataloguePage = lazy(() => import('../pages/AfricaCataloguePage'))
import PortalLayout from '../components/landing/PortalLayout'

function AfricaWrap({ children }) {
  return (
    <PortalLayout portal="africa">
      <div className="pt-24">{children}</div>
    </PortalLayout>
  )
}

function GlobalWrap({ children }) {
  return (
    <PortalLayout portal="global">
      <div className="pt-24">{children}</div>
    </PortalLayout>
  )
}

function NavigateWithParams({ to }) {
  const params = useParams()
  let target = to
  for (const [key, value] of Object.entries(params)) {
    if (key !== '*') target = target.replace(`:${key}`, value)
  }
  return <Navigate to={target} replace />
}

/**
 * Redirect vers le portail courant (africa ou global) selon le contexte de navigation.
 */
function PortalNavigate({ africaPath, globalPath }) {
  const location = useLocation()
  const isGlobal =
    location.state?.fromPortal === 'global' ||
    document.referrer.includes('/global') ||
    sessionStorage.getItem('kcb_portal') === 'global'
  return <Navigate to={isGlobal ? globalPath : africaPath} replace />
}

function PortalNavigateWithParams({ africaTo, globalTo }) {
  const params = useParams()
  const location = useLocation()
  const isGlobal =
    location.state?.fromPortal === 'global' ||
    document.referrer.includes('/global') ||
    sessionStorage.getItem('kcb_portal') === 'global'
  const to = isGlobal ? globalTo : africaTo
  let target = to
  for (const [key, value] of Object.entries(params)) {
    if (key !== '*') target = target.replace(`:${key}`, value)
  }
  return <Navigate to={target} replace />
}

const GatewayPage = lazy(() => import('../pages/GatewayPage'))
const HomePage = lazy(() => import('../pages/HomePage'))
const GlobalPage = lazy(() => import('../pages/GlobalPage'))
const GlobalCataloguePage = lazy(() => import('../pages/GlobalCataloguePage'))
const ForArtistsPage = lazy(() => import('../pages/ForArtistsPage'))
const GlobalSourcingPage = lazy(() => import('../pages/GlobalSourcingPage'))
const VerifyArtwork = lazy(() => import('../pages/VerifyArtwork'))
const CataloguePro = lazy(() => import('../pages/CataloguePro'))

// Protected Routes
import { GuestProtectedRoute } from '../utils/GuestProtectedRoute'
import { ArtistProtectedRoute } from '../utils/ArtistProtectedRoute'
import { BuyerProtectedRoute } from '../utils/BuyerProtectedRoute'
import { CuratorProtectedRoute } from '../utils/CuratorProtectedRoute'
import { AdvisorProtectedRoute } from '../utils/AdvisorProtectedRoute'
import { AdminProtectedRoute } from '../utils/AdminProtectedRoute'
import { AuthProtectedRoute } from '../utils/AuthProtectedRoute'
const GoogleRoleSelection = lazy(() => import('../pages/auth/GoogleRoleSelection'))
const OAuthCallback = lazy(() => import('../pages/auth/OAuthCallback'))

// Context Providers/Store Imports
import { AuthContextProvider } from '../store/AuthContext'
// ✨ PHASE 3: Removed ArtworksContextProvider (→ React Query)
// ✨ PHASE 3: Removed GalleryContextProvider (→ React Query)
import { ArtistContextProvider } from '../store/ArtistContext'
import { BlogContextProvider } from '../store/BlogContext'
import { UserProvider } from '../store/UsersStore'
import { PlanProvider } from '../store/PlanContext'
import { CategoryProvider } from '../store/CategoryStore'
import { CollectionProvider } from '../store/CollectionStore'
import { DeliveryContextProvider } from '../store/DeliveryStore'
import { NumerisationProvider } from '../store/NumerisationStore'

// AutoAuth component
import { AutoAuth } from '../store/AutoAuth'
import { ErrorBoundary } from 'react-error-boundary'
import Error500 from '../components/fallback/Error500'

export function Router() {
  return (
    <Routes>
      {/* ═══════════════════════════════════════════════════════════════
          NIVEAU 1 — Auth seul (toutes les routes)
          Seul AuthContextProvider monte ici : 0 appel API superflu
          sur sign-up / sign-in / pages légales.
          ═══════════════════════════════════════════════════════════════ */}
      <Route
        element={
          <ErrorBoundary FallbackComponent={Error500}>
            <AuthContextProvider>
              <AutoAuth />
              <Outlet />
            </AuthContextProvider>
          </ErrorBoundary>
        }
      >
        {/* ── Routes guest (sign-in / sign-up / reset) ── */}
        <Route element={<GuestProtectedRoute />}>
          <Route
            path="/sign-in"
            element={
              <Suspense fallback={<PageLoader />}>
                <SignIn />
              </Suspense>
            }
          />
          <Route
            path="/sign-up"
            element={
              <Suspense fallback={<PageLoader />}>
                <SignUp />
              </Suspense>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <Suspense fallback={<PageLoader />}>
                <ForgotPasswordForm />
              </Suspense>
            }
          />
          <Route
            path="/reset-password"
            element={
              <Suspense fallback={<PageLoader />}>
                <ResetPasswordForm />
              </Suspense>
            }
          />
          <Route
            path="/reset-password/:token"
            element={
              <Suspense fallback={<PageLoader />}>
                <ResetPasswordForm />
              </Suspense>
            }
          />
          <Route
            path="/verify-email/:token"
            element={
              <Suspense fallback={<PageLoader />}>
                <VerifyEmail />
              </Suspense>
            }
          />
          <Route
            path="/check-email"
            element={
              <Suspense fallback={<PageLoader />}>
                <CheckEmail />
              </Suspense>
            }
          />
        </Route>

        {/* ── OAuth ── */}
        <Route
          path="/auth/callback"
          element={
            <Suspense fallback={<PageLoader />}>
              <OAuthCallback />
            </Suspense>
          }
        />
        <Route element={<AuthProtectedRoute />}>
          <Route
            path="/auth/role-selection"
            element={
              <Suspense fallback={<PageLoader />}>
                <GoogleRoleSelection />
              </Suspense>
            }
          />
        </Route>

        {/* ── Redirections portail-aware (pas de rendu, pas d'API) ── */}
        <Route
          path="/explore"
          element={<PortalNavigate africaPath="/africa/catalogue" globalPath="/global/catalogue" />}
        />
        <Route
          path="/explore/:category"
          element={<PortalNavigate africaPath="/africa/catalogue" globalPath="/global/catalogue" />}
        />
        <Route
          path="/marketplace"
          element={<PortalNavigate africaPath="/africa/catalogue" globalPath="/global/catalogue" />}
        />
        <Route
          path="/artists"
          element={<PortalNavigate africaPath="/africa/artists" globalPath="/global/artists" />}
        />
        <Route
          path="/artist/:id"
          element={
            <PortalNavigateWithParams africaTo="/africa/artist/:id" globalTo="/global/artist/:id" />
          }
        />
        <Route
          path="/artists/:id"
          element={
            <PortalNavigateWithParams africaTo="/africa/artist/:id" globalTo="/global/artist/:id" />
          }
        />
        <Route
          path="/artwork/:id"
          element={
            <PortalNavigateWithParams
              africaTo="/africa/artwork/:id"
              globalTo="/global/artwork/:id"
            />
          }
        />
        <Route
          path="/blog"
          element={<PortalNavigate africaPath="/africa/blog" globalPath="/global/blog" />}
        />
        <Route
          path="/blog/:id"
          element={
            <PortalNavigateWithParams africaTo="/africa/blog/:id" globalTo="/global/blog/:id" />
          }
        />
        <Route
          path="/about"
          element={<PortalNavigate africaPath="/africa/about" globalPath="/global/about" />}
        />
        <Route
          path="/contact"
          element={<PortalNavigate africaPath="/africa/contact" globalPath="/global/contact" />}
        />
        <Route
          path="/faq"
          element={<PortalNavigate africaPath="/africa/faq" globalPath="/global/faq" />}
        />

        {/* ── Pages légales (contenu statique, pas de providers de contenu) ── */}
        <Route element={<Layout />}>
          <Route
            path="/privacy-policy"
            element={
              <Suspense fallback={<PageLoader />}>
                <PrivacyPolicy />
              </Suspense>
            }
          />
          <Route
            path="/terms-and-conditions"
            element={
              <Suspense fallback={<PageLoader />}>
                <TermsAndConditions />
              </Suspense>
            }
          />
          <Route
            path="/sales-conditions"
            element={
              <Suspense fallback={<PageLoader />}>
                <SalesConditions />
              </Suspense>
            }
          />
          <Route
            path="/ethic-chart"
            element={
              <Suspense fallback={<PageLoader />}>
                <EthicChart />
              </Suspense>
            }
          />
        </Route>
        <Route
          path="/unsubscribe"
          element={
            <Suspense fallback={<PageLoader />}>
              <Unsubscribe />
            </Suspense>
          }
        />

        {/* ── 404 ── */}
        <Route
          path="*"
          element={
            <Suspense fallback={<PageLoader />}>
              <Error404 />
            </Suspense>
          }
        />
        <Route
          path="/404"
          element={
            <Suspense fallback={<PageLoader />}>
              <Error404 />
            </Suspense>
          }
        />

        {/* ═══════════════════════════════════════════════════════════════
            NIVEAU 2 — Contenu public + dashboards
            Tous les providers de contenu et dashboard montent ici.
            Ne s'initialisent PAS sur les pages auth/légales/redirections.
            ═══════════════════════════════════════════════════════════════ */}
        {/* ✨ PHASE 3: Simplified provider hierarchy */}
        <Route
          element={
            <ArtistContextProvider>
              <BlogContextProvider>
                <UserProvider>
                  <PlanProvider>
                    <CategoryProvider>
                      <CollectionProvider>
                        <DeliveryContextProvider>
                          <NumerisationProvider>
                            <Outlet />
                          </NumerisationProvider>
                        </DeliveryContextProvider>
                      </CollectionProvider>
                    </CategoryProvider>
                  </PlanProvider>
                </UserProvider>
              </BlogContextProvider>
            </ArtistContextProvider>
          }
        >
          {/* Root now displays GlobalPage (same as /global) */}
          <Route
            path="/"
            element={
              <Suspense fallback={<PageLoader />}>
                <GlobalPage />
              </Suspense>
            }
          />

          {/* Paiement + résultats + tracking */}
          <Route element={<Layout />}>
            <Route element={<AuthProtectedRoute />}>
              <Route
                path="/artwork-checkout/:id"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ArtworkCheckout />
                  </Suspense>
                }
              />
              <Route
                path="/subscription-checkout/:id"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <SubscriptionPlanCheckout />
                  </Suspense>
                }
              />
            </Route>
            <Route
              path="/artwork-purchase-success"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ArtworkPurchaseSuccess />
                </Suspense>
              }
            />
            <Route
              path="/artwork-purchase-failed/:transactionId"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ArtworkPurchaseFailed />
                </Suspense>
              }
            />
            <Route
              path="/artwork-success/:transactionId"
              element={
                <Suspense fallback={<PageLoader />}>
                  <PayDunyaSuccess />
                </Suspense>
              }
            />
            <Route
              path="/artwork-failed/:transactionId"
              element={
                <Suspense fallback={<PageLoader />}>
                  <PayDunyaFailed />
                </Suspense>
              }
            />
            <Route
              path="/subscription-success"
              element={
                <Suspense fallback={<PageLoader />}>
                  <SubscriptionPlanSuccess />
                </Suspense>
              }
            />
            <Route
              path="/subscription-failed"
              element={
                <Suspense fallback={<PageLoader />}>
                  <SubscriptionPlanFailed />
                </Suspense>
              }
            />
            <Route
              path="/tracking/:trackingId"
              element={
                <Suspense fallback={<PageLoader />}>
                  <TrackingPage />
                </Suspense>
              }
            />
          </Route>

          {/* ── Portail Africa ── */}
          <Route
            path="/africa"
            element={
              <Suspense fallback={<PageLoader />}>
                <AfricaLanding />
              </Suspense>
            }
          />
          <Route
            path="/africa/catalogue"
            element={
              <Suspense fallback={<PageLoader />}>
                <AfricaCataloguePage />
              </Suspense>
            }
          />
          <Route
            path="/africa/artists"
            element={
              <Suspense fallback={<PageLoader />}>
                <AfricaWrap>
                  <Artists />
                </AfricaWrap>
              </Suspense>
            }
          />
          <Route
            path="/africa/artist/:id"
            element={
              <Suspense fallback={<PageLoader />}>
                <AfricaWrap>
                  <ArtistDetails />
                </AfricaWrap>
              </Suspense>
            }
          />
          <Route
            path="/africa/artwork/:id"
            element={
              <Suspense fallback={<PageLoader />}>
                <AfricaWrap>
                  <Artwork />
                </AfricaWrap>
              </Suspense>
            }
          />
          <Route
            path="/africa/blog"
            element={
              <Suspense fallback={<PageLoader />}>
                <AfricaWrap>
                  <Blog />
                </AfricaWrap>
              </Suspense>
            }
          />
          <Route
            path="/africa/blog/:id"
            element={
              <Suspense fallback={<PageLoader />}>
                <AfricaWrap>
                  <BlogPostDetails />
                </AfricaWrap>
              </Suspense>
            }
          />
          <Route
            path="/africa/about"
            element={
              <Suspense fallback={<PageLoader />}>
                <AfricaWrap>
                  <About />
                </AfricaWrap>
              </Suspense>
            }
          />
          <Route
            path="/africa/faq"
            element={
              <Suspense fallback={<PageLoader />}>
                <AfricaWrap>
                  <Faq />
                </AfricaWrap>
              </Suspense>
            }
          />
          <Route
            path="/africa/contact"
            element={
              <Suspense fallback={<PageLoader />}>
                <AfricaWrap>
                  <Contact />
                </AfricaWrap>
              </Suspense>
            }
          />

          {/* ── Portail Global ── */}
          <Route
            path="/global"
            element={
              <Suspense fallback={<PageLoader />}>
                <GlobalPage />
              </Suspense>
            }
          />
          <Route
            path="/global/catalogue"
            element={
              <Suspense fallback={<PageLoader />}>
                <GlobalCataloguePage />
              </Suspense>
            }
          />
          <Route
            path="/global/sourcing"
            element={
              <Suspense fallback={<PageLoader />}>
                <GlobalSourcingPage />
              </Suspense>
            }
          />

          {/* ── For Artists ── */}
          <Route
            path="/for-artists"
            element={
              <Suspense fallback={<PageLoader />}>
                <ForArtistsPage />
              </Suspense>
            }
          />

          <Route
            path="/global/artists"
            element={
              <Suspense fallback={<PageLoader />}>
                <GlobalWrap>
                  <Artists />
                </GlobalWrap>
              </Suspense>
            }
          />
          <Route
            path="/global/artist/:id"
            element={
              <Suspense fallback={<PageLoader />}>
                <GlobalWrap>
                  <ArtistDetails />
                </GlobalWrap>
              </Suspense>
            }
          />
          <Route
            path="/global/artwork/:id"
            element={
              <Suspense fallback={<PageLoader />}>
                <GlobalWrap>
                  <Artwork />
                </GlobalWrap>
              </Suspense>
            }
          />
          <Route
            path="/global/blog"
            element={
              <Suspense fallback={<PageLoader />}>
                <GlobalWrap>
                  <Blog />
                </GlobalWrap>
              </Suspense>
            }
          />
          <Route
            path="/global/blog/:id"
            element={
              <Suspense fallback={<PageLoader />}>
                <GlobalWrap>
                  <BlogPostDetails />
                </GlobalWrap>
              </Suspense>
            }
          />
          <Route
            path="/global/about"
            element={
              <Suspense fallback={<PageLoader />}>
                <GlobalWrap>
                  <About />
                </GlobalWrap>
              </Suspense>
            }
          />
          <Route
            path="/global/faq"
            element={
              <Suspense fallback={<PageLoader />}>
                <GlobalWrap>
                  <Faq />
                </GlobalWrap>
              </Suspense>
            }
          />
          <Route
            path="/global/contact"
            element={
              <Suspense fallback={<PageLoader />}>
                <GlobalWrap>
                  <Contact />
                </GlobalWrap>
              </Suspense>
            }
          />

          {/* ── Vérification QR public ── */}
          <Route
            path="/verify/:kucibokId"
            element={
              <Suspense fallback={<PageLoader />}>
                <VerifyArtwork />
              </Suspense>
            }
          />

          {/* ── Dashboards authentifiés ── */}

          {/* Artist dashboard */}
          <Route path="/dashboard/artist" element={<ArtistProtectedRoute />}>
            <Route
              path=""
              element={
                <Suspense fallback={<PageLoader />}>
                  <Artist />
                </Suspense>
              }
            />
            <Route
              path="submit-artwork"
              element={
                <Suspense fallback={<PageLoader />}>
                  <SubmitArtwork />
                </Suspense>
              }
            />
          </Route>

          {/* Buyer account */}
          <Route path="/account" element={<BuyerProtectedRoute />}>
            <Route
              path=""
              element={
                <Suspense fallback={<PageLoader />}>
                  <BuyerAccount />
                </Suspense>
              }
            />
          </Route>
          <Route path="/dashboard/collector" element={<Navigate to="/account" replace />} />

          {/* Curator dashboard */}
          <Route path="/dashboard/curator" element={<CuratorProtectedRoute />}>
            <Route
              path=""
              element={
                <Suspense fallback={<PageLoader />}>
                  <Professional />
                </Suspense>
              }
            />
            <Route
              path="add-artwork"
              element={
                <Suspense fallback={<PageLoader />}>
                  <SubmitArtwork />
                </Suspense>
              }
            />
            <Route
              path="sourcing/:artworkId"
              element={
                <Suspense fallback={<PageLoader />}>
                  <SourcingArtworkDetail />
                </Suspense>
              }
            />
          </Route>
          <Route
            path="/dashboard/professional"
            element={<Navigate to="/dashboard/curator" replace />}
          />

          {/* Advisor dashboard */}
          <Route path="/dashboard/advisor" element={<AdvisorProtectedRoute />}>
            <Route
              path=""
              element={
                <Suspense fallback={<PageLoader />}>
                  <Advisor />
                </Suspense>
              }
            />
          </Route>

          {/* Catalogue certifié (curator + admin) */}
          <Route path="/catalogue" element={<CuratorProtectedRoute />}>
            <Route
              path=""
              element={
                <Suspense fallback={<PageLoader />}>
                  <CataloguePro />
                </Suspense>
              }
            />
          </Route>

          {/* Admin + enchères */}
          <Route element={<AdminProtectedRoute />}>
            <Route
              path="/dashboard/admin"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Admin />
                </Suspense>
              }
            />
            <Route
              path="/auction"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Auctions />
                </Suspense>
              }
            />
            <Route
              path="/auction/:id"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AuctionDetails />
                </Suspense>
              }
            />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
