import LawyerShell from '@/components/lawyer/LawyerShell';
import styles from '../workspace.module.css';

export default function LawyerSettingsPage() {
  return (
    <LawyerShell
      title="Settings"
      subtitle="Configure notifications, workspace preferences, and account-level controls."
    >
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Workspace Settings</h3>
        <div className={styles.list}>
          <article className={styles.listItem}>
            <div className={styles.listItemHead}>
              <p className={styles.primary}>Emergency Push Notifications</p>
              <p className={styles.secondary}>Get immediate SOS updates from clients.</p>
            </div>
            <span className={`${styles.badge} ${styles.badgeActive}`}>Enabled</span>
          </article>
          <article className={styles.listItem}>
            <div className={styles.listItemHead}>
              <p className={styles.primary}>Calendar Sync</p>
              <p className={styles.secondary}>Sync upcoming hearings with your connected calendar.</p>
            </div>
            <span className={`${styles.badge} ${styles.badgeActive}`}>Enabled</span>
          </article>
          <article className={styles.listItem}>
            <div className={styles.listItemHead}>
              <p className={styles.primary}>Draft Auto Save</p>
              <p className={styles.secondary}>Save legal drafts automatically every 30 seconds.</p>
            </div>
            <span className={`${styles.badge} ${styles.badgeClosed}`}>On</span>
          </article>
        </div>
      </section>
    </LawyerShell>
  );
}
