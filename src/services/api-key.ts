// ──────────────────────────────────────────────────────────
// API Key management
//
// Stores the API key in localStorage and provides a
// promise-based mechanism to request it via a modal
// when it's missing or invalid.
// ──────────────────────────────────────────────────────────

const STORAGE_KEY = "ranobe_api_key";
const isBrowser = typeof window !== "undefined";

let pendingResolver: ((value: string) => void) | null = null;
let pendingRejecter: ((reason: unknown) => void) | null = null;
let modalOpen = false;

// Callback to notify the modal component
let onModalChange: ((open: boolean) => void) | null = null;

export function setModalCallback(cb: (open: boolean) => void): void {
  onModalChange = cb;
}

/**
 * Returns the stored API key, or null if none exists.
 */
export function getStoredApiKey(): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Saves the API key to localStorage.
 */
export function setStoredApiKey(key: string): void {
  if (!isBrowser) return;
  localStorage.setItem(STORAGE_KEY, key);
}

/**
 * Clears the stored API key (e.g. on auth error).
 */
export function clearStoredApiKey(): void {
  if (!isBrowser) return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Opens the API key modal and returns a promise that resolves
 * with the key the user entered, or rejects if cancelled.
 */
export function requestApiKey(): Promise<string> {
  // If there's already a pending request, return that promise
  if (pendingResolver) {
    return new Promise<string>((resolve, reject) => {
      // Queue behind the existing resolver
      const origResolve = pendingResolver!;
      const origReject = pendingRejecter!;
      pendingResolver = (value: string) => {
        origResolve(value);
        resolve(value);
      };
      pendingRejecter = (reason: unknown) => {
        origReject(reason);
        reject(reason);
      };
    });
  }

  modalOpen = true;
  onModalChange?.(true);

  return new Promise<string>((resolve, reject) => {
    pendingResolver = resolve;
    pendingRejecter = reject;
  });
}

/**
 * Called by the modal when the user submits a key.
 */
export function submitApiKey(key: string): void {
  setStoredApiKey(key);
  modalOpen = false;
  onModalChange?.(false);
  const resolver = pendingResolver;
  pendingResolver = null;
  pendingRejecter = null;
  resolver?.(key);
}

/**
 * Called by the modal when the user cancels.
 */
export function cancelApiKey(): void {
  modalOpen = false;
  onModalChange?.(false);
  const rejecter = pendingRejecter;
  pendingResolver = null;
  pendingRejecter = null;
  rejecter?.(new Error("API key entry cancelled"));
}

/**
 * Returns whether the modal is currently open.
 */
export function isModalOpen(): boolean {
  return modalOpen;
}

/**
 * Resolves the API key: returns stored key if present,
 * otherwise requests it from the user via modal.
 * Throws if called during SSR without a stored key.
 */
export async function resolveApiKey(): Promise<string> {
  const stored = getStoredApiKey();
  if (stored && stored.trim().length > 0) {
    return stored.trim();
  }
  // On the server, we can't open the modal — throw instead of hanging
  if (!isBrowser) {
    throw new Error("API key is required but not available during SSR");
  }
  // No key stored → ask the user
  return requestApiKey();
}
