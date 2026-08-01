'use client';

import { Download, X, FileText, ExternalLink } from 'lucide-react';
import styles from './PdfPreviewModal.module.css';

type PdfPreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  fileName: string;
  onDownload: () => void;
};

export default function PdfPreviewModal({
  isOpen,
  onClose,
  pdfUrl,
  fileName,
  onDownload,
}: PdfPreviewModalProps) {
  if (!isOpen || !pdfUrl) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div className={styles.titleArea}>
            <div className={styles.iconWrap}>
              <FileText size={20} />
            </div>
            <div className={styles.titleText}>
              <h3>Forensic Report Preview</h3>
              <p>{fileName}</p>
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.downloadBtn} onClick={onDownload}>
              <Download size={16} />
              <span>Download PDF</span>
            </button>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close preview">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className={styles.viewerContainer}>
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0`}
            className={styles.iframe}
            title="Forensic PDF Preview"
          />
        </div>
      </div>
    </div>
  );
}
