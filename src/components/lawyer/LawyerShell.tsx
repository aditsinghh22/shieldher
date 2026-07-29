'use client';

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Gavel,
  LayoutDashboard,
  Loader,
  MessageSquare,
  Moon,
  Settings,
  Sun,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/components/ThemeProvider';
import layoutStyles from '@/app/dashboard/layout.module.css';
import sidebarStyles from '@/components/Sidebar.module.css';
import styles from './LawyerShell.module.css';

type UserRole = 'user' | 'lawyer';

type LawyerShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  badge?: number;
};

function parseRole(value: unknown): UserRole | null {
  if (value === 'lawyer' || value === 'user') return value;
  return null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function getStringField(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return '';
}

export default function LawyerShell({ title, subtitle, children }: LawyerShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [lawyerName, setLawyerName] = useState('Lawyer');
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { theme, toggleTheme } = useTheme();

  const navItems: NavItem[] = useMemo(
    () => [
      { href: '/lawyer/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
      { href: '/lawyer/clients', label: 'Clients', Icon: Users },
      { href: '/lawyer/calendar', label: 'Calendar', Icon: CalendarDays },
      { href: '/lawyer/legal-drafts', label: 'Legal Drafts', Icon: FolderKanban },
      {
        href: '/lawyer/communication',
        label: 'Communication',
        Icon: MessageSquare,
        badge: unreadCount > 0 ? unreadCount : undefined,
      },
      { href: '/lawyer/settings', label: 'Settings', Icon: Settings },
    ],
    [unreadCount]
  );

  useEffect(() => {
    let active = true;

    async function loadUnreadCount() {
      try {
        const res = await fetch('/api/communications/unread', { cache: 'no-store' });
        if (!res.ok) return;
        const payload: unknown = await res.json();
        const nextCount = Number((payload as { unreadCount?: unknown }).unreadCount ?? 0);
        if (active) setUnreadCount(Number.isFinite(nextCount) ? nextCount : 0);
      } catch {
        if (active) setUnreadCount(0);
      }
    }

    void loadUnreadCount();
    const timer = window.setInterval(() => {
      void loadUnreadCount();
    }, 10000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    document.body.dataset.sidebarCollapsed = collapsed ? 'true' : 'false';
    return () => {
      delete document.body.dataset.sidebarCollapsed;
    };
  }, [collapsed]);

  useEffect(() => {
    async function guardLawyerRoute() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/auth');
        return;
      }

      const role = parseRole(user.user_metadata?.role);
      if (role !== 'lawyer') {
        router.replace('/dashboard');
        return;
      }

      const metadata = asObject(user.user_metadata);
      const isCompleted = Boolean(metadata.lawyer_profile_completed);

      if (!isCompleted && pathname !== '/lawyer/onboarding') {
        router.replace('/lawyer/onboarding');
        return;
      }

      if (isCompleted && pathname === '/lawyer/onboarding') {
        router.replace('/lawyer/dashboard');
        return;
      }

      const fullName = getStringField(metadata, 'full_name');
      setLawyerName(fullName || user.email?.split('@')[0] || 'Lawyer');
      setReady(true);
    }

    guardLawyerRoute();
  }, [pathname, router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  if (!ready) {
    return (
      <div className={styles.loadingState}>
        <Loader size={26} className="animate-spin" />
        <span>Preparing workspace...</span>
      </div>
    );
  }

  const resolvedTitle = title.includes('{lawyerName}')
    ? title.replaceAll('{lawyerName}', lawyerName)
    : title;

  return (
    <div className={layoutStyles.layout}>
      <div className={layoutStyles.ambientLayer} aria-hidden="true">
        <div className={layoutStyles.orbA} />
        <div className={layoutStyles.orbB} />
        <div className={layoutStyles.orbC} />
        <div className={layoutStyles.gridGlow} />
        <div className={layoutStyles.noise} />
      </div>

      <aside className={`${sidebarStyles.sidebar} ${collapsed ? sidebarStyles.collapsed : ''}`}>
        <div className={sidebarStyles.top}>
          <Link href="/lawyer/dashboard" className={sidebarStyles.logo}>
            <div className={sidebarStyles.logoIcon}>
              <Image
                src="/logo.png.jpeg"
                alt="ShieldHer Logo"
                width={38}
                height={38}
                className={sidebarStyles.customLogoImage}
              />
            </div>
            {!collapsed && <span className={sidebarStyles.logoText}>ShieldHer</span>}
          </Link>

          <button
            className={sidebarStyles.collapseBtn}
            onClick={() => setCollapsed((current) => !current)}
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className={sidebarStyles.nav}>
          {navItems.map(({ href, label, Icon, badge }) => {
            const active = href === '/lawyer/dashboard' ? pathname === href : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`${sidebarStyles.navItem} ${active ? sidebarStyles.active : ''}`}
              >
                {active && <div className={sidebarStyles.activeIndicator} />}
                <Icon size={20} className={sidebarStyles.navIcon} />
                {!collapsed && (
                  <span className={sidebarStyles.navLabel}>
                    <span>{label}</span>
                    {badge ? (
                      <span className={sidebarStyles.navBadge}>{badge > 99 ? '99+' : badge}</span>
                    ) : null}
                  </span>
                )}
                {collapsed && badge ? (
                  <span className={sidebarStyles.navBadgeCollapsed}>{badge > 99 ? '99+' : badge}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className={sidebarStyles.bottom}>
          <button
            className={sidebarStyles.themeToggle}
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            {!collapsed && <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
          </button>

          <button className={sidebarStyles.profileBtn} onClick={handleSignOut}>
            <div className={sidebarStyles.avatarCircle}>{lawyerName.charAt(0).toUpperCase()}</div>
            {!collapsed && <span>Log Out</span>}
          </button>
        </div>
      </aside>

      <main className={layoutStyles.main}>
        <div className={layoutStyles.shell}>
          <div className={layoutStyles.shellGlow} aria-hidden="true" />
          <div className={layoutStyles.shellInner}>
            <header className={styles.heroSection}>
              <div className={styles.heroContent}>
                <p className={styles.heroLabel}>Lawyer Dashboard</p>
                <h2 className={styles.heroTitle}>{resolvedTitle}</h2>
                <p className={styles.heroSubtitle}>{subtitle}</p>
              </div>
              <div className={styles.heroChip}>
                <Gavel size={16} />
                <span>{lawyerName}</span>
              </div>
            </header>

            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
