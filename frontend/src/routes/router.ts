import { createBrowserRouter, type RouteObject } from 'react-router';

// Pages load with route-level lazy so each feature gets its own chunk (SDS 9.1, SA-35).
export const routes: RouteObject[] = [
  { path: '/', lazy: () => import('./home') },
  { path: '*', lazy: () => import('./not-found') },
];

export const createRouter = () => createBrowserRouter(routes);
