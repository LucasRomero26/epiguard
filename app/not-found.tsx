import type { Metadata } from 'next';
import Link from 'next/link';
import { Map, LineChart, BarChart3 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'The page you are looking for does not exist or has been moved.',
};

const LINKS = [
  { href: '/', label: 'Risk Map', icon: Map },
  { href: '/predictions', label: 'Predictions', icon: LineChart },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-6">
      <div className="glass-card rounded-2xl p-10 max-w-lg w-full text-center">
        <p className="text-6xl font-bold tabular-nums text-cyan-500">404</p>
        <h1 className="mt-4 text-2xl font-bold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you are looking for does not exist or has been moved. Try one of the EpiGuard views below.
        </p>
        <nav aria-label="EpiGuard views" className="mt-8 flex flex-wrap justify-center gap-2">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-white/15 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
