// Cross-platform async key-value storage.
// Swap implementation body to @capacitor/preferences when adding Capacitor:
//   import { Preferences } from '@capacitor/preferences'
//   export const storageGet = (k) => Preferences.get({ key: k }).then(r => r.value)
//   export const storageSet = (k, v) => Preferences.set({ key: k, value: v })
//   export const storageRemove = (k) => Preferences.remove({ key: k })

const _mem = new Map<string, string>()

function _ls(): Storage | null {
  try {
    const k = '__mp_chk__'
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return localStorage
  } catch {
    return null
  }
}

const _store = typeof window !== 'undefined' ? _ls() : null

export async function storageGet(key: string): Promise<string | null> {
  try {
    if (_store) return _store.getItem(key)
  } catch { /* fall through */ }
  return _mem.get(key) ?? null
}

export async function storageSet(key: string, value: string): Promise<void> {
  try {
    if (_store) { _store.setItem(key, value); return }
  } catch { /* fall through */ }
  _mem.set(key, value)
}

export async function storageRemove(key: string): Promise<void> {
  try {
    if (_store) { _store.removeItem(key); return }
  } catch { /* fall through */ }
  _mem.delete(key)
}

export function storageGetSync(key: string): string | null {
  try {
    if (_store) return _store.getItem(key)
  } catch { /* fall through */ }
  return _mem.get(key) ?? null
}
