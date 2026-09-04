'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { Rule, Meta } from '@/components/ui/panel';

/**
 * The member's task queue. Overdue is stated in words; completing and
 * dropping are one keystroke each; a manual task takes a title and an
 * optional date and lands at the top of your own queue.
 */

export interface TaskView {
  id: string;
  title: string;
  detail: string | null;
  dueOn: string | null;
  accountId: string | null;
  accountName: string | null;
  playbookKey: string | null;
}

export function TaskList({ tasks, today }: { tasks: TaskView[]; today: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function setStatus(id: string, status: 'done' | 'dropped') {
    setFailure(null);
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (response.ok) router.refresh();
    else setFailure('The task could not be updated.');
  }

  async function addTask() {
    if (busy || !title.trim()) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, dueOn: dueOn || null }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setFailure(payload?.message ?? 'The task could not be created.');
        return;
      }
      setTitle('');
      setDueOn('');
      router.refresh();
    } catch {
      setFailure('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {failure && (
        <p role="alert" className="text-copper mb-4 text-[13px]">
          {failure}
        </p>
      )}

      {tasks.length === 0 ? (
        <p className="text-text-muted text-[14px] leading-relaxed">
          Nothing open. Tasks arrive from playbooks, colleagues and your own notes below.
        </p>
      ) : (
        <ul className="border-rule divide-rule divide-y border">
          {tasks.map((task) => {
            const overdue = task.dueOn && task.dueOn < today;
            return (
              <li
                key={task.id}
                className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-text text-[14px] font-medium">{task.title}</p>
                  {task.detail && (
                    <p className="text-text-subtle mt-0.5 text-[13px]">{task.detail}</p>
                  )}
                  {task.accountId && task.accountName && (
                    <Link
                      href={`/leads/${task.accountId}`}
                      className="text-text-subtle text-[12px] hover:underline"
                    >
                      {task.accountName}
                    </Link>
                  )}
                </div>
                {task.dueOn && (
                  <span
                    className={
                      overdue
                        ? 'text-copper text-[12px] font-medium'
                        : 'text-text-subtle text-[12px]'
                    }
                    data-numeric
                  >
                    {overdue ? `Overdue since ${task.dueOn}` : `Due ${task.dueOn}`}
                  </span>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void setStatus(task.id, 'done')}
                  >
                    Done
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void setStatus(task.id, 'dropped')}
                  >
                    Drop
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Rule label="Add a task" className="mt-10" />
      <form
        className="mt-4 flex max-w-2xl flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void addTask();
        }}
      >
        <div className="min-w-0 flex-1">
          <TextField
            label="What needs doing"
            name="taskTitle"
            value={title}
            onChange={setTitle}
          />
        </div>
        <div>
          <label
            htmlFor="task-due"
            className="text-text mb-2 block text-[13px] font-medium"
          >
            Due (optional)
          </label>
          <input
            id="task-due"
            type="date"
            value={dueOn}
            onChange={(event) => setDueOn(event.target.value)}
            className="border-rule-strong bg-ground-raised text-text border px-3 py-2.5 text-[14px]"
          />
        </div>
        <Button type="submit" disabled={busy || !title.trim()}>
          Add
        </Button>
        <Meta aria-hidden="true">Assigned to you</Meta>
      </form>
    </div>
  );
}
