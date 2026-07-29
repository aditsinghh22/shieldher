'use client';

import { FormEvent, useMemo, useState } from 'react';
import LawyerShell from '@/components/lawyer/LawyerShell';
import { useWorkspaceData } from '@/lib/lawyer/useWorkspaceData';
import {
  CalendarClock,
  Copy,
  FilePenLine,
  Filter,
  FolderOpen,
  Search,
  Send,
  Sparkles,
} from 'lucide-react';
import styles from './page.module.css';

type TemplateType = 'Petition' | 'Notice' | 'Reply' | 'Affidavit';
type DraftStatus = 'Draft' | 'Review' | 'Ready';
type Priority = 'Standard' | 'Urgent';

type DraftTemplate = {
  id: string;
  title: string;
  type: TemplateType;
  description: string;
  estimatedMinutes: number;
  sections: string[];
};

type WorkingDraft = {
  id: string;
  source: 'live' | 'local';
  caseId?: string;
  templateId: string;
  title: string;
  templateType: TemplateType;
  clientName: string;
  caseReference: string;
  objective: string;
  notes: string;
  dueDate: string;
  priority: Priority;
  status: DraftStatus;
  updatedAt: string;
};

const TEMPLATES: DraftTemplate[] = [
  {
    id: 'tpl-protection-petition',
    title: 'Protection Petition',
    type: 'Petition',
    description: 'Seek immediate court protection and interim relief for the affected client.',
    estimatedMinutes: 18,
    sections: ['Facts Summary', 'Grounds for Relief', 'Urgency Statement', 'Prayer Clause'],
  },
  {
    id: 'tpl-cease-notice',
    title: 'Cease and Desist Notice',
    type: 'Notice',
    description: 'Issue a formal warning demanding immediate stop of harmful conduct.',
    estimatedMinutes: 12,
    sections: ['Recipient Details', 'Acts Complained Of', 'Legal Position', 'Compliance Deadline'],
  },
  {
    id: 'tpl-police-complaint-reply',
    title: 'Police Clarification Reply',
    type: 'Reply',
    description: 'Prepare response to clarify facts and maintain procedural consistency.',
    estimatedMinutes: 14,
    sections: ['Reference Details', 'Point-wise Response', 'Supporting Material', 'Declaration'],
  },
  {
    id: 'tpl-witness-affidavit',
    title: 'Witness Affidavit',
    type: 'Affidavit',
    description: 'Document sworn witness account in a legally admissible structure.',
    estimatedMinutes: 15,
    sections: ['Deponent Information', 'Chronology', 'Statement on Oath', 'Verification'],
  },
  {
    id: 'tpl-interim-relief',
    title: 'Interim Relief Application',
    type: 'Petition',
    description: 'Request urgent temporary orders pending final hearing of the matter.',
    estimatedMinutes: 20,
    sections: ['Cause Title', 'Urgency Narrative', 'Irreparable Harm', 'Interim Prayer'],
  },
  {
    id: 'tpl-hearing-adjournment',
    title: 'Hearing Adjournment Notice',
    type: 'Notice',
    description: 'Formally communicate scheduling constraints and request new hearing date.',
    estimatedMinutes: 10,
    sections: ['Case Reference', 'Reason for Adjournment', 'Suggested Dates', 'Counsel Signature'],
  },
];

const TEMPLATE_TYPES: Array<'All' | TemplateType> = ['All', 'Petition', 'Notice', 'Reply', 'Affidavit'];
const STATUS_FILTERS: Array<'All' | DraftStatus> = ['All', 'Draft', 'Review', 'Ready'];
const STATUS_FLOW: DraftStatus[] = ['Draft', 'Review', 'Ready'];

function inferTemplateType(caseTitle: string): TemplateType {
  const lower = caseTitle.toLowerCase();
  if (lower.includes('notice')) return 'Notice';
  if (lower.includes('reply') || lower.includes('response')) return 'Reply';
  if (lower.includes('affidavit') || lower.includes('witness')) return 'Affidavit';
  return 'Petition';
}

function getTemplateForType(type: TemplateType): DraftTemplate {
  return TEMPLATES.find((template) => template.type === type) ?? TEMPLATES[0];
}

function nextStatus(status: DraftStatus): DraftStatus {
  const currentIndex = STATUS_FLOW.indexOf(status);
  return STATUS_FLOW[(currentIndex + 1) % STATUS_FLOW.length];
}

function formatDate(value: string): string {
  if (!value) return 'No due date';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isDueSoon(value: string): boolean {
  if (!value) return false;

  const now = new Date();
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;

  const diff = due.getTime() - now.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 3;
}

export default function LegalDraftsPage() {
  const { data, loading, error } = useWorkspaceData();
  const [searchQuery, setSearchQuery] = useState('');
  const [templateFilter, setTemplateFilter] = useState<'All' | TemplateType>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | DraftStatus>('All');
  const [activeTemplateId, setActiveTemplateId] = useState(TEMPLATES[0].id);

  const [clientName, setClientName] = useState('');
  const [caseReference, setCaseReference] = useState('');
  const [objective, setObjective] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Priority>('Standard');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  const [drafts, setDrafts] = useState<WorkingDraft[]>([]);

  const filteredTemplates = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();

    return TEMPLATES.filter((template) => {
      const matchesType = templateFilter === 'All' || template.type === templateFilter;
      const matchesSearch =
        !needle ||
        template.title.toLowerCase().includes(needle) ||
        template.description.toLowerCase().includes(needle) ||
        template.sections.join(' ').toLowerCase().includes(needle);

      return matchesType && matchesSearch;
    });
  }, [searchQuery, templateFilter]);

  const activeTemplate = useMemo(() => {
    return TEMPLATES.find((template) => template.id === activeTemplateId) ?? TEMPLATES[0];
  }, [activeTemplateId]);

  const liveDrafts = useMemo<WorkingDraft[]>(() => {
    if (!data) return [];

    const hearingByCase = new Map<string, string>();
    for (const hearing of data.hearings) {
      if (!hearing.case_title) continue;
      hearingByCase.set(hearing.case_title.toLowerCase(), hearing.hearing_time);
    }

    const severeClientNames = new Set(
      data.emergency_alerts
        .filter((alert) => alert.severity === 'high' || alert.severity === 'critical')
        .map((alert) => alert.client_name.toLowerCase())
    );

    return data.cases.map((caseItem) => {
      const templateType = inferTemplateType(caseItem.title);
      const matchedTemplate = getTemplateForType(templateType);
      const caseKey = caseItem.title.toLowerCase();
      const hearingDate = hearingByCase.get(caseKey) ?? '';
      const isUrgent = severeClientNames.has(caseItem.client_name.toLowerCase());

      return {
        id: `live-${caseItem.id}`,
        source: 'live',
        caseId: caseItem.id,
        templateId: matchedTemplate.id,
        title: matchedTemplate.title,
        templateType,
        clientName: caseItem.client_name,
        caseReference: `SH-${caseItem.id.slice(0, 8).toUpperCase()}`,
        objective: `Prepare ${templateType.toLowerCase()} draft for "${caseItem.title}".`,
        notes: caseItem.title,
        dueDate: hearingDate,
        priority: isUrgent ? 'Urgent' : 'Standard',
        status: caseItem.status === 'Closed' ? 'Ready' : 'Review',
        updatedAt: caseItem.updated_at,
      };
    });
  }, [data]);

  const allDrafts = useMemo(() => {
    return [...liveDrafts, ...drafts];
  }, [liveDrafts, drafts]);

  const visibleDrafts = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();

    return allDrafts.filter((draft) => {
      const matchesStatus = statusFilter === 'All' || draft.status === statusFilter;
      const matchesSearch =
        !needle ||
        draft.title.toLowerCase().includes(needle) ||
        draft.clientName.toLowerCase().includes(needle) ||
        draft.caseReference.toLowerCase().includes(needle);

      return matchesStatus && matchesSearch;
    });
  }, [allDrafts, statusFilter, searchQuery]);

  const dueSoonCount = useMemo(() => {
    return allDrafts.filter((draft) => draft.status !== 'Ready' && isDueSoon(draft.dueDate)).length;
  }, [allDrafts]);

  function selectTemplate(template: DraftTemplate) {
    setActiveTemplateId(template.id);
    if (!objective.trim()) {
      setObjective(template.description);
    }
  }

  function handleCreateDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!clientName.trim() || !caseReference.trim()) {
      setMessage('Client name and case reference are required.');
      return;
    }

    const newDraft: WorkingDraft = {
      id: `draft-${Date.now()}`,
      source: 'local',
      templateId: activeTemplate.id,
      title: activeTemplate.title,
      templateType: activeTemplate.type,
      clientName: clientName.trim(),
      caseReference: caseReference.trim(),
      objective: objective.trim() || activeTemplate.description,
      notes: notes.trim(),
      dueDate,
      priority,
      status: 'Draft',
      updatedAt: new Date().toISOString(),
    };

    setDrafts((current) => [newDraft, ...current]);
    setMessage(`Draft created for ${newDraft.clientName}.`);
    setClientName('');
    setCaseReference('');
    setObjective('');
    setNotes('');
    setDueDate('');
    setPriority('Standard');
  }

  function advanceDraftStatus(id: string) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === id
          ? { ...draft, status: nextStatus(draft.status), updatedAt: new Date().toISOString() }
          : draft
      )
    );
  }

  function duplicateDraft(id: string) {
    const source = drafts.find((draft) => draft.id === id);
    if (!source) return;

    const duplicate: WorkingDraft = {
      ...source,
      id: `draft-${Date.now()}`,
      source: 'local',
      status: 'Draft',
      updatedAt: new Date().toISOString(),
    };

    setDrafts((current) => [duplicate, ...current]);
    setMessage(`Duplicate created for ${source.clientName}.`);
  }

  return (
    <LawyerShell
      title="Legal Drafts"
      subtitle="Build, track, and finalize legal documents with reusable templates."
    >
      <div className={styles.page}>
        {error ? <div className={styles.alertError}>{error}</div> : null}
        {loading ? <div className={styles.loadingHint}>Syncing live case records...</div> : null}

        <section className={styles.metricsGrid}>
          <article className={styles.metricCard}>
            <p className={styles.metricLabel}>Templates</p>
            <p className={styles.metricValue}>{filteredTemplates.length}</p>
            <p className={styles.metricSub}>Matching your filters</p>
          </article>
          <article className={styles.metricCard}>
            <p className={styles.metricLabel}>Active Drafts</p>
            <p className={styles.metricValue}>{allDrafts.length}</p>
            <p className={styles.metricSub}>{liveDrafts.length} from live case records</p>
          </article>
          <article className={styles.metricCard}>
            <p className={styles.metricLabel}>Due Soon</p>
            <p className={styles.metricValue}>{dueSoonCount}</p>
            <p className={styles.metricSub}>Within the next 3 days</p>
          </article>
        </section>

        <section className={styles.panel}>
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={16} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search templates, drafts, clients, or case references"
                aria-label="Search legal drafts workspace"
              />
            </div>
            <div className={styles.filterRow}>
              <Filter size={15} />
              {TEMPLATE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`${styles.filterChip} ${templateFilter === type ? styles.filterChipActive : ''}`}
                  onClick={() => setTemplateFilter(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.workspace}>
          <article className={styles.panel}>
            <div className={styles.panelHead}>
              <h3 className={styles.panelTitle}>Template Library</h3>
              <span className={styles.panelBadge}>{filteredTemplates.length} found</span>
            </div>
            <div className={styles.templateList}>
              {filteredTemplates.length === 0 ? (
                <div className={styles.empty}>No templates match your current search.</div>
              ) : (
                filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => selectTemplate(template)}
                    className={`${styles.templateCard} ${
                      activeTemplate.id === template.id ? styles.templateCardActive : ''
                    }`}
                  >
                    <div className={styles.templateHead}>
                      <p className={styles.templateTitle}>{template.title}</p>
                      <span className={styles.typeBadge}>{template.type}</span>
                    </div>
                    <p className={styles.templateDesc}>{template.description}</p>
                    <p className={styles.templateMeta}>
                      <CalendarClock size={14} />
                      Approx. {template.estimatedMinutes} mins
                    </p>
                  </button>
                ))
              )}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHead}>
              <h3 className={styles.panelTitle}>Draft Composer</h3>
              <span className={styles.panelBadge}>{activeTemplate.title}</span>
            </div>

            <form className={styles.form} onSubmit={handleCreateDraft}>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  Client Name
                  <input
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    placeholder="e.g., Priya Rao"
                    required
                  />
                </label>
                <label className={styles.field}>
                  Case Reference
                  <input
                    value={caseReference}
                    onChange={(event) => setCaseReference(event.target.value)}
                    placeholder="e.g., SH-2026-204"
                    required
                  />
                </label>
                <label className={styles.field}>
                  Due Date
                  <input value={dueDate} onChange={(event) => setDueDate(event.target.value)} type="date" />
                </label>
                <label className={styles.field}>
                  Priority
                  <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                    <option value="Standard">Standard</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </label>
              </div>

              <label className={styles.field}>
                Draft Objective
                <textarea
                  rows={3}
                  value={objective}
                  onChange={(event) => setObjective(event.target.value)}
                  placeholder="Summarize what this draft must achieve."
                />
              </label>

              <label className={styles.field}>
                Counsel Notes
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add internal drafting notes, evidence pointers, and hearing context."
                />
              </label>

              <div className={styles.suggestions}>
                <span>
                  <Sparkles size={14} />
                  Quick Insert:
                </span>
                {activeTemplate.sections.map((section) => (
                  <button
                    key={section}
                    type="button"
                    className={styles.suggestionChip}
                    onClick={() => setNotes((current) => `${current}${current ? '\n' : ''}- ${section}`)}
                  >
                    {section}
                  </button>
                ))}
              </div>

              <div className={styles.actions}>
                <button type="submit" className={styles.primaryBtn}>
                  <FilePenLine size={16} />
                  Create Draft
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    setClientName('');
                    setCaseReference('');
                    setObjective('');
                    setNotes('');
                    setDueDate('');
                    setPriority('Standard');
                    setMessage('Composer reset.');
                  }}
                >
                  Clear
                </button>
              </div>
            </form>

            {message ? <p className={styles.message}>{message}</p> : null}

            <div className={styles.preview}>
              <h4>Live Draft Preview</h4>
              <p>
                <strong>Template:</strong> {activeTemplate.title} ({activeTemplate.type})
              </p>
              <p>
                <strong>Client:</strong> {clientName || 'Not set'}
              </p>
              <p>
                <strong>Case:</strong> {caseReference || 'Not set'}
              </p>
              <p>
                <strong>Objective:</strong> {objective || activeTemplate.description}
              </p>
              <p>
                <strong>Due:</strong> {formatDate(dueDate)} | <strong>Priority:</strong> {priority}
              </p>
            </div>
          </article>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>Draft Tracker</h3>
            <div className={styles.statusFilters}>
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`${styles.filterChip} ${statusFilter === status ? styles.filterChipActive : ''}`}
                  onClick={() => setStatusFilter(status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.trackerList}>
            {visibleDrafts.length === 0 ? (
              <div className={styles.empty}>No drafts available for the selected filters.</div>
            ) : (
              visibleDrafts.map((draft) => (
                <article key={draft.id} className={styles.trackerCard}>
                  <div className={styles.trackerMain}>
                    <p className={styles.trackerTitle}>
                      {draft.title} - {draft.clientName}
                    </p>
                    <p className={styles.trackerMeta}>
                      Case {draft.caseReference} | {draft.templateType} | Updated{' '}
                      {new Date(draft.updatedAt).toLocaleString('en-US')}
                    </p>
                    <p className={styles.trackerMeta}>
                      Due {formatDate(draft.dueDate)} | Priority {draft.priority}
                    </p>
                  </div>
                  <div className={styles.trackerActions}>
                    <span
                      className={`${styles.sourceBadge} ${
                        draft.source === 'live' ? styles.sourceLive : styles.sourceLocal
                      }`}
                    >
                      {draft.source === 'live' ? 'Live Data' : 'Session Draft'}
                    </span>
                    <span
                      className={`${styles.statusBadge} ${
                        draft.status === 'Draft'
                          ? styles.statusDraft
                          : draft.status === 'Review'
                          ? styles.statusReview
                          : styles.statusReady
                      }`}
                    >
                      {draft.status}
                    </span>
                    {draft.source === 'local' ? (
                      <>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => advanceDraftStatus(draft.id)}
                        >
                          <Send size={14} />
                          Next Stage
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => duplicateDraft(draft.id)}
                        >
                          <Copy size={14} />
                          Duplicate
                        </button>
                      </>
                    ) : draft.caseId ? (
                      <a href={`/lawyer/analysis/${draft.caseId}`} className={styles.iconBtn}>
                        <FolderOpen size={14} />
                        Open Case
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => {
                        setActiveTemplateId(draft.templateId);
                        setClientName(draft.clientName);
                        setCaseReference(draft.caseReference);
                        setObjective(draft.objective);
                        setNotes(draft.notes);
                        setDueDate(draft.dueDate);
                        setPriority(draft.priority);
                        setMessage(`Loaded ${draft.clientName}'s draft into composer.`);
                      }}
                    >
                      <FolderOpen size={14} />
                      Load
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </LawyerShell>
  );
}
