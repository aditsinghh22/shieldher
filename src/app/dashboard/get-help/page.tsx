'use client';

import { useState, useMemo } from 'react';
import {
  Brain,
  Heart,
  Phone,
  Search,
  Globe,
  Building2,
  HandHeart,
  ExternalLink,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import styles from './page.module.css';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Tab = 'psychiatrists' | 'ngos';

type ProfessionalEntry = {
  id: string;
  name: string;
  specialization: string;
  description: string;
  contact: string;
  contactLabel: string;
  city: string;
};

type NgoEntry = {
  id: string;
  name: string;
  description: string;
  contact: string;
  contactLabel: string;
  website?: string;
  city: string;
};

/* ------------------------------------------------------------------ */
/*  Static Data – Psychiatrists (city-tagged)                          */
/* ------------------------------------------------------------------ */

const psychiatrists: ProfessionalEntry[] = [
  {
    id: 'psy-1',
    name: 'Dr. Anjali Sharma',
    specialization: 'Trauma & PTSD Counselling',
    description:
      'Specializes in trauma recovery for women dealing with harassment, abuse, and domestic violence situations.',
    contact: 'tel:+911234567890',
    contactLabel: '+91 123 456 7890',
    city: 'Delhi',
  },
  {
    id: 'psy-2',
    name: 'Dr. Priya Menon',
    specialization: 'Clinical Psychology',
    description:
      'Expert in anxiety, depression, and emotional resilience building with over 12 years of experience.',
    contact: 'tel:+919876543210',
    contactLabel: '+91 987 654 3210',
    city: 'Mumbai',
  },
  {
    id: 'psy-3',
    name: 'Dr. Kavita Desai',
    specialization: "Women's Mental Health",
    description:
      'Focuses on mental health challenges unique to women including postpartum depression and workplace stress.',
    contact: 'tel:+911122334455',
    contactLabel: '+91 112 233 4455',
    city: 'Bangalore',
  },
  {
    id: 'psy-4',
    name: 'Dr. Rekha Iyer',
    specialization: 'Crisis Intervention',
    description:
      'Provides immediate psychological first aid and crisis support for victims of gender-based violence.',
    contact: 'tel:+918899776655',
    contactLabel: '+91 889 977 6655',
    city: 'Kolkata',
  },
  {
    id: 'psy-5',
    name: 'Dr. Sunita Patel',
    specialization: 'Cognitive Behavioural Therapy',
    description:
      'Employs evidence-based CBT techniques to help survivors manage stress, fear, and emotional recovery.',
    contact: 'tel:+917766554433',
    contactLabel: '+91 776 655 4433',
    city: 'Delhi',
  },
  {
    id: 'psy-6',
    name: 'Dr. Meera Joshi',
    specialization: 'Family & Relationship Therapy',
    description:
      'Specializes in healing family dynamics affected by domestic abuse and interpersonal conflict.',
    contact: 'tel:+916655443322',
    contactLabel: '+91 665 544 3322',
    city: 'Mumbai',
  },
];

/* ------------------------------------------------------------------ */
/*  Static Data – NGOs organized by city                                */
/* ------------------------------------------------------------------ */

const METRO_CITIES = ['Delhi', 'Mumbai', 'Kolkata', 'Bangalore'] as const;
type MetroCity = (typeof METRO_CITIES)[number];

const ngosByCity: Record<MetroCity, NgoEntry[]> = {
  Delhi: [
    {
      id: 'ngo-del-1',
      name: 'Jagori',
      description:
        'A feminist organization working on women safety, education, and combating violence against women since 1984.',
      contact: 'tel:+911126692700',
      contactLabel: '+91 11 2669 2700',
      website: 'https://jagori.org',
      city: 'Delhi',
    },
    {
      id: 'ngo-del-2',
      name: 'Shakti Shalini',
      description:
        'Provides shelter, legal aid, and psychosocial support for women and children survivors of domestic violence.',
      contact: 'tel:+911124373737',
      contactLabel: '+91 11 2437 3737',
      website: 'https://shaktishalini.org',
      city: 'Delhi',
    },
    {
      id: 'ngo-del-3',
      name: 'Action India',
      description:
        'Works at the grassroots level to empower women through legal literacy, health awareness, and skill development.',
      contact: 'tel:+911123782227',
      contactLabel: '+91 11 2378 2227',
      website: 'https://actionindiaworld.org',
      city: 'Delhi',
    },
    {
      id: 'ngo-del-4',
      name: 'Nirmal Niketan',
      description:
        'Offers safe shelter, rehabilitation services, and vocational training for destitute and abused women.',
      contact: 'tel:+911123015872',
      contactLabel: '+91 11 2301 5872',
      city: 'Delhi',
    },
    {
      id: 'ngo-del-5',
      name: 'Women Power Connect',
      description:
        'Advocacy network raising awareness on gender-based violence policies and ensuring women-friendly legislation.',
      contact: 'tel:+911141507415',
      contactLabel: '+91 11 4150 7415',
      website: 'https://womenpowerconnect.org',
      city: 'Delhi',
    },
  ],
  Mumbai: [
    {
      id: 'ngo-mum-1',
      name: 'Majlis Legal Centre',
      description:
        'Provides free legal representation and support to women and children facing violence and discrimination.',
      contact: 'tel:+912226610986',
      contactLabel: '+91 22 2661 0986',
      website: 'https://majlislaw.com',
      city: 'Mumbai',
    },
    {
      id: 'ngo-mum-2',
      name: 'Sneha Foundation',
      description:
        'Offers 24/7 emotional support, crisis intervention, and suicide prevention counselling for women.',
      contact: 'tel:+914424640050',
      contactLabel: '+91 44 2464 0050',
      website: 'https://snehaindia.org',
      city: 'Mumbai',
    },
    {
      id: 'ngo-mum-3',
      name: 'Akshara Centre',
      description:
        'Focuses on sexuality education, ending street harassment, and creating safe public spaces for women.',
      contact: 'tel:+912226614662',
      contactLabel: '+91 22 2661 4662',
      website: 'https://aksharacentre.org',
      city: 'Mumbai',
    },
    {
      id: 'ngo-mum-4',
      name: 'CORO India',
      description:
        'Empowers women from marginalized communities through leadership training, legal aid, and community health programs.',
      contact: 'tel:+912225042505',
      contactLabel: '+91 22 2504 2505',
      website: 'https://coroindia.org',
      city: 'Mumbai',
    },
    {
      id: 'ngo-mum-5',
      name: 'Stree Mukti Sanghatana',
      description:
        "Pioneer women's liberation organization offering domestic violence intervention, legal advice, and crisis support.",
      contact: 'tel:+912224021065',
      contactLabel: '+91 22 2402 1065',
      city: 'Mumbai',
    },
  ],
  Kolkata: [
    {
      id: 'ngo-kol-1',
      name: 'Swayam',
      description:
        'Works on preventing violence against women through legal aid, counselling, and community outreach programs.',
      contact: 'tel:+913340047451',
      contactLabel: '+91 33 4004 7451',
      website: 'https://swayam.info',
      city: 'Kolkata',
    },
    {
      id: 'ngo-kol-2',
      name: 'Sanlaap',
      description:
        'Provides rescue, rehabilitation, and social reintegration for trafficked women and girl children.',
      contact: 'tel:+913324660282',
      contactLabel: '+91 33 2466 0282',
      website: 'https://sanlaap.org',
      city: 'Kolkata',
    },
    {
      id: 'ngo-kol-3',
      name: 'Sanhita',
      description:
        'Offers gender sensitization training, legal support, and counselling for women facing domestic violence.',
      contact: 'tel:+913324854553',
      contactLabel: '+91 33 2485 4553',
      website: 'https://sanhita.org',
      city: 'Kolkata',
    },
    {
      id: 'ngo-kol-4',
      name: 'Jabala Action Research',
      description:
        'Conducts research and action programs to address violence against women, trafficking, and child marriage.',
      contact: 'tel:+913323509854',
      contactLabel: '+91 33 2350 9854',
      city: 'Kolkata',
    },
    {
      id: 'ngo-kol-5',
      name: 'Nishtha',
      description:
        'Grassroots organization empowering rural women through livelihood training, health services, and legal advocacy.',
      contact: 'tel:+913326807625',
      contactLabel: '+91 33 2680 7625',
      city: 'Kolkata',
    },
  ],
  Bangalore: [
    {
      id: 'ngo-blr-1',
      name: 'Vimochana',
      description:
        'Works on crisis intervention and campaigns against dowry harassment, domestic abuse, and violence against women.',
      contact: 'tel:+918025490939',
      contactLabel: '+91 80 2549 0939',
      website: 'https://vimochana.co.in',
      city: 'Bangalore',
    },
    {
      id: 'ngo-blr-2',
      name: 'Hale Kote Women Foundation',
      description:
        'Provides shelter, medical aid, and rehabilitation for women and children rescued from abuse and trafficking.',
      contact: 'tel:+918041234567',
      contactLabel: '+91 80 4123 4567',
      city: 'Bangalore',
    },
    {
      id: 'ngo-blr-3',
      name: 'Parihar',
      description:
        'Runs women helpline and family counselling centre, offering 24/7 support for women facing crises.',
      contact: 'tel:+918022943225',
      contactLabel: '+91 80 2294 3225',
      website: 'https://parihar.org',
      city: 'Bangalore',
    },
    {
      id: 'ngo-blr-4',
      name: 'Samvada',
      description:
        'Empowers young women through life skills education, gender equality workshops, and mental health programs.',
      contact: 'tel:+918026395730',
      contactLabel: '+91 80 2639 5730',
      website: 'https://samvada.org',
      city: 'Bangalore',
    },
    {
      id: 'ngo-blr-5',
      name: 'Enfold Proactive Health Trust',
      description:
        'Conducts child safety and gender-based violence prevention programs with training for organizations and schools.',
      contact: 'tel:+918041502010',
      contactLabel: '+91 80 4150 2010',
      website: 'https://enfoldindia.org',
      city: 'Bangalore',
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return 'H';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

const totalNgos = Object.values(ngosByCity).reduce((s, arr) => s + arr.length, 0);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GetHelpPage() {
  const [activeTab, setActiveTab] = useState<Tab>('psychiatrists');
  const [query, setQuery] = useState('');

  // NGO city state
  const [selectedCity, setSelectedCity] = useState<MetroCity | null>(null);

  /* --- filtered lists --- */

  const filteredPsychiatrists = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return psychiatrists;
    return psychiatrists.filter((p) =>
      [p.name, p.specialization, p.description, p.city].join(' ').toLowerCase().includes(q),
    );
  }, [query]);

  const filteredNgos = useMemo(() => {
    if (!selectedCity) return [];
    const cityNgos = ngosByCity[selectedCity] || [];
    const q = query.trim().toLowerCase();
    if (!q) return cityNgos;
    return cityNgos.filter((n) =>
      [n.name, n.description].join(' ').toLowerCase().includes(q),
    );
  }, [selectedCity, query]);

  /* --- tab switch handler --- */
  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setQuery('');
    if (tab === 'psychiatrists') setSelectedCity(null);
  };

  return (
    <div className={styles.page}>
      {/* ---------- Header ---------- */}
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>Get Help</h1>
          <p className={styles.subtitle}>
            Access psychological support and connect with organizations dedicated
            to protecting and empowering women.
          </p>
        </div>

        <div className={styles.highlights}>
          <div className={styles.highlightCard}>
            <strong>{psychiatrists.length}</strong>
            <span>Mental Health Experts</span>
          </div>
          <div className={styles.highlightCard}>
            <strong>{totalNgos}</strong>
            <span>Support Organizations</span>
          </div>
          <div className={styles.highlightCard}>
            <strong>{METRO_CITIES.length}</strong>
            <span>Metro Cities Covered</span>
          </div>
        </div>
      </div>

      {/* ---------- Toggle ---------- */}
      <div className={styles.toggleWrap}>
        <button
          type="button"
          className={`${styles.toggleBtn} ${activeTab === 'psychiatrists' ? styles.toggleBtnActive : ''}`}
          onClick={() => switchTab('psychiatrists')}
        >
          <Brain size={18} />
          <span>Psychological Support</span>
        </button>
        <button
          type="button"
          className={`${styles.toggleBtn} ${activeTab === 'ngos' ? styles.toggleBtnActive : ''}`}
          onClick={() => switchTab('ngos')}
        >
          <HandHeart size={18} />
          <span>Women Support NGOs</span>
        </button>
      </div>

      {/* ---------- Search ---------- */}
      <div className={styles.searchWrap}>
        <div className={styles.searchField}>
          <Search size={18} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              activeTab === 'psychiatrists'
                ? 'Search by name, specialization, or city'
                : selectedCity
                  ? `Search NGOs in ${selectedCity}`
                  : 'Select a city first to browse NGOs'
            }
            aria-label="Search help resources"
          />
        </div>
        <button type="button" className={styles.searchBtn}>
          Search
        </button>
      </div>

      {/* ============================================================ */}
      {/*  Psychiatrists Tab                                            */}
      {/* ============================================================ */}
      {activeTab === 'psychiatrists' && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <Brain size={22} className={styles.sectionIcon} />
            <div>
              <h2 className={styles.sectionTitle}>Psychological Support</h2>
              <p className={styles.sectionSubtitle}>
                Connect with mental health professionals for emotional and psychological support.
              </p>
            </div>
          </div>

          {filteredPsychiatrists.length === 0 ? (
            <div className={styles.empty}>
              <Search size={40} />
              <h4>No matching professionals found</h4>
              <p>Try a different keyword in search.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {filteredPsychiatrists.map((prof, index) => (
                <article key={prof.id} className={styles.card}>
                  <div className={`${styles.portrait} ${styles[`tone${(index % 5) + 1}`]}`}>
                    <div className={styles.portraitShade} />
                    <div className={styles.portraitInitials}>{getInitials(prof.name)}</div>
                    <span className={styles.badge}>
                      <Heart size={10} style={{ marginRight: 4 }} />
                      Professional
                    </span>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}>
                      <h4 className={styles.name}>{prof.name}</h4>
                    </div>

                    <div className={styles.barIdRow}>
                      <Brain size={14} />
                      <span>{prof.specialization}</span>
                    </div>

                    <div className={styles.metaGrid}>
                      <div className={styles.metaRow}>
                        <span>Specialization</span>
                        <strong>{prof.specialization}</strong>
                      </div>
                      <div className={styles.metaRow}>
                        <span>Location</span>
                        <strong>{prof.city}</strong>
                      </div>
                      <div className={styles.metaRow}>
                        <span>Contact</span>
                        <strong>{prof.contactLabel}</strong>
                      </div>
                    </div>

                    <p className={styles.bio}>{prof.description}</p>

                    <div className={styles.inlineMeta}>
                      <div className={styles.inlineMetaItem}>
                        <MapPin size={14} />
                        <span>{prof.city}</span>
                      </div>
                      <div className={styles.inlineMetaItem}>
                        <Phone size={14} />
                        <span>{prof.contactLabel}</span>
                      </div>
                    </div>

                    <div className={styles.actionRow}>
                      <a
                        href={prof.contact}
                        className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                      >
                        <Phone size={16} />
                        <span>Reach Out</span>
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ============================================================ */}
      {/*  NGOs Tab                                                     */}
      {/* ============================================================ */}
      {activeTab === 'ngos' && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <HandHeart size={22} className={styles.sectionIcon} />
            <div>
              <h2 className={styles.sectionTitle}>Women Support NGOs</h2>
              <p className={styles.sectionSubtitle}>
                Select your city to find organizations dedicated to helping women in your area.
              </p>
            </div>
          </div>

          {/* --- City Selector --- */}
          <div className={styles.cityGrid}>
            {METRO_CITIES.map((city) => (
              <button
                key={city}
                type="button"
                className={`${styles.cityCard} ${selectedCity === city ? styles.cityCardActive : ''}`}
                onClick={() => {
                  setSelectedCity(city);
                  setQuery('');
                }}
              >
                <div className={styles.cityCardIcon}>
                  <MapPin size={22} />
                </div>
                <div className={styles.cityCardBody}>
                  <strong>{city}</strong>
                  <span>{ngosByCity[city].length} Organizations</span>
                </div>
                <ChevronRight size={18} className={styles.cityChevron} />
              </button>
            ))}
          </div>

          {/* --- NGO cards for selected city --- */}
          {!selectedCity ? (
            <div className={styles.empty}>
              <MapPin size={40} />
              <h4>Select a city above</h4>
              <p>Choose a metro city to view available NGOs and support organizations.</p>
            </div>
          ) : filteredNgos.length === 0 ? (
            <div className={styles.empty}>
              <Search size={40} />
              <h4>No matching organizations found</h4>
              <p>Try a different keyword in search.</p>
            </div>
          ) : (
            <>
              <div className={styles.selectedStrip}>
                <MapPin size={16} />
                <span>Showing {filteredNgos.length} organizations in {selectedCity}</span>
              </div>
              <div className={styles.grid}>
                {filteredNgos.map((ngo, index) => (
                  <article key={ngo.id} className={styles.card}>
                    <div className={`${styles.portrait} ${styles[`tone${(index % 5) + 1}`]}`}>
                      <div className={styles.portraitShade} />
                      <div className={styles.portraitInitials}>{getInitials(ngo.name)}</div>
                      <span className={styles.badge}>
                        <Building2 size={10} style={{ marginRight: 4 }} />
                        Organization
                      </span>
                    </div>

                    <div className={styles.cardBody}>
                      <div className={styles.cardTop}>
                        <h4 className={styles.name}>{ngo.name}</h4>
                      </div>

                      <div className={styles.barIdRow}>
                        <HandHeart size={14} />
                        <span>Support Organization</span>
                      </div>

                      <div className={styles.metaGrid}>
                        <div className={styles.metaRow}>
                          <span>Location</span>
                          <strong>{ngo.city}</strong>
                        </div>
                        <div className={styles.metaRow}>
                          <span>Contact</span>
                          <strong>{ngo.contactLabel}</strong>
                        </div>
                        {ngo.website && (
                          <div className={styles.metaRow}>
                            <span>Website</span>
                            <strong className={styles.websiteLink}>
                              <Globe size={12} />
                              {new URL(ngo.website).hostname}
                            </strong>
                          </div>
                        )}
                      </div>

                      <p className={styles.bio}>{ngo.description}</p>

                      <div className={styles.inlineMeta}>
                        <div className={styles.inlineMetaItem}>
                          <MapPin size={14} />
                          <span>{ngo.city}</span>
                        </div>
                        <div className={styles.inlineMetaItem}>
                          <Phone size={14} />
                          <span>{ngo.contactLabel}</span>
                        </div>
                        {ngo.website && (
                          <div className={styles.inlineMetaItem}>
                            <Globe size={14} />
                            <span>{new URL(ngo.website).hostname}</span>
                          </div>
                        )}
                      </div>

                      <div className={styles.actionRow}>
                        <a
                          href={ngo.contact}
                          className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                        >
                          <Phone size={16} />
                          <span>Reach Out</span>
                        </a>
                        {ngo.website && (
                          <a
                            href={ngo.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                          >
                            <ExternalLink size={16} />
                            <span>Visit Website</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
