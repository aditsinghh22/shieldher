export type EmergencySeverity = 'critical' | 'high' | 'medium';
export type LawyerCaseStatus = 'Active' | 'Closed';

export type WorkspaceEmergencyAlert = {
  id: string;
  upload_id: string;
  client_name: string;
  location: string;
  time: string;
  severity: EmergencySeverity;
  acceptance_status: 'pending' | 'accepted';
  accepted_at?: string;
};

export type WorkspaceCase = {
  id: string;
  client_id?: string;
  title: string;
  client_name: string;
  status: LawyerCaseStatus;
  updated_at: string;
};

export type WorkspaceClient = {
  id: string;
  name: string;
  location: string;
  total_cases: number;
  joined_at: string;
  selected_at?: string;
  contacted_at?: string;
};

export type WorkspaceHearing = {
  id: string;
  case_title: string;
  hearing_time: string;
  venue: string;
};

export type LawyerWorkspaceData = {
  dashboard: {
    active_cases: number;
    emergency_alerts: number;
    upcoming_hearings: number;
  };
  emergency_alerts: WorkspaceEmergencyAlert[];
  cases: WorkspaceCase[];
  clients: WorkspaceClient[];
  hearings: WorkspaceHearing[];
};
