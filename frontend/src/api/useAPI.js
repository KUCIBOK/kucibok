// P3-PERF-007 — Lecture dynamique du token à chaque appel
// (avant : token lu à l'init du module → null si login après chargement)
export const utils = {
  api: import.meta.env.VITE_API_URL,

  // `options` est maintenant un getter : réévalué à chaque accès
  get options() {
    return {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "kcb-api-key": import.meta.env.VITE_API_KEY,
        Accept: "*/*",
        "Access-Control-Allow-Origin": "*",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    };
  },
};
