import { createBrowserRouter, redirect, type RouteObject } from 'react-router';
import { guestOnlyLoader, requireAuthLoader, rootLoader } from './guards';
import { HydrateFallback } from './hydrate-fallback';

// Pages load with route-level lazy so each feature gets its own chunk (SDS 9.1, SA-35). The
// pathless root route restores the session first and shows the fallback meanwhile.
export const routes: RouteObject[] = [
  {
    loader: rootLoader,
    HydrateFallback,
    children: [
      { path: '/', loader: () => redirect('/notes') },
      {
        id: 'guest-only',
        loader: guestOnlyLoader,
        lazy: () => import('./auth-layout'),
        children: [
          { path: '/login', lazy: () => import('@/features/auth/pages/login-page') },
          { path: '/register', lazy: () => import('@/features/auth/pages/register-page') },
          {
            path: '/forgot-password',
            lazy: () => import('@/features/auth/pages/forgot-password-page'),
          },
          {
            path: '/reset-password',
            lazy: () => import('@/features/auth/pages/reset-password-page'),
          },
        ],
      },
      {
        id: 'require-auth',
        loader: requireAuthLoader,
        lazy: () => import('./app-shell'),
        children: [
          { path: '/notes', lazy: () => import('@/features/notes/pages/notes-page') },
          { path: '/notes/trash', lazy: () => import('@/features/trash/pages/trash-page') },
        ],
      },
      { path: '*', lazy: () => import('./not-found') },
    ],
  },
];

export const createRouter = () => createBrowserRouter(routes);
