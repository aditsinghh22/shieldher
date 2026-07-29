'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

type ThemeToggleProps = {
  className: string;
  switchToDark: string;
  switchToLight: string;
};

export default function ThemeToggle({ className, switchToDark, switchToLight }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className={className}
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title={theme === 'light' ? switchToDark : switchToLight}
      type="button"
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
