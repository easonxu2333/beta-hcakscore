import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Judge } from '../types';
import useDeviceMode from '../hooks/useDeviceMode';

interface Props {
  judge: Judge | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function Layout({ judge, onLogout, children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile, deviceLabel } = useDeviceMode();
  const navLinks = [
    { to: '/projects', label: 'Judge', short: 'Judge' },
    { to: '/submit', label: 'Submit Project', short: 'Submit' },
    { to: '/leaderboard', label: 'Leaderboard', short: 'Board' },
    { to: '/admin', label: 'Organizer', short: 'Admin' },
  ];

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div
      data-device={isMobile ? 'mobile' : 'desktop'}
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.14),_transparent_25%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.10),_transparent_28%),linear-gradient(180deg,_#fffdf7_0%,_#f5f7fb_100%)] text-slate-900"
    >
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <Link to={judge ? '/projects' : '/login'} className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_10px_30px_rgba(15,23,42,0.18)]">
              HS
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[0.24em] text-teal-700 uppercase">BETA HackScore</div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Live judging operations</span>
                <span className="badge pill-muted hidden sm:inline-flex">{deviceLabel}</span>
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 md:flex">
            {navLinks.map((link) => {
              const active = location.pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {judge ? (
              <>
                <div className="hidden text-right sm:block">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Judge</div>
                  <div className="text-sm font-semibold text-slate-900">{judge?.name}</div>
                </div>
                <button onClick={handleLogout} className="btn-secondary px-4 py-2 text-sm">
                  Log out
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="badge pill-muted sm:hidden">{deviceLabel}</span>
                <Link to="/login" className="btn-secondary px-3 py-2 text-sm sm:px-4">Judge</Link>
                <Link to="/submit" className="btn-primary px-3 py-2 text-sm sm:px-4">Submit</Link>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200/70 bg-white/80 md:hidden">
          <div className="mx-auto flex max-w-7xl gap-2 px-4 py-2">
            {navLinks.map((link) => {
              const active = location.pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex-1 rounded-2xl px-3 py-2 text-center text-sm font-medium transition ${
                    active ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600'
                  }`}
                >
                  {link.short}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
