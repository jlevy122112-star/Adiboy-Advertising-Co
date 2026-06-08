import { useState, useEffect, useRef } from 'react'
import { useAppDispatch } from '@/store'
import { addToast } from '@/store/slices/uiSlice'

export function useOffline() {
  const dispatch = useAppDispatch()
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)
  const initialMount = useRef(true)

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      if (!initialMount.current) {
        setWasOffline(true)
        dispatch(addToast({
          id: `online-${Date.now()}`,
          message: 'Back online. Your changes will sync.',
          variant: 'success',
          duration: 4000,
        }))
      }
    }

    function handleOffline() {
      setIsOnline(false)
      initialMount.current = false
      dispatch(addToast({
        id: `offline-${Date.now()}`,
        message: 'No internet connection. Working in offline mode.',
        variant: 'warning',
        duration: 6000,
      }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    initialMount.current = false

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [dispatch])

  return { isOnline, wasOffline }
}
