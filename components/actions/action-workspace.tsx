'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Rule, Meta } from '@/components/ui/panel';
import { TextField, TextAreaField } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import {
  ACTION_PHASES,
  ACTION_PHASE_LABEL,
  ACTION_PRIORITIES,
  ACTION_PRIORITY_LABEL,
  type ActionPhase,
  type ActionStatus,
  type ActionPriority,
} from '@/schemas/action-item';

/**
 * The 30/60/90 workspace.
 *
 * One excellent list, grouped by phase, rather than a board and a list that
 * are each half-finished: every verb here works with a keyboard, announces
 * itself to a screen reader, and persists before it celebrates. Reordering is
 * two buttons, not drag-and-drop — dragging is unusable on mobile and with a
 * keyboard, and "move up" is the entire requirement.
 *
 * Overdue is a fact, not a judgment: rows past their date say "past its
 * date" in words and get a copper accent, and that is all.
 */

export interface WorkspaceAction {
  id: string;
  title: string;
  rationale: string | null;
  phase: ActionPhase;
  status: ActionStatus;
  priority: ActionPriority;
  ownerLabel: string | null;
  dueDate: string | null;
  notes: string | null;
  sortOrder: number;
  /** Where this action came from, when it came from a report. */
  sourceHref: string | null;
  sourceLabel: string | null;
}

const PHASE_ORDER: Record<ActionPhase, number> = {
  'days-1-30': 0,
  'days-31-60': 1,
  'days-61-90': 2,
  later: 3,
};

function isPastDate(action: WorkspaceAction, todayIso: string): boolean {
  return (
    action.dueDate !== null &&
    action.dueDate < todayIso &&
    action.status !== 'done' &&
    action.status !== 'deferred'
  );
}

async function patchAction(
  id: string,
  patch: Record<string, unknown>,
): Promise<WorkspaceAction | null> {
  try {
    const response = await fetch(`/api/actions/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as {
      action?: WorkspaceAction & Record<string, unknown>;
    } | null;
    return payload?.action ?? null;
  } catch {
    return null;
  }
}

export function ActionWorkspace({
  initialActions,
  importFrom = null,
}: {
  initialActions: WorkspaceAction[];
  /** When set, offers "add this report's plan" against that report. */
  importFrom?: { publicId: string; alreadyImported: boolean } | null;
}) {
  const router = useRouter();
  const [actions, setActions] = useState<WorkspaceAction[]>(initialActions);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPhase, setNewPhase] = useState<ActionPhase>('days-1-30');

  const todayIso = new Date().toISOString().slice(0, 10);

  const grouped = useMemo(() => {
    const sorted = [...actions].sort(
      (a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || a.sortOrder - b.sortOrder,
    );
    return ACTION_PHASES.map((phase) => ({
      phase,
      items: sorted.filter((action) => action.phase === phase),
    }));
  }, [actions]);

  const overdueCount = actions.filter((action) => isPastDate(action, todayIso)).length;

  function applyUpdate(updated: WorkspaceAction | null, fallbackMessage: string) {
    if (!updated) {
      setNotice(fallbackMessage);
      return;
    }
    setActions((previous) =>
      previous.map((action) =>
        action.id === updated.id ? { ...action, ...updated } : action,
      ),
    );
  }

  async function setStatus(action: WorkspaceAction, status: ActionStatus) {
    applyUpdate(
      await patchAction(action.id, { status }),
      'That change did not save. Try again.',
    );
  }

  async function move(action: WorkspaceAction, direction: -1 | 1) {
    const phaseItems = grouped.find((group) => group.phase === action.phase)!.items;
    const index = phaseItems.findIndex((item) => item.id === action.id);
    const neighbour = phaseItems[index + direction];
    if (!neighbour) return;

    // Swap sort orders; both writes must land or neither matters much — a
    // half-applied swap is self-correcting on the next move.
    const [a, b] = await Promise.all([
      patchAction(action.id, { sortOrder: neighbour.sortOrder }),
      patchAction(neighbour.id, { sortOrder: action.sortOrder }),
    ]);
    if (a) applyUpdate(a, '');
    if (b) applyUpdate(b, '');
  }

  async function remove(action: WorkspaceAction) {
    try {
      const response = await fetch(`/api/actions/${action.id}`, { method: 'DELETE' });
      if (response.ok) {
        setActions((previous) => previous.filter((item) => item.id !== action.id));
        setNotice(`Deleted “${action.title}”.`);
      } else {
        setNotice('That delete did not go through. Try again.');
      }
    } catch {
      setNotice('That delete did not go through. Try again.');
    }
  }

  async function addAction() {
    if (busy || newTitle.trim().length < 2) return;
    setBusy(true);
    try {
      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: newTitle, phase: newPhase }),
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.action) {
        setActions((previous) => [...previous, payload.action as WorkspaceAction]);
        setNewTitle('');
      } else {
        setNotice(payload?.message ?? 'The action could not be added.');
      }
    } catch {
      setNotice('We could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function importPlan() {
    if (busy || !importFrom) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/research/${importFrom.publicId}/actions`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => null);
      if (response.ok) {
        setNotice(
          `The plan is in your workspace — ${payload?.imported ?? 0} actions, none duplicated.`,
        );
        router.refresh();
      } else {
        setNotice(payload?.message ?? 'The import did not go through.');
      }
    } catch {
      setNotice('We could not reach the server. Nothing was imported.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {importFrom && (
          <Button onClick={() => void importPlan()} disabled={busy}>
            {importFrom.alreadyImported
              ? 'Re-check plan import'
              : 'Add this report’s plan to my workspace'}
          </Button>
        )}
        {overdueCount > 0 && (
          <Meta>
            {overdueCount} {overdueCount === 1 ? 'action is' : 'actions are'} past their
            date
          </Meta>
        )}
      </div>

      {notice && (
        <p role="status" className="text-text-subtle mt-4 text-[13px]">
          {notice}
        </p>
      )}

      {grouped.map(({ phase, items }) => (
        <section key={phase} aria-labelledby={`phase-${phase}`} className="mt-10">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id={`phase-${phase}`} className="text-text text-[16px] font-medium">
              {ACTION_PHASE_LABEL[phase]}
            </h2>
            <Meta>
              {items.filter((item) => item.status === 'done').length}/{items.length} done
            </Meta>
          </div>
          <Rule className="mt-2" />

          {items.length === 0 ? (
            <p className="text-text-faint mt-3 text-[13px]">Nothing in this phase.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {items.map((action, index) => {
                const open = expanded === action.id;
                const past = isPastDate(action, todayIso);
                return (
                  <li
                    key={action.id}
                    className={cn(
                      'border p-3 transition-colors',
                      past ? 'border-copper-line' : 'border-rule',
                      action.status === 'done' && 'opacity-70',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={action.status === 'done'}
                        aria-label={`Mark “${action.title}” ${action.status === 'done' ? 'not done' : 'done'}`}
                        onClick={() =>
                          void setStatus(
                            action,
                            action.status === 'done' ? 'todo' : 'done',
                          )
                        }
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center border transition-colors',
                          action.status === 'done'
                            ? 'border-signal bg-signal text-ground'
                            : 'border-rule-strong hover:border-signal',
                        )}
                      >
                        {action.status === 'done' && (
                          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                            <path
                              d="M2 6l3 3 5-6"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                          </svg>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : action.id)}
                        aria-expanded={open}
                        className={cn(
                          'text-text min-w-0 flex-1 text-left text-[14px] leading-snug',
                          action.status === 'done' && 'line-through decoration-1',
                        )}
                      >
                        {action.title}
                      </button>

                      {action.priority !== 'normal' && (
                        <span
                          className={cn(
                            'shrink-0 text-[11px] tracking-wide uppercase',
                            action.priority === 'critical'
                              ? 'text-copper'
                              : 'text-cobalt',
                          )}
                        >
                          {ACTION_PRIORITY_LABEL[action.priority]}
                        </span>
                      )}
                      {action.dueDate && (
                        <span
                          className={cn(
                            'shrink-0 text-[12px]',
                            past ? 'text-copper' : 'text-text-subtle',
                          )}
                          data-numeric
                        >
                          {action.dueDate}
                          {past && <span> — past its date</span>}
                        </span>
                      )}

                      <span className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          aria-label={`Move “${action.title}” up`}
                          disabled={index === 0}
                          onClick={() => void move(action, -1)}
                          className="text-text-subtle hover:text-text px-1 disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={`Move “${action.title}” down`}
                          disabled={index === items.length - 1}
                          onClick={() => void move(action, 1)}
                          className="text-text-subtle hover:text-text px-1 disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </span>
                    </div>

                    {open && (
                      <ActionEditor
                        action={action}
                        onSaved={(updated) => {
                          applyUpdate(updated, 'That change did not save.');
                          setExpanded(null);
                        }}
                        onStatus={(status) => void setStatus(action, status)}
                        onDelete={() => void remove(action)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      {/* ── Add by hand ────────────────────────────────────────────────── */}
      <Rule label="Add an action" className="mt-12" />
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <TextField
            label="What needs doing?"
            name="newActionTitle"
            value={newTitle}
            onChange={setNewTitle}
            placeholder="Call the Dubai distributor back"
          />
        </div>
        <div>
          <label
            htmlFor="new-action-phase"
            className="text-text mb-2 block text-[13px] font-medium"
          >
            Phase
          </label>
          <select
            id="new-action-phase"
            value={newPhase}
            onChange={(event) => setNewPhase(event.target.value as ActionPhase)}
            className="border-rule-strong bg-ground-raised text-text border px-3 py-2.5 text-[14px]"
          >
            {ACTION_PHASES.map((phase) => (
              <option key={phase} value={phase}>
                {ACTION_PHASE_LABEL[phase]}
              </option>
            ))}
          </select>
        </div>
        <Button
          onClick={() => void addAction()}
          disabled={busy || newTitle.trim().length < 2}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

/* ────────────────────────────── The editor ───────────────────────────────── */

function ActionEditor({
  action,
  onSaved,
  onStatus,
  onDelete,
}: {
  action: WorkspaceAction;
  onSaved: (updated: WorkspaceAction | null) => void;
  onStatus: (status: ActionStatus) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(action.title);
  const [ownerLabel, setOwnerLabel] = useState(action.ownerLabel ?? '');
  const [dueDate, setDueDate] = useState(action.dueDate ?? '');
  const [notes, setNotes] = useState(action.notes ?? '');
  const [priority, setPriority] = useState<ActionPriority>(action.priority);
  const [phase, setPhase] = useState<ActionPhase>(action.phase);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    const updated = await patchAction(action.id, {
      title,
      ownerLabel: ownerLabel.trim() === '' ? null : ownerLabel,
      dueDate: dueDate.trim() === '' ? null : dueDate,
      notes: notes.trim() === '' ? null : notes,
      priority,
      phase,
    });
    setBusy(false);
    onSaved(updated);
  }

  return (
    <div className="border-rule mt-3 border-t pt-3">
      {action.rationale && (
        <p className="text-text-muted text-[13px] leading-relaxed">
          <span className="text-text-subtle">Why: </span>
          {action.rationale}
        </p>
      )}
      {action.sourceHref && (
        <p className="mt-1 text-[13px]">
          <Link
            href={action.sourceHref}
            className="text-cobalt underline-offset-4 hover:underline"
          >
            {action.sourceLabel ?? 'The report that recommended this'}
          </Link>
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Title"
          name={`title-${action.id}`}
          value={title}
          onChange={setTitle}
        />
        <TextField
          label="Owner"
          name={`owner-${action.id}`}
          value={ownerLabel}
          onChange={setOwnerLabel}
          placeholder="Who is doing this"
        />
        <div>
          <label
            htmlFor={`due-${action.id}`}
            className="text-text mb-2 block text-[13px] font-medium"
          >
            Due date
          </label>
          <input
            id={`due-${action.id}`}
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="border-rule-strong bg-ground-raised text-text w-full border px-3 py-2 text-[14px]"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor={`priority-${action.id}`}
              className="text-text mb-2 block text-[13px] font-medium"
            >
              Priority
            </label>
            <select
              id={`priority-${action.id}`}
              value={priority}
              onChange={(event) => setPriority(event.target.value as ActionPriority)}
              className="border-rule-strong bg-ground-raised text-text w-full border px-3 py-2 text-[14px]"
            >
              {ACTION_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {ACTION_PRIORITY_LABEL[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor={`phase-${action.id}`}
              className="text-text mb-2 block text-[13px] font-medium"
            >
              Phase
            </label>
            <select
              id={`phase-${action.id}`}
              value={phase}
              onChange={(event) => setPhase(event.target.value as ActionPhase)}
              className="border-rule-strong bg-ground-raised text-text w-full border px-3 py-2 text-[14px]"
            >
              {ACTION_PHASES.map((value) => (
                <option key={value} value={value}>
                  {ACTION_PHASE_LABEL[value]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <TextAreaField
          label="Notes"
          name={`notes-${action.id}`}
          rows={3}
          value={notes}
          onChange={setNotes}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
        {action.status !== 'deferred' ? (
          <Button variant="secondary" size="sm" onClick={() => onStatus('deferred')}>
            Defer
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => onStatus('todo')}>
            Resume
          </Button>
        )}
        {action.status !== 'in-progress' && action.status !== 'done' && (
          <Button variant="secondary" size="sm" onClick={() => onStatus('in-progress')}>
            Start
          </Button>
        )}
        <span className="ml-auto">
          {confirmDelete ? (
            <span className="flex items-center gap-2">
              <span className="text-text-subtle text-[13px]">Delete for good?</span>
              <Button variant="ghost" size="sm" onClick={onDelete}>
                Yes, delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Keep it
              </Button>
            </span>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </span>
      </div>
    </div>
  );
}
