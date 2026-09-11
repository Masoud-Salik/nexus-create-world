import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const root = document.getElementById("root")!;

/**
 * If the backend config is missing from the build, the Supabase client throws
 * during module init and the user sees a blank page. Show a readable message
 * (and clear stale service-worker caches) instead of nothing.
 */
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
  root.innerHTML = `
    <div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:2rem;text-align:center;font-family:system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5">
      <div>
        <h1 style="font-size:1.25rem;margin-bottom:.5rem">StudyTime is updating</h1>
        <p style="opacity:.7;font-size:.9rem">This build is missing its backend configuration. Please reload in a moment.</p>
      </div>
    </div>`;
} else {
  createRoot(root).render(<App />);
}
