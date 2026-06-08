import {
  PushNotifications,
  type Token,
  type ActionPerformed,
  type PushNotificationSchema,
} from '@capacitor/push-notifications'
import { LocalNotifications } from '@capacitor/local-notifications'

export async function requestPermission(): Promise<boolean> {
  const result = await PushNotifications.requestPermissions()
  return result.receive === 'granted'
}

export async function registerDevice(): Promise<string> {
  await PushNotifications.register()

  return new Promise<string>((resolve, reject) => {
    const registrationHandler = PushNotifications.addListener(
      'registration',
      (token: Token) => {
        registrationHandler.then((l) => l.remove()).catch(() => undefined)
        resolve(token.value)
      },
    )

    PushNotifications.addListener('registrationError', (err: { error: string }) => {
      reject(new Error(err.error))
    }).catch(reject)
  })
}

export function onNotificationReceived(
  callback: (notification: PushNotificationSchema) => void,
): () => void {
  let listenerHandle: Awaited<ReturnType<typeof PushNotifications.addListener>> | null = null

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    callback(notification)
  })
    .then((handle) => {
      listenerHandle = handle
    })
    .catch(() => undefined)

  return () => {
    listenerHandle?.remove()
  }
}

export function onNotificationActionPerformed(
  callback: (action: ActionPerformed) => void,
): () => void {
  let listenerHandle: Awaited<ReturnType<typeof PushNotifications.addListener>> | null = null

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    callback(action)
  })
    .then((handle) => {
      listenerHandle = handle
    })
    .catch(() => undefined)

  return () => {
    listenerHandle?.remove()
  }
}

export async function sendLocalNotification(title: string, body: string): Promise<void> {
  const permResult = await LocalNotifications.requestPermissions()
  if (permResult.display !== 'granted') return

  await LocalNotifications.schedule({
    notifications: [
      {
        id: Date.now(),
        title,
        body,
        schedule: { at: new Date(Date.now() + 100) },
      },
    ],
  })
}
