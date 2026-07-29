import LawyerShell from '@/components/lawyer/LawyerShell';
import CommunicationHub from '@/components/communication/CommunicationHub';

export default function CommunicationPage() {
  return (
    <LawyerShell
      title="Communication"
      subtitle="Centralize client updates, case discussions, and legal coordination notes."
    >
      <CommunicationHub />
    </LawyerShell>
  );
}
