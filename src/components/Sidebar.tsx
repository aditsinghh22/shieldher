"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  History,
  FileDown,
  Settings,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "./ThemeProvider";
import styles from "./Sidebar.module.css";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/upload", icon: Upload, label: "Upload" },
  { href: "/dashboard/history", icon: History, label: "History" },
  { href: "/dashboard/downloads", icon: FileDown, label: "Downloads" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    document.body.dataset.sidebarCollapsed = collapsed ? "true" : "false";
    return () => {
      delete document.body.dataset.sidebarCollapsed;
    };
  }, [collapsed]);
  const { theme, toggleTheme } = useTheme();
  const [initial, setInitial] = useState("U");

  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const name = user.user_metadata?.full_name || user.email || "User";
        setInitial(name.charAt(0).toUpperCase());
      }
    }
    getUser();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.top}>
        <Link href="/" className={styles.logo}>
          <div className={styles.logoIcon}>
            <Image 
              src="/logo.png.jpeg"
              alt="ShieldHer Logo"
              width={38}
              height={38}
              className={styles.customLogoImage}
            />
          </div>
          {!collapsed && <span className={styles.logoText}>ShieldHer</span>}
        </Link>

        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ""}`}
            >
              {isActive && <div className={styles.activeIndicator} />}
              <item.icon size={20} className={styles.navIcon} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={styles.bottom}>
        <button
          className={styles.themeToggle}
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={
            theme === "light" ? "Switch to dark mode" : "Switch to light mode"
          }
        >
          {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
          {!collapsed && (
            <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
          )}
        </button>
        <button className={styles.profileBtn} onClick={handleLogout}>
          <div className={styles.avatarCircle}>{initial}</div>
          {!collapsed && <span>Log Out</span>}
        </button>
      </div>
    </aside>
  );
}
