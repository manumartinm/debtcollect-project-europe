/** Persisted org selection (see OrgProvider). */
export const VEXOR_ACTIVE_ORG_ID_KEY = "vexor-active-org-id"

/** Legacy key cleared on load — app is light-theme only. */
export const VEXOR_THEME_STORAGE_KEY = "vexor-theme"

/** Call after sign-out so the next login does not reuse a stale org id. */
export function clearClientStorageAfterSignOut() {
  try {
    localStorage.removeItem(VEXOR_ACTIVE_ORG_ID_KEY)
  } catch {
    /* private mode / blocked storage */
  }
}

/** Wipes app keys from localStorage (e.g. “start from zero” in dev). Keeps unrelated keys. */
export function clearAllDebtCollectLocalStorage() {
  try {
    localStorage.removeItem(VEXOR_ACTIVE_ORG_ID_KEY)
    localStorage.removeItem(VEXOR_THEME_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
