'use client';

import { useMemo, useState } from 'react';
import LawyerShell from '@/components/lawyer/LawyerShell';
import { useWorkspaceData } from '@/lib/lawyer/useWorkspaceData';
import styles from '../workspace.module.css';

type CalendarEventType = 'selection' | 'contact' | 'case' | 'hearing' | 'alert';

type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  date: Date;
  title: string;
  detail: string;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EVENT_LABELS: Record<CalendarEventType, string> = {
  selection: 'Lawyer chosen',
  contact: 'Client contacted',
  case: 'Case activity',
  hearing: 'Hearing',
  alert: 'Emergency alert',
};

const EVENT_PRIORITY: Record<CalendarEventType, number> = {
  hearing: 1,
  alert: 2,
  contact: 3,
  selection: 4,
  case: 5,
};

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildMonthGrid(month: Date): Date[] {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const offset = firstDay.getDay();
  const totalCells = Math.ceil((offset + lastDay.getDate()) / 7) * 7;
  const startDate = new Date(month.getFullYear(), month.getMonth(), 1 - offset);

  const dates: Date[] = [];
  for (let index = 0; index < totalCells; index += 1) {
    const nextDate = new Date(startDate);
    nextDate.setDate(startDate.getDate() + index);
    dates.push(nextDate);
  }

  return dates;
}

function formatMonthLabel(value: Date): string {
  return value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDateLabel(value: Date): string {
  return value.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatDateTimeLabel(value: Date): string {
  return value.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function dateFromDayKey(value: string): Date {
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  return new Date(year, month - 1, day);
}

export default function CalendarPage() {
  const { data, loading, error } = useWorkspaceData();
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(() => dayKey(new Date()));
  const today = useMemo(() => new Date(), []);

  const events = useMemo<CalendarEvent[]>(() => {
    if (!data) return [];

    const items: CalendarEvent[] = [];

    for (const client of data.clients) {
      const selectedDate = parseDate(client.selected_at ?? client.joined_at);
      if (selectedDate) {
        items.push({
          id: `selection-${client.id}`,
          type: 'selection',
          date: selectedDate,
          title: `${client.name} chose you as lawyer`,
          detail: client.location || 'Client location unavailable',
        });
      }

      const contactedDate = parseDate(client.contacted_at ?? '');
      if (
        contactedDate &&
        (!selectedDate || contactedDate.getTime() !== selectedDate.getTime())
      ) {
        items.push({
          id: `contact-${client.id}`,
          type: 'contact',
          date: contactedDate,
          title: `${client.name} contacted legal support`,
          detail: 'First support interaction recorded',
        });
      }
    }

    for (const caseItem of data.cases) {
      const caseDate = parseDate(caseItem.updated_at);
      if (!caseDate) continue;

      items.push({
        id: `case-${caseItem.id}`,
        type: 'case',
        date: caseDate,
        title: caseItem.title,
        detail: `${caseItem.client_name} - ${caseItem.status}`,
      });
    }

    for (const hearing of data.hearings) {
      const hearingDate = parseDate(hearing.hearing_time);
      if (!hearingDate) continue;

      items.push({
        id: `hearing-${hearing.id}`,
        type: 'hearing',
        date: hearingDate,
        title: hearing.case_title,
        detail: hearing.venue || 'Venue not available',
      });
    }

    for (const alert of data.emergency_alerts) {
      const alertDate = parseDate(alert.time);
      if (!alertDate) continue;

      items.push({
        id: `alert-${alert.id}`,
        type: 'alert',
        date: alertDate,
        title: `${alert.client_name} - ${alert.severity.toUpperCase()} alert`,
        detail: alert.location || 'Location unavailable',
      });
    }

    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [data]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    for (const event of events) {
      const key = dayKey(event.date);
      const current = map.get(key);
      if (!current) {
        map.set(key, [event]);
      } else {
        current.push(event);
      }
    }

    for (const [key, dayEvents] of map.entries()) {
      dayEvents.sort((a, b) => {
        if (a.date.getTime() !== b.date.getTime()) {
          return a.date.getTime() - b.date.getTime();
        }

        return EVENT_PRIORITY[a.type] - EVENT_PRIORITY[b.type];
      });
      map.set(key, dayEvents);
    }

    return map;
  }, [events]);

  const monthDays = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);
  const selectedDayEvents = eventsByDay.get(selectedDateKey) ?? [];

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events.filter((event) => event.date.getTime() >= now.getTime()).slice(0, 8);
  }, [events]);

  const monthEventCount = useMemo(() => {
    const selectedMonth = monthKey(visibleMonth);
    return events.filter((event) => monthKey(event.date) === selectedMonth).length;
  }, [events, visibleMonth]);

  function moveMonth(offset: number) {
    setVisibleMonth((current) => {
      const nextMonth = new Date(current.getFullYear(), current.getMonth() + offset, 1);
      setSelectedDateKey(dayKey(nextMonth));
      return nextMonth;
    });
  }

  function jumpToToday() {
    const now = new Date();
    setVisibleMonth(startOfMonth(now));
    setSelectedDateKey(dayKey(now));
  }

  return (
    <LawyerShell
      title="Calendar"
      subtitle="Case timeline calendar with client selection, contact, and hearing milestones."
    >
      <section className={styles.panel}>
        <div className={styles.calendarToolbar}>
          <div>
            <h3 className={styles.panelTitle}>Case Calendar</h3>
            <p className={styles.calendarMeta}>
              {formatMonthLabel(visibleMonth)} - {monthEventCount} marked events
            </p>
          </div>
          <div className={styles.calendarActions}>
            <button type="button" className={styles.calendarButton} onClick={() => moveMonth(-1)}>
              Prev
            </button>
            <button type="button" className={styles.calendarButton} onClick={jumpToToday}>
              Today
            </button>
            <button type="button" className={styles.calendarButton} onClick={() => moveMonth(1)}>
              Next
            </button>
          </div>
        </div>

        {error ? (
          <div className={styles.placeholder}>{error}</div>
        ) : loading ? (
          <div className={styles.placeholder}>Loading timeline calendar...</div>
        ) : (
          <div className={styles.calendarLayout}>
            <div className={styles.calendarGridWrap}>
              <div className={styles.calendarWeekHeader}>
                {DAY_NAMES.map((dayName) => (
                  <span key={dayName} className={styles.calendarWeekLabel}>
                    {dayName}
                  </span>
                ))}
              </div>
              <div className={styles.calendarGrid}>
                {monthDays.map((date) => {
                  const key = dayKey(date);
                  const dayEvents = eventsByDay.get(key) ?? [];
                  const inCurrentMonth = date.getMonth() === visibleMonth.getMonth();
                  const isSelected = key === selectedDateKey;
                  const isToday = key === dayKey(today);

                  return (
                    <button
                      key={key}
                      type="button"
                      className={[
                        styles.calendarCell,
                        inCurrentMonth ? '' : styles.calendarCellMuted,
                        isSelected ? styles.calendarCellSelected : '',
                        isToday ? styles.calendarCellToday : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setSelectedDateKey(key)}
                    >
                      <span className={styles.calendarDate}>{date.getDate()}</span>
                      <span className={styles.calendarDayCount}>
                        {dayEvents.length > 0 ? `${dayEvents.length} event(s)` : 'No events'}
                      </span>
                      <span className={styles.calendarDots}>
                        {dayEvents.slice(0, 3).map((event) => (
                          <span
                            key={event.id}
                            className={`${styles.calendarDot} ${styles[`calendarDot${event.type}`]}`}
                            title={`${EVENT_LABELS[event.type]}: ${event.title}`}
                          />
                        ))}
                        {dayEvents.length > 3 ? (
                          <span className={styles.calendarMore}>+{dayEvents.length - 3}</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className={styles.calendarSidebar}>
              <div className={styles.calendarLegend}>
                {(Object.keys(EVENT_LABELS) as CalendarEventType[]).map((type) => (
                  <span key={type} className={styles.calendarLegendItem}>
                    <span className={`${styles.calendarDot} ${styles[`calendarDot${type}`]}`} />
                    {EVENT_LABELS[type]}
                  </span>
                ))}
              </div>

              <div className={styles.calendarAgenda}>
                <h4 className={styles.primary}>{formatDateLabel(dateFromDayKey(selectedDateKey))}</h4>
                {selectedDayEvents.length === 0 ? (
                  <p className={styles.secondary}>No case milestones recorded for this day.</p>
                ) : (
                  <div className={styles.calendarAgendaList}>
                    {selectedDayEvents.map((event) => (
                      <article key={event.id} className={styles.calendarAgendaItem}>
                        <span className={`${styles.badge} ${styles[`calendarTag${event.type}`]}`}>
                          {EVENT_LABELS[event.type]}
                        </span>
                        <p className={styles.primary}>{event.title}</p>
                        <p className={styles.secondary}>{event.detail}</p>
                        <p className={styles.calendarTime}>{formatDateTimeLabel(event.date)}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.calendarAgenda}>
                <h4 className={styles.primary}>Upcoming</h4>
                {upcomingEvents.length === 0 ? (
                  <p className={styles.secondary}>No upcoming milestones recorded.</p>
                ) : (
                  <div className={styles.calendarUpcomingList}>
                    {upcomingEvents.map((event) => (
                      <article key={`${event.id}-upcoming`} className={styles.calendarUpcomingItem}>
                        <p className={styles.primary}>{event.title}</p>
                        <p className={styles.secondary}>
                          {EVENT_LABELS[event.type]} - {formatDateTimeLabel(event.date)}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </section>
    </LawyerShell>
  );
}
