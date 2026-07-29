'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ArrowRight, Briefcase, FileText, Loader, MapPin, Phone, Scale, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

type UserRole = 'user' | 'lawyer';

function parseRole(value: unknown): UserRole | null {
  if (value === 'lawyer' || value === 'user') return value;
  return null;
}

function getProfileValue(value: unknown, key: string): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const profile = value as Record<string, unknown>;
  const field = profile[key];
  if (typeof field === 'number') return String(field);
  if (typeof field === 'string') return field;
  return '';
}

export default function LawyerOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [barCouncilId, setBarCouncilId] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [officeCity, setOfficeCity] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [shortBio, setShortBio] = useState('');

  useEffect(() => {
    async function guardAndPrefill() {
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

      if (user.user_metadata?.lawyer_profile_completed) {
        router.replace('/lawyer/dashboard');
        return;
      }

      const existingProfile = user.user_metadata?.lawyer_profile;
      setBarCouncilId(getProfileValue(existingProfile, 'bar_council_id'));
      setSpecialization(getProfileValue(existingProfile, 'specialization'));
      setYearsExperience(getProfileValue(existingProfile, 'years_of_experience'));
      setOfficeCity(getProfileValue(existingProfile, 'office_city'));
      setContactNumber(
        getProfileValue(existingProfile, 'contact_number') ||
          (typeof user.user_metadata?.phone === 'string' ? user.user_metadata.phone : '')
      );
      setShortBio(getProfileValue(existingProfile, 'short_bio'));

      setLoading(false);
    }

    guardAndPrefill();
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    const trimmedBarCouncilId = barCouncilId.trim();
    const trimmedSpecialization = specialization.trim();
    const trimmedOfficeCity = officeCity.trim();
    const trimmedContactNumber = contactNumber.trim();
    const trimmedShortBio = shortBio.trim();
    const experienceNumber = Number(yearsExperience);

    if (!trimmedBarCouncilId || !trimmedSpecialization || !trimmedOfficeCity || !trimmedContactNumber) {
      setError('Please fill in all required fields.');
      setSaving(false);
      return;
    }

    if (!Number.isFinite(experienceNumber) || experienceNumber < 0 || experienceNumber > 70) {
      setError('Years of experience must be between 0 and 70.');
      setSaving(false);
      return;
    }

    if (trimmedShortBio.length > 500) {
      setError('Short bio must be 500 characters or fewer.');
      setSaving(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      router.replace('/auth');
      return;
    }

    const currentMetadata =
      user.user_metadata && typeof user.user_metadata === 'object' && !Array.isArray(user.user_metadata)
        ? (user.user_metadata as Record<string, unknown>)
        : {};

    const lawyerProfile = {
      bar_council_id: trimmedBarCouncilId,
      specialization: trimmedSpecialization,
      years_of_experience: experienceNumber,
      office_city: trimmedOfficeCity,
      contact_number: trimmedContactNumber,
      short_bio: trimmedShortBio,
    };

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        ...currentMetadata,
        role: 'lawyer',
        lawyer_profile_completed: true,
        lawyer_profile: lawyerProfile,
      },
    });

    if (updateError) {
      setError(updateError.message || 'Could not save lawyer profile details.');
      setSaving(false);
      return;
    }

    router.replace('/lawyer/dashboard');
    router.refresh();
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Loader size={28} className="animate-spin" />
        <span>Preparing your profile setup...</span>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.badge}>
            <ShieldCheck size={16} />
            Lawyer Verification
          </div>
          <h1 className={styles.title}>Complete Your Lawyer Profile</h1>
          <p className={styles.subtitle}>
            Add your professional details to continue to your lawyer dashboard.
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="barCouncilId">Bar Council ID</label>
            <div className={styles.inputWrap}>
              <Scale size={16} className={styles.inputIcon} />
              <input
                id="barCouncilId"
                type="text"
                className={`input ${styles.inputWithIcon}`}
                value={barCouncilId}
                onChange={(event) => setBarCouncilId(event.target.value)}
                placeholder="Enter your registration ID"
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="specialization">Primary Specialization</label>
            <div className={styles.inputWrap}>
              <Briefcase size={16} className={styles.inputIcon} />
              <select
                id="specialization"
                className={`input ${styles.inputWithIcon}`}
                value={specialization}
                onChange={(event) => setSpecialization(event.target.value)}
                required
              >
                <option value="">Select specialization</option>
                <option value="Family Law">Family Law</option>
                <option value="Criminal Law">Criminal Law</option>
                <option value="Civil Litigation">Civil Litigation</option>
                <option value="Cyber Law">Cyber Law</option>
                <option value="Women and Child Rights">Women and Child Rights</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="yearsExperience">Years of Experience</label>
              <input
                id="yearsExperience"
                type="number"
                min={0}
                max={70}
                className="input"
                value={yearsExperience}
                onChange={(event) => setYearsExperience(event.target.value)}
                placeholder="e.g. 6"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="officeCity">Office City</label>
              <div className={styles.inputWrap}>
                <MapPin size={16} className={styles.inputIcon} />
                <input
                  id="officeCity"
                  type="text"
                  className={`input ${styles.inputWithIcon}`}
                  value={officeCity}
                  onChange={(event) => setOfficeCity(event.target.value)}
                  placeholder="e.g. Delhi"
                  required
                />
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="contactNumber">Contact Number</label>
            <div className={styles.inputWrap}>
              <Phone size={16} className={styles.inputIcon} />
              <input
                id="contactNumber"
                type="tel"
                className={`input ${styles.inputWithIcon}`}
                value={contactNumber}
                onChange={(event) => setContactNumber(event.target.value)}
                placeholder="Enter phone number"
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="shortBio">Add Short Bio</label>
            <div className={styles.inputWrap}>
              <FileText size={16} className={styles.inputIconTop} />
              <textarea
                id="shortBio"
                className={`input ${styles.inputWithIcon} ${styles.textarea}`}
                value={shortBio}
                onChange={(event) => setShortBio(event.target.value)}
                placeholder="Write a short professional bio (optional)"
                maxLength={500}
              />
            </div>
            <p className={styles.counter}>{shortBio.length}/500</p>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? (
              <>
                <Loader size={18} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save and Continue
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
