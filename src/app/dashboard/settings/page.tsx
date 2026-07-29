'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  User,
  Mail,
  Shield,
  LogOut,
  Save,
  Loader,
  Ghost,
  ArrowLeft,
  Scale,
  Briefcase,
  FileText,
  MapPin,
  Phone,
  Lock,
  Unlock,
  Key,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

type UserRole = 'user' | 'lawyer';

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

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLawyerProfile, setSavingLawyerProfile] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [ghostMode, setGhostMode] = useState(false);
  const [isLawyer, setIsLawyer] = useState(false);
  const [barCouncilId, setBarCouncilId] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [officeCity, setOfficeCity] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [shortBio, setShortBio] = useState('');
  const [togglingGhost, setTogglingGhost] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lawyerMessage, setLawyerMessage] = useState('');
  const [lawyerError, setLawyerError] = useState('');

  // Lawyer Vault State
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [vaultMessage, setVaultMessage] = useState('');
  const [vaultError, setVaultError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [generatingKeys, setGeneratingKeys] = useState(false);

  const router = useRouter();
  const backHref = isLawyer ? '/lawyer/dashboard' : '/dashboard';
  const backLabel = isLawyer ? 'Back to Lawyer Dashboard' : 'Back to Dashboard';

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setEmail(user.email || '');
        setIsLawyer(parseRole(user.user_metadata?.role) === 'lawyer');

        const metadata = asObject(user.user_metadata);
        const lawyerProfile = asObject(metadata.lawyer_profile);
        setBarCouncilId(getStringField(lawyerProfile, 'bar_council_id'));
        setSpecialization(getStringField(lawyerProfile, 'specialization'));
        setYearsExperience(getStringField(lawyerProfile, 'years_of_experience'));
        setOfficeCity(getStringField(lawyerProfile, 'office_city'));
        setShortBio(getStringField(lawyerProfile, 'short_bio'));
        setContactNumber(
          getStringField(lawyerProfile, 'contact_number') ||
            getStringField(metadata, 'phone')
        );

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, ghost_mode')
          .eq('id', user.id)
          .single();
          
        if (profile?.full_name) {
          setFullName(profile.full_name);
        } else {
          setFullName(getStringField(metadata, 'full_name'));
        }
        if (profile?.ghost_mode !== undefined) {
          setGhostMode(profile.ghost_mode);
        }

        // Check for forensic keys
        setHasKeys(Boolean(user.user_metadata?.public_key));
        const { retrieveLawyerPrivateKey } = await import('@/lib/crypto');
        const privKey = await retrieveLawyerPrivateKey();
        if (privKey) setIsVaultUnlocked(true);
      }
      setLoading(false);
    }
    
    loadProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', user.id);

    const existingMetadata = asObject(user.user_metadata);
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        ...existingMetadata,
        full_name: fullName,
      },
    });

    if (updateError || metadataError) {
      setError('Failed to update profile name.');
    } else {
      setMessage('Profile updated successfully.');
    }
    
    setSaving(false);
  };

  const handleSaveLawyerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLawyerProfile(true);
    setLawyerMessage('');
    setLawyerError('');

    const trimmedBarCouncilId = barCouncilId.trim();
    const trimmedSpecialization = specialization.trim();
    const trimmedOfficeCity = officeCity.trim();
    const trimmedContactNumber = contactNumber.trim();
    const trimmedShortBio = shortBio.trim();
    const experienceNumber = Number(yearsExperience);

    if (!trimmedBarCouncilId || !trimmedSpecialization || !trimmedOfficeCity || !trimmedContactNumber) {
      setLawyerError('Please fill in all lawyer profile fields.');
      setSavingLawyerProfile(false);
      return;
    }

    if (!Number.isFinite(experienceNumber) || experienceNumber < 0 || experienceNumber > 70) {
      setLawyerError('Years of experience must be between 0 and 70.');
      setSavingLawyerProfile(false);
      return;
    }

    if (trimmedShortBio.length > 500) {
      setLawyerError('Short bio must be 500 characters or fewer.');
      setSavingLawyerProfile(false);
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setLawyerError('Session expired. Please sign in again.');
      setSavingLawyerProfile(false);
      router.push('/auth');
      return;
    }

    const existingMetadata = asObject(user.user_metadata);
    const existingLawyerProfile = asObject(existingMetadata.lawyer_profile);
    const lawyerProfile = {
      ...existingLawyerProfile,
      bar_council_id: trimmedBarCouncilId,
      specialization: trimmedSpecialization,
      years_of_experience: experienceNumber,
      office_city: trimmedOfficeCity,
      contact_number: trimmedContactNumber,
      short_bio: trimmedShortBio,
    };

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        ...existingMetadata,
        role: 'lawyer',
        lawyer_profile_completed: true,
        lawyer_profile: lawyerProfile,
      },
    });

    if (updateError) {
      setLawyerError(updateError.message || 'Failed to update lawyer profile.');
    } else {
      setLawyerMessage('Lawyer details updated successfully.');
    }

    setSavingLawyerProfile(false);
  };

  const handleGenerateKeys = async () => {
    setGeneratingKeys(true);
    setVaultError('');
    setVaultMessage('');

    try {
      const { 
        generateRSAKeyPair, 
        exportPublicKey, 
        encryptText, 
        retrieveKey,
        storeLawyerPrivateKey,
        uint8ArrayToBase64,
        base64ToUint8Array
      } = await import('@/lib/crypto');

      // 1. Generate new RSA pair
      const keyPair = await generateRSAKeyPair();
      
      // 2. Export Public Key
      const pubKeyBase64 = await exportPublicKey(keyPair.publicKey);

      // 3. Export Private Key (PKCS8)
      const privKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
      const privKeyBase64 = uint8ArrayToBase64(new Uint8Array(privKeyBuffer));

      // 4. Encrypt Private Key with Lawyer's Master Key
      const masterKey = await retrieveKey();
      if (!masterKey) {
        throw new Error('Main Vault is locked. Please unlock your identity vault first to secure forensic keys.');
      }
      
      const encryptedPrivKey = await encryptText(masterKey, privKeyBase64);

      // 5. Save to Supabase
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const existingMetadata = asObject(user.user_metadata);
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...existingMetadata,
          public_key: pubKeyBase64,
          encrypted_private_key: encryptedPrivKey,
        }
      });

      if (updateError) throw updateError;

      await storeLawyerPrivateKey(keyPair.privateKey);
      setIsVaultUnlocked(true);
      setHasKeys(true);
      setVaultMessage('Forensic encryption keys generated and secured.');
    } catch (err: any) {
      setVaultError(err.message || 'Failed to generate keys.');
    } finally {
      setGeneratingKeys(false);
    }
  };

  const handleUnlockVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlocking(true);
    setVaultError('');

    try {
      const { 
        decryptText, 
        retrieveKey,
        deriveKey,
        storeKey,
        base64ToUint8Array,
        storeLawyerPrivateKey,
      } = await import('@/lib/crypto');

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired');

      let masterKey = await retrieveKey();
      
      // If no master key in memory, we need to derive it from the password provided
      if (!masterKey) {
        const metadata = asObject(user.user_metadata);
        const salt = String(metadata.encryption_salt || '');
        if (!salt) throw new Error('Encryption salt missing. Please contact support.');
        
        masterKey = await deriveKey(unlockPassword, salt);
        await storeKey(masterKey, salt);
      }

      const encryptedPrivKey = asObject(user.user_metadata?.encrypted_private_key);
      if (!encryptedPrivKey || !encryptedPrivKey.ciphertext) {
        throw new Error('No secured private key found in your account.');
      }

      const privKeyBase64 = await decryptText(masterKey, encryptedPrivKey as any);
      const privKeyBuffer = base64ToUint8Array(privKeyBase64);

      const privKey = await window.crypto.subtle.importKey(
        'pkcs8',
        privKeyBuffer as any,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['unwrapKey']
      );

      await storeLawyerPrivateKey(privKey);
      setIsVaultUnlocked(true);
      setVaultMessage('Forensic vault unlocked.');
    } catch (err: any) {
      setVaultError('Unable to unlock forensic vault. Ensure your password is correct.');
    } finally {
      setUnlocking(false);
      setUnlockPassword('');
    }
  };

  const handleToggleGhostMode = async () => {
    setTogglingGhost(true);
    const newValue = !ghostMode;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setTogglingGhost(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ ghost_mode: newValue })
      .eq('id', user.id);

    if (updateError) {
      setError('Failed to update Ghost Mode setting.');
    } else {
      setGhostMode(newValue);
      setMessage(newValue ? 'Ghost Mode enabled — data will be auto-deleted after 24 hours.' : 'Ghost Mode disabled.');
    }
    
    setTogglingGhost(false);
  };

  const handleSignOut = async () => {
    // E2EE: Clear encryption key from session
    const { clearKey } = await import('@/lib/crypto');
    clearKey();

    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  if (loading) {
    return (
      <div className={styles.page}>
         <div className="flex justify-center items-center h-64">
           <Loader className="animate-spin text-accent" size={32} />
         </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href={backHref} className={styles.back}>
        <ArrowLeft size={16} />
        {backLabel}
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>Account Settings</h1>
        <p className={styles.subtitle}>
          Manage your editorial sanctuary settings, privacy preferences, and identity credentials.
        </p>
      </div>

      <div className={styles.container}>
        <div className={styles.primaryColumn}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrap}>
                <User size={22} />
              </div>
              <div>
                <h2 className={styles.cardTitle}>Personal Identity</h2>
                <p className={styles.cardDesc}>Update your profile credentials.</p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className={`${styles.form} ${styles.identityForm}`}>
              <div className={styles.identityGrid}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="fullName">Full Name</label>
                  <input
                    id="fullName"
                    type="text"
                    className={styles.input}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="email">Email Address</label>
                  <div className={styles.inputWrap}>
                    <Mail size={18} className={styles.inputIcon} />
                    <input
                      id="email"
                      type="email"
                      className={`${styles.input} ${styles.inputWithIcon} ${styles.disabledInput}`}
                      value={email}
                      disabled
                      readOnly
                    />
                  </div>
                </div>
              </div>

              <p className={styles.helpText}>Email address cannot be changed currently.</p>
              {error && <div className={styles.error}>{error}</div>}
              {message && <div className={styles.success}>{message}</div>}

              <div className={styles.actions}>
                <button
                  type="submit"
                  className={styles.saveBtn}
                  disabled={saving}
                >
                  {saving ? (
                    <><Loader size={18} className="animate-spin" /> Saving...</>
                  ) : (
                    <><Save size={18} /> Save Changes</>
                  )}
                </button>
              </div>
            </form>
          </div>

          {isLawyer && (
            <div className={`${styles.card} ${styles.lawyerCard}`}>
              <div className={styles.cardHeader}>
                <div className={`${styles.iconWrap} ${styles.lawyerIconWrap}`}>
                  <Scale size={22} />
                </div>
                <div>
                  <h2 className={styles.cardTitle}>Lawyer Information</h2>
                  <p className={styles.cardDesc}>Manage your professional profile details.</p>
                </div>
              </div>

              <form onSubmit={handleSaveLawyerProfile} className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="barCouncilId">Bar Council ID</label>
                  <input
                    id="barCouncilId"
                    type="text"
                    className={styles.input}
                    value={barCouncilId}
                    onChange={(e) => setBarCouncilId(e.target.value)}
                    placeholder="Enter your registration ID"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="specialization">Primary Specialization</label>
                  <div className={styles.inputWrap}>
                    <Briefcase size={18} className={styles.inputIcon} />
                    <select
                      id="specialization"
                      className={`${styles.input} ${styles.inputWithIcon}`}
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
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

                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="yearsExperience">Years of Experience</label>
                    <input
                      id="yearsExperience"
                      type="number"
                      min={0}
                      max={70}
                      className={styles.input}
                      value={yearsExperience}
                      onChange={(e) => setYearsExperience(e.target.value)}
                      placeholder="e.g. 6"
                      required
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="officeCity">Office City</label>
                    <div className={styles.inputWrap}>
                      <MapPin size={18} className={styles.inputIcon} />
                      <input
                        id="officeCity"
                        type="text"
                        className={`${styles.input} ${styles.inputWithIcon}`}
                        value={officeCity}
                        onChange={(e) => setOfficeCity(e.target.value)}
                        placeholder="e.g. Delhi"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="contactNumber">Contact Number</label>
                  <div className={styles.inputWrap}>
                    <Phone size={18} className={styles.inputIcon} />
                    <input
                      id="contactNumber"
                      type="tel"
                      className={`${styles.input} ${styles.inputWithIcon}`}
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="Enter phone number"
                      required
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="shortBio">Add Short Bio</label>
                  <div className={styles.inputWrap}>
                    <FileText size={18} className={styles.inputIconTop} />
                    <textarea
                      id="shortBio"
                      className={`${styles.input} ${styles.inputWithIcon} ${styles.textarea}`}
                      value={shortBio}
                      onChange={(e) => setShortBio(e.target.value)}
                      placeholder="Write a short professional bio (optional)"
                      maxLength={500}
                    />
                  </div>
                  <p className={styles.helpText}>{shortBio.length}/500</p>
                </div>

                {lawyerError && <div className={styles.error}>{lawyerError}</div>}
                {lawyerMessage && <div className={styles.success}>{lawyerMessage}</div>}

                <div className={styles.actions}>
                  <button
                    type="submit"
                    className={styles.saveBtn}
                    disabled={savingLawyerProfile}
                  >
                    {savingLawyerProfile ? (
                      <><Loader size={18} className="animate-spin" /> Saving...</>
                    ) : (
                      <><Save size={18} /> Save Lawyer Details</>
                    )}
                  </button>
                </div>
              </form>

              {/* LAWYER FORENSIC VAULT SECTION */}
              <div className={styles.divider} />
              
              <div className={styles.vaultSection}>
                <div className={styles.cardHeader}>
                  <div className={`${styles.iconWrap} ${styles.vaultIconWrap}`}>
                    <Shield size={22} />
                  </div>
                  <div>
                    <h3 className={styles.cardTitle}>Legal Forensic Vault</h3>
                    <p className={styles.cardDesc}>Securely manage client evidence decryption keys.</p>
                  </div>
                </div>

                {hasKeys ? (
                  isVaultUnlocked ? (
                    <div className={styles.vaultStatusActive}>
                      <Unlock size={24} className={styles.unlockIcon} />
                      <div>
                        <p className={styles.vaultStatusTitle}>Vault Unlocked</p>
                        <p className={styles.vaultStatusDesc}>You can now view decrypted client evidence and forensic reports.</p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleUnlockVault} className={styles.unlockForm}>
                      <div className={styles.field}>
                        <label className={styles.label}>Unlock Forensic Access</label>
                        <p className={styles.helpText}>Enter your account password to load your private forensic keys into memory.</p>
                        <div className={styles.inputWrap}>
                          <Lock size={18} className={styles.inputIcon} />
                          <input
                            type="password"
                            className={`${styles.input} ${styles.inputWithIcon}`}
                            value={unlockPassword}
                            onChange={(e) => setUnlockPassword(e.target.value)}
                            placeholder="Account Password"
                            required
                          />
                        </div>
                      </div>
                      {vaultError && <p className={styles.vaultError}>{vaultError}</p>}
                      <button type="submit" className={styles.unlockBtn} disabled={unlocking}>
                        {unlocking ? <Loader size={16} className="animate-spin" /> : <Unlock size={16} />}
                        Unlock Vault
                      </button>
                    </form>
                  )
                ) : (
                  <div className={styles.setupVault}>
                    <p className={styles.setupText}>
                      Your forensic key pair has not been generated yet. You must create one to accept and decrypt client evidence.
                    </p>
                    <button 
                      onClick={handleGenerateKeys} 
                      className={styles.generateBtn} 
                      disabled={generatingKeys}
                    >
                      {generatingKeys ? <Loader size={16} className="animate-spin" /> : <Key size={16} />}
                      Generate Forensic Key Pair
                    </button>
                    {vaultError && <p className={styles.vaultError}>{vaultError}</p>}
                  </div>
                )}
                {vaultMessage && <p className={styles.vaultSuccess}>{vaultMessage}</p>}
              </div>
            </div>
          )}
        </div>

        <div className={styles.secondaryColumn}>
          <div className={`${styles.card} ${styles.ghostCard}`}>
            <div className={styles.cardHeader}>
              <div className={`${styles.iconWrap} ${styles.ghostIconWrap}`}>
                <Ghost size={22} />
              </div>
              <div className={styles.ghostHeaderGroup}>
                <h2 className={styles.cardTitle}>Ghost Mode</h2>
                <span className={`${styles.ghostBadge} ${ghostMode ? styles.ghostBadgeActive : ''}`}>
                  {ghostMode ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
            </div>
            <p className={styles.ghostText}>
              Enhanced privacy: hide your reading activity, status visibility, and sensitive traces
              from platform records.
            </p>

            <div className={styles.ghostToggleRow}>
              <div>
                <span className={styles.ghostToggleLabel}>Auto-delete after 24 hours</span>
                <span className={styles.ghostToggleHint}>
                  {ghostMode ? 'Your data will be purged automatically.' : 'Your data is stored permanently.'}
                </span>
              </div>
              <button
                className={`${styles.toggleSwitch} ${ghostMode ? styles.toggleActive : ''}`}
                onClick={handleToggleGhostMode}
                disabled={togglingGhost}
                role="switch"
                aria-checked={ghostMode}
                aria-label="Toggle Ghost Mode"
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={`${styles.card} ${styles.securityCard}`}>
            <div className={styles.cardHeader}>
              <div className={`${styles.iconWrap} ${styles.dangerIconWrap}`}>
                <Shield size={22} />
              </div>
              <div>
                <h2 className={styles.cardTitle}>End Session</h2>
                <p className={styles.cardDesc}>Securely sign out of Editorial Guardian.</p>
              </div>
            </div>

            <div className={styles.securitySection}>
              <p className={styles.securityText}>
                Sign out from this device while preserving your encrypted records.
              </p>
              <button onClick={handleSignOut} className={styles.signOutBtn}>
                <span>Sign Out</span>
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
