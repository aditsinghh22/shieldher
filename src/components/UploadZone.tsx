import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, CheckCircle, Loader, FileAudio, FileText, FileVideo } from "lucide-react";
import styles from "./UploadZone.module.css";

interface UploadedFile {
  file: File;
  preview: string;
  status: "ready" | "uploading" | "done" | "error";
}

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading?: boolean;
  variant?: "default" | "dashboard";
}

export default function UploadZone({
  onFilesSelected,
  isUploading = false,
  variant = "default",
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
      "video/*": [".mp4", ".mov", ".webm", ".mkv"],
    },
    maxSize: 50 * 1024 * 1024, // Increased to 50MB for video support
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
    <div className={`${styles.wrapper} ${variant === "dashboard" ? styles.dashboardTheme : ""}`}>
      <div
        {...getRootProps()}
        className={`${styles.dropzone} ${isDragActive ? styles.active : ""} ${isUploading ? styles.disabled : ""
          }`}
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
                  : "Drag & drop screenshots, recordings, or video evidence"}
            </p>
            <p className={styles.dropHint}>
              or click to browse • Images/Audio/Video up to 50MB
            </p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className={styles.previews}>
          {files.map((f, i) => (
            <div key={i} className={styles.preview}>
              <div className={styles.previewImgWrap}>
                {f.file.type.startsWith("audio/") ? (
                  <div className={styles.audioPreview}>
                    <FileAudio size={42} className={styles.audioIcon} />
                  </div>
                ) : f.file.type.startsWith("video/") ? (
                  <div className={styles.audioPreview} style={{ background: "rgba(139, 92, 246, 0.08)" }}>
                    <FileVideo size={42} style={{ color: "#8b5cf6" }} />
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
              <div className={styles.fileInfo}>
                <span className={styles.fileName}>{f.file.name}</span>
                <span className={styles.fileSize}>
                  {(f.file.size / 1024).toFixed(0)} KB
                </span>
              </div>
              <button
                className={styles.removeBtn}
                onClick={() => removeFile(i)}
                disabled={isUploading}
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