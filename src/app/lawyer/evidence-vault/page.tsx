import LawyerShell from '@/components/lawyer/LawyerShell';
import styles from '../workspace.module.css';

export default function EvidenceVaultPage() {
  return (
    <LawyerShell
      title="Evidence Vault"
      subtitle="Securely store screenshots, reports, and case-linked legal evidence."
    >
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Evidence Vault</h3>
        <div className={styles.placeholder}>
          Vault indexing is ready. Connect your uploaded records and generated reports here for quick retrieval.
        </div>
      </section>
    </LawyerShell>
  );
}
