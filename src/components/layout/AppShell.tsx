import { NavLink, Outlet } from 'react-router-dom';
import { ToastHost } from '../ui/Toast';

/**
 * App shell — design §7 (nav desktop) & §6 (bottom nav mobile).
 * Rute: Home · Library · Collections · Badges · Settings.
 */
const NAV = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/library', label: 'Library', icon: '▦' },
  { to: '/collections', label: 'Collections', icon: '❐' },
  { to: '/badges', label: 'Badges', icon: '◈' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
] as const;

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* NFR-06 — lompat ke konten untuk pengguna keyboard/screen reader */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-bg"
      >
        Lompat ke konten
      </a>

      {/* nav desktop — design §7 */}
      <header className="sticky top-0 z-40 hidden border-b border-hairline bg-bg/85 backdrop-blur-glass md:block">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-6 px-6">
          <NavLink to="/" className="font-display text-base font-bold tracking-editorial">
            Manhwa<span className="text-brand">Library</span>
          </NavLink>
          <nav className="flex items-center gap-1" aria-label="Navigasi utama">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm transition-colors duration-fast ${
                    isActive
                      ? 'bg-elevated text-text-primary'
                      : 'text-text-secondary hover:bg-elevated/60 hover:text-text-primary'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-28 pt-4 md:px-6 md:pb-10"
      >
        <Outlet />
      </main>

      {/* bottom nav mobile — design §6 */}
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-glass md:hidden"
      >
        <div className="flex items-stretch">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors duration-fast ${
                  isActive ? 'text-brand' : 'text-text-muted'
                }`
              }
            >
              <span aria-hidden className="text-lg leading-none">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <ToastHost />
    </div>
  );
}
