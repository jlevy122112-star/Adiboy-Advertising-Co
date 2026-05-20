// Cross-platform browser/webview launcher.
// On Capacitor mobile, swap to: import { Browser } from '@capacitor/browser'
// and replace openPopup with Browser.open({ url, windowName: '_blank' })

export interface PopupOptions {
  width?: number
  height?: number
}

export function openPopup(url: string, name = 'oauth', opts: PopupOptions = {}): Window | null {
  const w = opts.width ?? 520
  const h = opts.height ?? 680
  const left = Math.round(window.screenX + (window.outerWidth - w) / 2)
  const top = Math.round(window.screenY + (window.outerHeight - h) / 2)
  return window.open(url, name, `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`)
}

export function openExternal(url: string): void {
  // Capacitor swap: Browser.open({ url })
  window.open(url, '_blank', 'noopener,noreferrer')
}
