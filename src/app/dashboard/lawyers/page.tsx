'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  BriefcaseBusiness,
  Loader,
  MapPin,
  Phone,
  Plus,
  Scale,
  Search,
} from 'lucide-react';
import styles from './page.module.css';

type UserRole = 'user' | 'lawyer';

type LawyerDirectoryItem = {
  id: string;
  full_name: string;
  short_bio: string;
  specialization: string;
  office_city: string;
  years_of_experience: string;
  bar_council_id: string;
  contact_number: string;
  joined_at: string;
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

function toText(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return '';
}

function formatJoinDate(dateStr: string) {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getInitials(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return 'L';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

export default function LawyersDirectoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lawyers, setLawyers] = useState<LawyerDirectoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [selectedLawyerId, setSelectedLawyerId] = useState('');
  const [selectedLawyerName, setSelectedLawyerName] = useState('');

  useEffect(() => {
    async function loadLawyers() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/auth');
        return;
      }

      const role = parseRole(user.user_metadata?.role);
      if (role === 'lawyer') {
        router.replace('/lawyer/dashboard');
        return;
      }

      const metadata = asObject(user.user_metadata);
      const metadataLawyerId = toText(metadata.selected_lawyer_id);
      const metadataLawyerName = toText(metadata.selected_lawyer_name);
      if (metadataLawyerId) {
        setSelectedLawyerId(metadataLawyerId);
        setSelectedLawyerName(metadataLawyerName);
      }

      try {
        setLoading(true);
        setError('');
        const res = await fetch('/api/lawyers', { cache: 'no-store' });
        const data: unknown = await res.json();

        if (!res.ok) {
          throw new Error('Failed to fetch lawyers');
        }

        const lawyerList = (data as { lawyers?: LawyerDirectoryItem[] }).lawyers;
        setLawyers(Array.isArray(lawyerList) ? lawyerList : []);
      } catch {
        setError('Could not load lawyers right now. Please try again shortly.');
      } finally {
        setLoading(false);
      }
    }

    loadLawyers();
  }, [router]);

  useEffect(() => {
    const storedId = window.localStorage.getItem('shieldher_selected_lawyer_id');
    const storedName = window.localStorage.getItem('shieldher_selected_lawyer_name');
    if (!storedId) return;

    if (!selectedLawyerId || selectedLawyerId !== storedId) {
      setSelectedLawyerId(storedId);
      if (storedName) setSelectedLawyerName(storedName);
    }

    async function syncStoredSelection() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const metadata = asObject(user.user_metadata);
      if (toText(metadata.selected_lawyer_id) === storedId) return;

      await supabase.auth.updateUser({
        data: {
          ...metadata,
          selected_lawyer_id: storedId,
          selected_lawyer_name: storedName || '',
          selected_lawyer: {
            id: storedId,
            name: storedName || '',
          },
        },
      });
    }

    syncStoredSelection();
  }, [selectedLawyerId]);

  const chooseLawyer = (lawyer: LawyerDirectoryItem) => {
    router.push(`/dashboard/lawyers/${lawyer.id}`);
  };

  const totalLawyers = lawyers.length;

  const cityCount = useMemo(() => {
    const normalizedCities = lawyers
      .map((lawyer) => lawyer.office_city.trim().toLowerCase())
      .filter((city) => city && city !== 'not specified');
    return new Set(normalizedCities).size;
  }, [lawyers]);

  const topSpecialization = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const lawyer of lawyers) {
      const specialization = lawyer.specialization.trim();
      if (!specialization || specialization.toLowerCase() === 'not specified') continue;
      countMap.set(specialization, (countMap.get(specialization) ?? 0) + 1);
    }

    let winner = 'General Legal Practice';
    let winnerCount = 0;
    for (const [specialization, count] of countMap.entries()) {
      if (count > winnerCount) {
        winner = specialization;
        winnerCount = count;
      }
    }

    return winner;
  }, [lawyers]);

  const filteredLawyers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return lawyers;

    return lawyers.filter((lawyer) =>
      [lawyer.full_name, lawyer.specialization, lawyer.office_city, lawyer.bar_council_id]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [lawyers, query]);

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Loader size={28} className="animate-spin" />
        <span>Loading lawyers directory...</span>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>Lawyers Directory</h1>
          <p className={styles.subtitle}>
            Access our curated network of legal professionals dedicated to protection,
            advocacy, and justice.
          </p>
        </div>

        {!error && (
          <div className={styles.highlights}>
            <div className={styles.highlightCard}>
              <strong>{totalLawyers}</strong>
              <span>Total Lawyers</span>
            </div>
            <div className={styles.highlightCard}>
              <strong>{cityCount}</strong>
              <span>Cities Covered</span>
            </div>
            <div className={styles.highlightCard}>
              <strong>{topSpecialization}</strong>
              <span>Top Specialization</span>
            </div>
          </div>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {!error && selectedLawyerName && (
        <div className={styles.selectedStrip}>
          <BadgeCheck size={16} />
          <span>Selected Lawyer: {selectedLawyerName}</span>
        </div>
      )}

      {!error && lawyers.length > 0 && (
        <div className={styles.searchWrap}>
          <div className={styles.searchField}>
            <Search size={18} />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, city, specialization, or bar council ID"
              aria-label="Search lawyers directory"
            />
          </div>
          <button type="button" className={styles.searchBtn}>
            Search
          </button>
        </div>
      )}

      {!error && lawyers.length === 0 ? (
        <div className={styles.empty}>
          <Scale size={42} />
          <h4>No lawyer accounts yet</h4>
          <p>Once lawyers sign up, their profiles will appear here automatically.</p>
        </div>
      ) : !error && filteredLawyers.length === 0 ? (
        <div className={styles.empty}>
          <Search size={40} />
          <h4>No matching lawyers found</h4>
          <p>Try a different keyword in search.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredLawyers.map((lawyer, index) => (
            <article key={lawyer.id} className={styles.card}>
              <div className={`${styles.portrait} ${styles[`tone${(index % 5) + 1}`]}`}>
                <div className={styles.portraitShade} />
                <div className={styles.portraitInitials}>{getInitials(lawyer.full_name)}</div>
                <span className={styles.badge}>
                  {selectedLawyerId === lawyer.id ? 'Selected' : 'Active Practitioner'}
                </span>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.cardTop}>
                  <h4 className={styles.name}>
                    Adv. {lawyer.full_name.replace(/^adv\.?\s*/i, '')}
                  </h4>
                  <span className={styles.joined}>Joined {formatJoinDate(lawyer.joined_at)}</span>
                </div>

                <div className={styles.barIdRow}>
                  <Scale size={14} />
                  <span>BAR ID: {lawyer.bar_council_id}</span>
                </div>

                <div className={styles.metaGrid}>
                  <div className={styles.metaRow}>
                    <span>Specialization</span>
                    <strong>{lawyer.specialization}</strong>
                  </div>
                  <div className={styles.metaRow}>
                    <span>Location</span>
                    <strong>{lawyer.office_city}</strong>
                  </div>
                  <div className={styles.metaRow}>
                    <span>Experience</span>
                    <strong>{lawyer.years_of_experience} Years</strong>
                  </div>
                </div>

                {lawyer.short_bio ? <p className={styles.bio}>{lawyer.short_bio}</p> : null}

                <div className={styles.inlineMeta}>
                  <div className={styles.inlineMetaItem}>
                    <MapPin size={14} />
                    <span>{lawyer.office_city}</span>
                  </div>
                  <div className={styles.inlineMetaItem}>
                    <BriefcaseBusiness size={14} />
                    <span>{lawyer.specialization}</span>
                  </div>
                  <div className={styles.inlineMetaItem}>
                    <Phone size={14} />
                    <span>{lawyer.contact_number}</span>
                  </div>
                </div>

                <div className={styles.actionRow}>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${
                      selectedLawyerId === lawyer.id ? styles.actionBtnSelected : styles.actionBtnPrimary
                    }`}
                    onClick={() => chooseLawyer(lawyer)}
                  >
                    {selectedLawyerId === lawyer.id ? 'View Selected Lawyer' : 'Choose Lawyer'}
                  </button>
                </div>
              </div>
            </article>
          ))}

          <article className={styles.requestCard}>
            <div className={styles.requestIcon}>
              <Plus size={28} />
            </div>
            <h4>Request Consultant</h4>
            <p>Can&apos;t find a specialist? Let our team help you find the right match.</p>
          </article>
        </div>
      )}
    </div>
  );
}
