// P3-PERF-007 — Lecture dynamique du token à chaque accès via getter
// P4-META-002 — À préférer : apiHelper.js (buildOptions + callApi)
//
// ATTENTION : `const { options } = utils` (destructuring au niveau module)
// évalue le getter UNE FOIS → token figé. Toujours utiliser `utils.options`
// ou mieux, migrer vers apiHelper.buildOptions().
export const utils = {
  api: import.meta.env.VITE_API_URL,

  // getter : réévalué à chaque accès via `utils.options`
  // (pas via destructuring `const { options } = utils`)
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

// P4-META-002 — Re-export du helper unifié pour les nouveaux fichiers API
export { buildOptions, callApi, apiUrl } from "./apiHelper";
