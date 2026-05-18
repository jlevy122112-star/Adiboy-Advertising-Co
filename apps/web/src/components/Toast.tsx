import { createContext, useContext, useState, useCallback, useRef } from 'react'

type ToastKind = 'success' | 'error' | 'info' | 'warning'

type Toast = {
  id: string
  message: string
  kind: ToastKind
}

type ToastContextValue = {
  toast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id))
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
  }, [])

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(t => [...t.slice(-4), { id, message, kind }])
    const timer = setTimeout(() => dismiss(id), 4000)
    timers.current.set(id, timer)
  }, [dismiss])

  const colors: Record<ToastKind, string> = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-yellow-500',
    info: 'bg-blue-600',
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`${colors[t.kind]} text-white px-4 py-3 rounded shadow-lg flex items-center gap-3 min-w-64 max-w-sm`}
          >
            <span className="flex-1 text-sm">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-white/70 hover:text-white text-lg leading-none">&times;</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.toast
}
