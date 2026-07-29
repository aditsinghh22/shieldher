import { NextResponse } from 'next/server';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import type { LawyerWorkspaceData } from '@/lib/lawyer/types';

type UploadRow = {
  id: string;
  user_id: string;
  file_name: string;
  status: string;
  created_at: string;
};

type AnalysisRow = {
  upload_id: string;
  risk_level: string;
  created_at: string;
};

type AcceptedCaseRecord = {
  upload_id: string;
  accepted_at: string;
};

type HearingRow = {
  id: string;
  case_title: string;
  hearing_time: string;
  venue: string;
};

type UserInfo = {
  id: string;
  name: string;
  location: string;
  role: 'user' | 'lawyer' | 'unknown';
  joined_at: string;
  selected_at: string;
  contacted_at: string;
};

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toText(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return '';
}

function getFirstText(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const text = toText(source[key]).trim();
    if (text) return text;
  }
  return '';
}

function toIso(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function toSeverity(riskLevel: string): 'critical' | 'high' | 'medium' {
  if (riskLevel === 'critical') return 'critical';
  if (riskLevel === 'high') return 'high';
  return 'medium';
}

function getSelectedLawyerId(metadata: Record<string, unknown>): string {
  const directId = toText(metadata.selected_lawyer_id);
  if (directId) return directId;
  const selectedLawyer = asObject(metadata.selected_lawyer);
  return toText(selectedLawyer.id);
}

function getSelectedLawyerName(metadata: Record<string, unknown>): string {
  const directName = toText(metadata.selected_lawyer_name);
  if (directName) return directName;
  const selectedLawyer = asObject(metadata.selected_lawyer);
  return toText(selectedLawyer.name);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function getAcceptedCasesForLawyer(
  metadata: Record<string, unknown>,
  requesterLawyerId: string
): Map<string, AcceptedCaseRecord> {
  const acceptedCasesValue = metadata.accepted_cases;
  if (!Array.isArray(acceptedCasesValue)) {
    return new Map();
  }

  const acceptedCases = new Map<string, AcceptedCaseRecord>();
  for (const item of acceptedCasesValue) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const entry = item as Record<string, unknown>;
    const uploadId = toText(entry.upload_id).trim();
    const lawyerId = normalize(toText(entry.lawyer_id));
    const status = normalize(toText(entry.status) || 'accepted');
    if (!uploadId || !lawyerId || !requesterLawyerId) continue;
    if (status !== 'accepted' || lawyerId !== requesterLawyerId) continue;

    const acceptedAt =
      toIso(toText(entry.accepted_at)) ||
      toIso(toText(entry.updated_at)) ||
      toIso(toText(entry.created_at));

    acceptedCases.set(uploadId, {
      upload_id: uploadId,
      accepted_at: acceptedAt,
    });
  }

  return acceptedCases;
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requesterMetadata = asObject(user.user_metadata);
    const requesterRole = toText(requesterMetadata.role);
    if (requesterRole !== 'lawyer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const requesterLawyerId = normalize(user.id);
    const requesterLawyerName = normalize(toText(requesterMetadata.full_name));

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
    }

    const supabaseAdmin = createSupabaseAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const usersDirectory = new Map<string, UserInfo>();
    const selectedClientIds = new Set<string>();
    const acceptedCasesByClient = new Map<string, Map<string, AcceptedCaseRecord>>();
    const perPage = 200;
    let page = 1;

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) throw error;

      for (const authUser of data.users) {
        const metadata = asObject(authUser.user_metadata);
        const roleValue = toText(metadata.role);
        const role: UserInfo['role'] =
          roleValue === 'user' || roleValue === 'lawyer' ? roleValue : 'unknown';
        const name = toText(metadata.full_name) || authUser.email?.split('@')[0] || 'ShieldHer User';
        const location = toText(metadata.country) || 'Location unavailable';
        const selectedAt = toIso(
          getFirstText(metadata, [
            'selected_lawyer_at',
            'lawyer_selected_at',
            'selected_at',
            'lawyer_chosen_at',
          ])
        );
        const contactedAt = toIso(
          getFirstText(metadata, [
            'contacted_lawyer_at',
            'lawyer_contacted_at',
            'contacted_at',
            'first_contact_at',
          ])
        );

        usersDirectory.set(authUser.id, {
          id: authUser.id,
          name,
          location,
          role,
          joined_at: authUser.created_at ?? '',
          selected_at: selectedAt,
          contacted_at: contactedAt,
        });

        const selectedLawyerId = normalize(getSelectedLawyerId(metadata));
        const selectedLawyerName = normalize(getSelectedLawyerName(metadata));
        const selectedById = Boolean(selectedLawyerId) && selectedLawyerId === requesterLawyerId;
        const selectedByName =
          Boolean(selectedLawyerName) &&
          Boolean(requesterLawyerName) &&
          selectedLawyerName === requesterLawyerName;

        if (authUser.id !== user.id && role !== 'lawyer' && (selectedById || selectedByName)) {
          selectedClientIds.add(authUser.id);
          acceptedCasesByClient.set(
            authUser.id,
            getAcceptedCasesForLawyer(metadata, requesterLawyerId)
          );
        }
      }

      if (data.users.length < perPage) break;
      page += 1;
    }

    const { data: uploadsData, error: uploadsError } = await supabaseAdmin
      .from('uploads')
      .select('id, user_id, file_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (uploadsError) throw uploadsError;

    const uploads = (uploadsData as UploadRow[] | null) ?? [];
    const scopedUploads = uploads.filter((upload) => selectedClientIds.has(upload.user_id));
    const uploadIds = scopedUploads.map((upload) => upload.id);

    let analyses: AnalysisRow[] = [];
    if (uploadIds.length > 0) {
      const { data: analysesData, error: analysesError } = await supabaseAdmin
        .from('analysis_results')
        .select('upload_id, risk_level, created_at')
        .in('upload_id', uploadIds)
        .order('created_at', { ascending: false });

      if (analysesError) throw analysesError;
      analyses = (analysesData as AnalysisRow[] | null) ?? [];
    }

    const latestAnalysisByUpload = new Map<string, AnalysisRow>();
    for (const analysis of analyses) {
      if (!latestAnalysisByUpload.has(analysis.upload_id)) {
        latestAnalysisByUpload.set(analysis.upload_id, analysis);
      }
    }

    const cases = scopedUploads
      .map((upload) => {
        const client = usersDirectory.get(upload.user_id);
        return {
          id: upload.id,
          client_id: upload.user_id,
          title: upload.file_name || `Case ${upload.id.slice(0, 8)}`,
          client_name: client?.name || 'ShieldHer User',
          status: upload.status === 'completed' ? ('Closed' as const) : ('Active' as const),
          updated_at: upload.created_at,
        };
      })
      .slice(0, 80);

    const emergencyAlerts = scopedUploads
      .filter((upload) => {
        const latestAnalysis = latestAnalysisByUpload.get(upload.id);
        const riskLevel = latestAnalysis?.risk_level;
        return (
          upload.status === 'flagged' ||
          riskLevel === 'critical' ||
          riskLevel === 'high' ||
          riskLevel === 'medium'
        );
      })
      .map((upload) => {
        const latestAnalysis = latestAnalysisByUpload.get(upload.id);
        const client = usersDirectory.get(upload.user_id);
        const acceptedCase = acceptedCasesByClient.get(upload.user_id)?.get(upload.id);
        const acceptedAt = acceptedCase?.accepted_at || '';

        return {
          id: `SOS-${upload.id.slice(0, 8)}`,
          upload_id: upload.id,
          client_name: client?.name || 'ShieldHer User',
          location: client?.location || 'Location unavailable',
          time: latestAnalysis?.created_at || upload.created_at,
          severity: toSeverity(latestAnalysis?.risk_level || 'medium'),
          acceptance_status: acceptedAt ? ('accepted' as const) : ('pending' as const),
          accepted_at: acceptedAt || undefined,
        };
      })
      .slice(0, 50);

    const casesPerUser = new Map<string, number>();
    for (const upload of scopedUploads) {
      casesPerUser.set(upload.user_id, (casesPerUser.get(upload.user_id) ?? 0) + 1);
    }

    const firstUploadAtByUser = new Map<string, string>();
    for (const upload of scopedUploads) {
      const previous = firstUploadAtByUser.get(upload.user_id);
      if (!previous) {
        firstUploadAtByUser.set(upload.user_id, upload.created_at);
        continue;
      }

      const previousDate = new Date(previous);
      const nextDate = new Date(upload.created_at);
      if (Number.isNaN(previousDate.getTime())) continue;
      if (Number.isNaN(nextDate.getTime())) continue;
      if (nextDate.getTime() < previousDate.getTime()) {
        firstUploadAtByUser.set(upload.user_id, upload.created_at);
      }
    }

    const clients = Array.from(selectedClientIds)
      .map((id) => usersDirectory.get(id))
      .filter((entry): entry is UserInfo => Boolean(entry))
      .map((entry) => {
        const fallbackSelectedAt = toIso(entry.joined_at);
        const uploadContactedAt = toIso(firstUploadAtByUser.get(entry.id) ?? '');

        return {
          id: entry.id,
          name: entry.name,
          location: entry.location,
          total_cases: casesPerUser.get(entry.id) ?? 0,
          joined_at: entry.joined_at,
          selected_at: entry.selected_at || fallbackSelectedAt,
          contacted_at: entry.contacted_at || uploadContactedAt,
        };
      })
      .sort((a, b) => b.total_cases - a.total_cases)
      .slice(0, 100);

    let hearings: HearingRow[] = [];
    const { data: hearingData, error: hearingError } = await supabaseAdmin
      .from('hearings')
      .select('id, case_title, hearing_time, venue')
      .order('hearing_time', { ascending: true })
      .limit(30);

    if (!hearingError && Array.isArray(hearingData)) {
      hearings = hearingData as HearingRow[];
    }

    const workspaceData: LawyerWorkspaceData = {
      dashboard: {
        active_cases: cases.filter((caseItem) => caseItem.status === 'Active').length,
        emergency_alerts: emergencyAlerts.length,
        upcoming_hearings: hearings.length,
      },
      emergency_alerts: emergencyAlerts,
      cases,
      clients,
      hearings: hearings.map((hearing) => ({
        id: hearing.id,
        case_title: hearing.case_title,
        hearing_time: hearing.hearing_time,
        venue: hearing.venue,
      })),
    };

    return NextResponse.json(workspaceData);
  } catch (error: unknown) {
    console.error('Lawyer workspace data error:', error);
    return NextResponse.json(
      { error: 'Failed to load lawyer workspace data' },
      { status: 500 }
    );
  }
}
