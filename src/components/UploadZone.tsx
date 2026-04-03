"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, CheckCircle, Loader, FileAudio } from "lucide-react";
import styles from "./UploadZone.module.css";

interface UploadedFile {
  file: File;
  preview: string;
  status: "ready" | "uploading" | "done" | "error";
}

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading?: boolean;
}

export default function UploadZone({
  onFilesSelected,
  isUploading = false,
}: UploadZoneProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        status: "ready" as const,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
      onFilesSelected(acceptedFiles);
    },
    [onFilesSelected],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
      "audio/*": [".mp3", ".wav", ".m4a", ".aac", ".ogg"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <div className={styles.wrapper}>
      <div
        {...getRootProps()}
        className={`${styles.dropzone} ${isDragActive ? styles.active : ""} ${isUploading ? styles.uploading : ""}`}
      >
        <input {...getInputProps()} />
        <div className={styles.dropContent}>
          <div className={styles.iconWrap}>
            {isUploading ? (
              <Loader size={28} className="animate-spin" />
            ) : (
              <Upload size={28} />
            )}
          </div>
          <div className={styles.dropText}>
            <p className={styles.dropTitle}>
              {isDragActive
                ? "Drop your evidence here"
                : isUploading
                  ? "Uploading..."
                  : "Drag & drop chat screenshots or recordings"}
            </p>
            <p className={styles.dropHint}>
              or click to browse • Images/Audio up to 10MB
            </p>
          </div>
        </div>

        {isDragActive && <div className={styles.dragOverlay} />}
      </div>

      {files.length > 0 && (
        <div className={styles.previews}>
          {files.map((f, i) => (
            <div key={i} className={styles.preview}>
              <div className={styles.previewImgWrap}>
                {f.file.type.startsWith('audio/') ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: 'rgba(99, 91, 255, 0.06)' }}>
                    <FileAudio size={42} style={{ color: 'var(--accent-primary)' }} />
                  </div>
                ) : (
                  <img
                    src={f.preview}
                    alt={f.file.name}
                    className={styles.previewImg}
                  />
                )}
                <div className={styles.previewOverlay}>
                  {f.status === "uploading" && (
                    <Loader size={18} className="animate-spin" />
                  )}
                  {f.status === "done" && <CheckCircle size={18} />}
                </div>
              </div>
              <div className={styles.previewInfo}>
                <span className={styles.previewName}>{f.file.name}</span>
                <span className={styles.previewSize}>
                  {(f.file.size / 1024).toFixed(0)} KB
                </span>
              </div>
              <button
                className={styles.removeBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
