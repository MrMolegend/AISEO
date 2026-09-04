'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * The command palette: Ctrl/Cmd-K, keyboard-first, three sources —
 * navigation commands, the member's saved views, and live account search.
 * Everything reachable here is reachable by links too; the palette is
 * speed, not the only door.
 */

interface Command {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

const NAV_COMMANDS: { label: string; href: string }[] = [
  { label: 'Command Center', href: '/dashboard' },
  { label: 'Lead explorer', href: '/leads' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Pipeline', href: '/pipeline' },
  { label: 'Outreach review queue', href: '/outreach' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Relationships', href: '/relationships' },
  { label: 'Territories', href: '/territories' },
  { label: 'Intelligence', href: '/intelligence' },
  { label: 'Ideal customer profiles', href: '/icps' },
  { label: 'Account settings', href: '/account' },
];

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [views, setViews] = useState<{ id: string; name: string; path: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; canonicalName: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelected(0);
    setSaving(false);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    void fetch('/api/views')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setViews(payload?.views ?? []))
      .catch(() => {});
  }, [open, saving]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (query.trim().length < 2) return;
    debounceRef.current = window.setTimeout(() => {
      void fetch(`/api/leads?q=${encodeURIComponent(query.trim())}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => setAccounts((payload?.accounts ?? []).slice(0, 5)))
        .catch(() => {});
    }, 200);
  }, [query, open]);

  if (!open) return null;

  const lowered = query.trim().toLowerCase();
  // Search results stay in state between keystrokes; short queries simply
  // never show them, so the effect above needs no synchronous clearing.
  const searchable = lowered.length >= 2 ? accounts : [];
  const commands: Command[] = [
    ...NAV_COMMANDS.filter((command) =>
      command.label.toLowerCase().includes(lowered),
    ).map((command) => ({
      id: `nav:${command.href}`,
      label: command.label,
      hint: 'Go to',
      run: () => {
        router.push(command.href);
        close();
      },
    })),
    ...views
      .filter((view) => view.name.toLowerCase().includes(lowered))
      .map((view) => ({
        id: `view:${view.id}`,
        label: view.name,
        hint: 'Saved view',
        run: () => {
          router.push(view.path);
          close();
        },
      })),
    ...searchable.map((account) => ({
      id: `account:${account.id}`,
      label: account.canonicalName,
      hint: 'Account',
      run: () => {
        router.push(`/leads/${account.id}`);
        close();
      },
    })),
    {
      id: 'save-view',
      label: saving ? `Save current page as “${query}”` : 'Save current page as a view…',
      hint: 'Views',
      run: () => {
        if (!saving) {
          // The [open, saving] effect refocuses the input after this.
          setSaving(true);
          setQuery('');
          return;
        }
        const name = query.trim();
        if (!name) return;
        const params = searchParams.toString();
        const path = params ? `${pathname}?${params}` : pathname;
        void fetch('/api/views', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, path }),
        }).finally(() => close());
      },
    },
  ];

  const visible = commands.slice(0, 12);
  const selectedIndex = Math.min(selected, visible.length - 1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[15vh]"
      onClick={close}
    >
      <div
        className="border-rule bg-ground-raised w-full max-w-lg border shadow-[var(--shadow-lift)]"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setSelected((current) => Math.min(current + 1, visible.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setSelected((current) => Math.max(current - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              visible[selectedIndex]?.run();
            }
          }}
          placeholder={
            saving
              ? 'Name for this view, then Enter on the save row'
              : 'Search commands and accounts…'
          }
          aria-label="Command palette input"
          className="text-text placeholder:text-text-subtle w-full border-0 bg-transparent px-4 py-3.5 text-[15px] focus:outline-none"
        />
        <ul
          role="listbox"
          aria-label="Results"
          className="border-rule max-h-80 overflow-y-auto border-t py-1"
        >
          {visible.map((command, index) => (
            <li key={command.id} role="option" aria-selected={index === selectedIndex}>
              <button
                type="button"
                onClick={() => command.run()}
                onMouseEnter={() => setSelected(index)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-[14px] ${
                  index === selectedIndex
                    ? 'bg-ground-sunken text-text'
                    : 'text-text-muted'
                }`}
              >
                <span>{command.label}</span>
                <span className="text-text-subtle text-[11px] tracking-wide uppercase">
                  {command.hint}
                </span>
              </button>
            </li>
          ))}
          {visible.length === 0 && (
            <li className="text-text-subtle px-4 py-3 text-[13px]">Nothing matches.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
