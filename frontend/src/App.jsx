import { BrowserRouter } from "react-router-dom";
import { Router } from "./routes/Router";
import { ToastContextProvider } from "./store/ToastContext";
import { ToastProvider } from "./components/ui/Toast";
import { useEffect, useState } from "react";
import { createVisitor } from "./api/useVisitor";

function App() {
  const [visitor, setVisitor] = useState(null);
  useEffect(() => {
    window.scrollTo(0, 0);

    // Prevent right-click context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    // Prevent copy, cut, paste, drag, print, select
    const handleCopy = (e) => e.preventDefault();
    const handleCut = (e) => e.preventDefault();
    const handlePaste = (e) => e.preventDefault();
    const handleDrag = (e) => e.preventDefault();
    const handleSelect = (e) => e.preventDefault();
    const handlePrint = (e) => {
      e.preventDefault();
      return false;
    };

    // Prevent F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U, PrintScreen
    const handleKeyDown = (e) => {
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
    // document.addEventListener('copy', handleCopy);
    document.addEventListener("cut", handleCut);
    // document.addEventListener('paste', handlePaste);
    document.addEventListener("dragstart", handleDrag);
    // document.addEventListener('selectstart', handleSelect);
    window.addEventListener("beforeprint", handlePrint);

    // Visitor tracking
    const addVisitor = async () => {
      let ipAddress = "";
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        ipAddress = data.ip;
      } catch (err) {
        ipAddress = "Unknown";
      }
      const userAgent = navigator.userAgent;
      const pageVisited = window.location.pathname;
      const referrer = document.referrer || "Direct";
      const sessionId =
        "session-" + Math.random().toString(36).substring(2, 15);
      const visitorData = {
        ipAddress,
        userAgent,
        pageVisited,
        referrer,
        sessionId,
      };
      try {
        const newVisitor = await createVisitor(visitorData);
        setVisitor(newVisitor);
      } catch (error) {}
    };
    addVisitor();

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("dragstart", handleDrag);
      document.removeEventListener("selectstart", handleSelect);
      window.removeEventListener("beforeprint", handlePrint);
    };
  }, []);

  useEffect(() => {
    if (visitor?._id) {
      let startTime = Date.now();
      const updateVisitTime = async () => {
        const duration = Math.round((Date.now() - startTime) / 60000);
        await setVisitTime({
          sessionId: visitor.sessionId,
          visitTime: duration,
        });
      };

      window.addEventListener("beforeunload", updateVisitTime);
    }
  }, [visitor]);
  return (
    <>
      <ToastProvider>
        <ToastContextProvider>
          <BrowserRouter>
            <Router />
          </BrowserRouter>
        </ToastContextProvider>
      </ToastProvider>
    </>
  );
}

export default App;
