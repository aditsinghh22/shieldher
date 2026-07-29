'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X, Sun, Moon, Globe } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useLanguage } from './LanguageProvider';
import styles from './Navbar.module.css';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, availableLanguages } = useLanguage();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isDashboard = pathname?.startsWith('/dashboard');

  if (isDashboard) return null;

  return (
    <nav className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.logo}>
          <div className={styles.logoIcon}>
            <Image src="/logo.png.jpeg" alt="ShieldHer Logo" width={32} height={32} style={{ objectFit: 'contain' }} />
          </div>
          <span className={styles.logoText}>ShieldHer</span>
        </Link>

        <div className={`${styles.links} ${menuOpen ? styles.open : ''}`}>
          <Link href="/#features" className={styles.link} onClick={() => setMenuOpen(false)}>
            Features
          </Link>
          <Link href="/#how-it-works" className={styles.link} onClick={() => setMenuOpen(false)}>
            How It Works
          </Link>
          
          <button
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <Link href="/auth" className="btn btn-primary btn-sm" onClick={() => setMenuOpen(false)}>
            Get Started
          </Link>
          
          {/* Language Toggle */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: '8px' }}>
            <button
              onClick={() => setLanguageOpen(!languageOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-primary)' }}
              aria-label="Change Language"
            >
              <Globe size={20} />
            </button>
            {languageOpen && (
              <div style={{ 
                position: 'absolute', top: '100%', right: '0', 
                background: 'var(--bg-card)', border: '1px solid var(--border-color)', 
                borderRadius: '8px', zIndex: 50, marginTop: '8px',
                maxHeight: '300px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                minWidth: '150px'
              }}>
                {availableLanguages.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => { setLanguage(lang.code); setLanguageOpen(false); }}
                    style={{ 
                      display: 'block', width: '100%', padding: '10px 16px', background: 'none', 
                      border: 'none', textAlign: 'left', cursor: 'pointer', 
                      color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)',
                      fontWeight: language === lang.code ? 'bold' : 'normal',
                      fontSize: '14px'
                    }}
                  >
                    {lang.nativeName}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        <button
          className={styles.menuBtn}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </nav>
  );
}
