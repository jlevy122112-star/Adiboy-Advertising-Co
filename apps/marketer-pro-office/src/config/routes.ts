export const ROUTES = {
  SPLASH: '/',
  ONBOARDING: '/onboarding',
  LOGIN: '/login',
  SIGNUP: '/signup',
  DESK: '/desk',
  WHITEBOARD: '/whiteboard',
  CALENDAR: '/calendar',
  DEPARTMENTS: '/departments',
  DEPARTMENT: '/departments/:platform',
  ANALYTICS: '/analytics',
  SETTINGS: '/settings',
  BRAND_SETUP: '/brand-setup',
  PAYWALL: '/paywall',
} as const

export type Route = (typeof ROUTES)[keyof typeof ROUTES]
