import { BrowserRouter } from "react-router-dom";
import { Router } from "./routes/Router";
import { ToastContextProvider } from "./store/ToastContext";
import { ToastProvider } from "./components/ui/Toast";
import { useEffect, useState } from "react";
import { createVisitor } from "./api/useVisitor";

// P1-SEC-016 — Clé de stockage du consentement RGPD
const CONSENT_KEY = "kcb_analytics_consent";

function App() {
  const [visitor, setVisitor] = useState(null);
  // null = pas encore décidé, true = accepté, false = refusé
  const [consent, setConsent] = useState(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
    return null;
  });

  // P1-SEC-016 — Tracking visiteur déclenché seulement après consentement explicite
  useEffect(() => {
    if (consent !== true) return;

    const addVisitor = async () => {
      let ipAddress = "";
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        ipAddress = data.ip;
      } catch {
        ipAddress = "Unknown";
      }
      const visitorData = {
        ipAddress,
        userAgent: navigator.userAgent,
        pageVisited: window.location.pathname,
        referrer: document.referrer || "Direct",
        sessionId: "session-" + Math.random().toString(36).substring(2, 15),
      };
      try {
        const newVisitor = await createVisitor(visitorData);
        setVisitor(newVisitor);
      } catch {}
    };

    addVisitor();
  }, [consent]);

  useEffect(() => {
    if (visitor?._id) {
      const startTime = Date.now();
      const updateVisitTime = async () => {
        const duration = Math.round((Date.now() - startTime) / 60000);
        await setVisitTime({ sessionId: visitor.sessionId, visitTime: duration });
      };
      window.addEventListener("beforeunload", updateVisitTime);
      return () => window.removeEventListener("beforeunload", updateVisitTime);
    }
  }, [visitor]);

  useEffect(() => {
    window.scrollTo(0, 0);

    const handleContextMenu = (e) => e.preventDefault();
    const handleCut       = (e) => e.preventDefault();
    const handleDrag      = (e) => e.preventDefault();
    const handlePrint     = (e) => { e.preventDefault(); return false; };
    const handleKeyDown   = (e) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key)) ||
        (e.ctrlKey && e.key === "U") ||
        e.key === "PrintScreen"
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("cut", handleCut);
    document.addEventListener("dragstart", handleDrag);
    window.addEventListener("beforeprint", handlePrint);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("dragstart", handleDrag);
      window.removeEventListener("beforeprint", handlePrint);
    };
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, "true");
    setConsent(true);
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, "false");
    setConsent(false);
  };

  return (
    <>
      <ToastProvider>
        <ToastContextProvider>
          <BrowserRouter>
            <Router />
          </BrowserRouter>
        </ToastContextProvider>
      </ToastProvider>

      {/* P1-SEC-016 — Bandeau de consentement RGPD (affiché tant que l'utilisateur n'a pas décidé) */}
      {consent === null && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Consentement cookies et mesure d'audience"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#1a1a1a",
            color: "#f5f5f5",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            zIndex: 9999,
            fontSize: "14px",
            lineHeight: "1.5",
            boxShadow: "0 -2px 8px rgba(0,0,0,0.4)",
          }}
        >
          <p style={{ margin: 0, flex: "1 1 300px" }}>
            Nous utilisons des cookies d'analyse pour mesurer l'audience du site
            (adresse IP, pages visitées). Conformément au RGPD, votre
            consentement est requis avant toute collecte.{" "}
            <a
              href="/politique-de-confidentialite"
              style={{ color: "#c9a84c", textDecoration: "underline" }}
            >
              En savoir plus
            </a>
          </p>
          <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
            <button
              onClick={handleDecline}
              style={{
                padding: "8px 18px",
                background: "transparent",
                border: "1px solid #888",
                color: "#ccc",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Refuser
            </button>
            <button
              onClick={handleAccept}
              style={{
                padding: "8px 18px",
                background: "#c9a84c",
                border: "none",
                color: "#1a1a1a",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "13px",
              }}
            >
              Accepter
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
