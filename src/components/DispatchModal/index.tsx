"use client";

import React, { useState, useMemo } from "react";
import { X, Send, MapPin, User, Mail, Clock, AlertCircle } from "lucide-react";
import styles from "./DispatchModal.module.css";
import indiaDistrictsData from "@/lib/india-districts.json";

export interface DispatchFormData {
  user_state: string;
  user_district: string;
  user_email: string;
  user_suspect_name: string;
  user_suspect_platform_contact: string;
  user_suspect_id_type: string;
  user_suspect_id_value: string;
  user_incident_date: string;
  user_incident_hour: string;
  user_incident_minute: string;
  user_incident_ampm: string;
}

interface DispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: DispatchFormData) => void;
  isLoading: boolean;
  initialData?: {
    suspect_name?: string;
    suspect_platform_contact?: string;
    suspect_id_type?: string;
    suspect_id_value?: string;
    incident_date?: string;
  };
}

const INDIAN_STATES = [
  "Select State", "ANDAMAN AND NICOBAR ISLANDS", "ANDHRA PRADESH", "ARUNACHAL PRADESH",
  "ASSAM", "BIHAR", "CHANDIGARH", "CHHATTISGARH", "DELHI", "GOA", "GUJARAT",
  "HARYANA", "HIMACHAL PRADESH", "JAMMU AND KASHMIR", "JHARKHAND", "KARNATAKA",
  "KERALA", "LADAKH", "LAKSHADWEEP", "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR",
  "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA", "PUDUCHERRY", "PUNJAB",
  "RAJASTHAN", "SIKKIM", "TAMIL NADU", "TELANGANA", "TRIPURA",
  "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL",
];

const ID_TYPES = [
  { value: "none", label: "Not Available" },
  { value: "mobile_number", label: "Mobile Number" },
  { value: "email_address", label: "Email Address" },
  { value: "social_media_id", label: "Social Media ID" },
  { value: "pan_card", label: "PAN Card" },
  { value: "international_number", label: "International Number" },
  { value: "landline_number", label: "Landline Number" },
  { value: "whatsapp_call", label: "WhatsApp Call" },
  { value: "aadhaar_card", label: "Aadhaar Card" },
  { value: "passport", label: "Passport Number" },
  { value: "bank_account", label: "Bank Account Number" },
  { value: "upi_id", label: "UPI ID" },
];

type IndiaDistrictState = {
  state: string;
  districts: string[];
};

function normalizeStateKey(state: string): string {
  return state
    .replace(/\(.*?\)/g, "")
    .replace(/&/g, "AND")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const DISTRICTS_BY_STATE: Record<string, string[]> = (() => {
  const mapped = new Map<string, string[]>();
  const states = (indiaDistrictsData as { states: IndiaDistrictState[] }).states || [];

  for (const entry of states) {
    const key = normalizeStateKey(entry.state);
    const districts = (entry.districts || []).map((d) => d.trim()).filter(Boolean);
    if (districts.length > 0) {
      mapped.set(key, districts);
    }
  }

  const dadra = mapped.get("DADRA AND NAGAR HAVELI") || [];
  const daman = mapped.get("DAMAN AND DIU") || [];
  if (dadra.length > 0 || daman.length > 0) {
    mapped.set(
      "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
      [...dadra, ...daman]
    );
  }

  if (!mapped.has("ANDAMAN AND NICOBAR ISLANDS")) {
    mapped.set("ANDAMAN AND NICOBAR ISLANDS", [
      "Nicobars",
      "North and Middle Andaman",
      "South Andaman",
    ]);
  }

  if (!mapped.has("LADAKH")) {
    mapped.set("LADAKH", ["Kargil", "Leh"]);
  }

  return Object.fromEntries(mapped.entries());
})();

function buildInitialFormData(initialData?: DispatchModalProps["initialData"]): DispatchFormData {
  return {
    user_state: "DELHI",
    user_district: "",
    user_email: "",
    user_suspect_name: initialData?.suspect_name || "",
    user_suspect_platform_contact: initialData?.suspect_platform_contact || "",
    user_suspect_id_type: initialData?.suspect_id_type || "none",
    user_suspect_id_value: initialData?.suspect_id_value || "",
    user_incident_date: initialData?.incident_date || new Date().toISOString().split("T")[0],
    user_incident_hour: "10",
    user_incident_minute: "30",
    user_incident_ampm: "AM",
  };
}

export default function DispatchModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  initialData,
}: DispatchModalProps) {
  const [formData, setFormData] = useState<DispatchFormData>(() => buildInitialFormData(initialData));

  const districtOptions = useMemo(() => {
    const stateKey = normalizeStateKey(formData.user_state);
    return DISTRICTS_BY_STATE[stateKey] || [];
  }, [formData.user_state]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (name === "user_state") {
        return { ...prev, user_state: value, user_district: "" };
      }
      if (name === "user_suspect_id_type" && value === "none") {
        return { ...prev, [name]: value, user_suspect_id_value: "" };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(formData);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Send className={styles.icon} size={20} />
            <h2>Dispatch Forensic RPA Bot</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} disabled={isLoading}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.content}>
          <div className={styles.infoBanner}>
            <AlertCircle size={16} />
            <p>Filling this form will launch an autonomous bot to file your complaint on the National Cyber Crime Reporting Portal.</p>
          </div>

          <div className={styles.grid}>
            {/* Location Section */}
            <div className={styles.section}>
              <h3><MapPin size={14} /> Location Details</h3>
              <div className={styles.inputGroup}>
                <label>State</label>
                <select name="user_state" value={formData.user_state} onChange={handleChange} required>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className={styles.inputGroup}>
                <label>District</label>
                <select
                  name="user_district"
                  value={formData.user_district}
                  onChange={handleChange}
                  required
                  disabled={districtOptions.length === 0}
                >
                  <option value="">
                    {districtOptions.length > 0
                      ? "Select District"
                      : "No district list available"}
                  </option>
                  {districtOptions.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Victim Info */}
            <div className={styles.section}>
              <h3><Mail size={14} /> Your Contact</h3>
              <div className={styles.inputGroup}>
                <label>Email Address</label>
                <input
                  type="email"
                  name="user_email"
                  placeholder="For portal notifications"
                  value={formData.user_email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Incident Timing */}
            <div className={styles.section}>
              <h3><Clock size={14} /> Incident Timing</h3>
              <div className={styles.inputGroup}>
                <label>Date</label>
                <input
                  type="date"
                  name="user_incident_date"
                  value={formData.user_incident_date}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className={styles.timeRow}>
                <div className={styles.inputGroup}>
                  <label>Hour</label>
                  <select name="user_incident_hour" value={formData.user_incident_hour} onChange={handleChange}>
                    {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label>Min</label>
                  <select name="user_incident_minute" value={formData.user_incident_minute} onChange={handleChange}>
                    {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label>AM/PM</label>
                  <select name="user_incident_ampm" value={formData.user_incident_ampm} onChange={handleChange}>
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Suspect Info */}
            <div className={styles.section + " " + styles.fullWidth}>
              <h3><User size={14} /> Suspect Information (Analyzed)</h3>
              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label>Suspect Name/Alias</label>
                  <input
                    type="text"
                    name="user_suspect_name"
                    value={formData.user_suspect_name}
                    onChange={handleChange}
                    placeholder="Unknown"
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Platform Contact (ID/Phone)</label>
                  <input
                    type="text"
                    name="user_suspect_platform_contact"
                    value={formData.user_suspect_platform_contact}
                    onChange={handleChange}
                    placeholder="e.g. @username or Phone"
                  />
                </div>
              </div>
              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label>Other ID Type</label>
                  <select name="user_suspect_id_type" value={formData.user_suspect_id_type} onChange={handleChange}>
                    {ID_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label>Other ID Value</label>
                  <input
                    type="text"
                    name="user_suspect_id_value"
                    value={formData.user_suspect_id_value}
                    onChange={handleChange}
                    placeholder="Specific ID number/value"
                    disabled={formData.user_suspect_id_type === "none"}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className={styles.confirmBtn} disabled={isLoading}>
              {isLoading ? "Launching Bot..." : "Secure Dispatch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
