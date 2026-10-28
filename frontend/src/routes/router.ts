import { createBrowserRouter, type RouteObject } from 'react-router';
import { HydrateFallback } from './hydrate-fallback';

// Pages load with route-level lazy so each feature gets its own chunk (SDS 9.1, SA-35). The
// pathless root route carries the fallback shown while the first lazy route loads.
export const routes: RouteObject[] = [
  {
    HydrateFallback,
    children: [
      { path: '/', lazy: () => import('./home') },
      { path: '*', lazy: () => import('./not-found') },
    ],
  },
];

export const createRouter = () => createBrowserRouter(routes);
