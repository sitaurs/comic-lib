import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { HomePage } from './pages/HomePage';
import { LibraryPage } from './pages/LibraryPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { BadgesPage } from './pages/BadgesPage';
import { SettingsPage } from './pages/SettingsPage';
import { TitleDetailPage } from './pages/TitleDetailPage';
import { TierViewPage } from './pages/TierViewPage';
import { NotFoundPage } from './pages/NotFoundPage';

// design §7 — rute selaras nav desktop & bottom nav mobile
const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'library/tiers', element: <TierViewPage /> },
      { path: 'title/:id', element: <TitleDetailPage /> },
      { path: 'collections', element: <CollectionsPage /> },
      { path: 'badges', element: <BadgesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
