'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Rule, Meta } from '@/components/ui/panel';
import { TextField, TextAreaField, RadioCards } from '@/components/ui/field';
import { ChipInput } from '@/components/ui/chip-input';

/**
 * The brand catalogue.
 *
 * Ships empty on purpose: no verified brand list was reachable at build
 * time, and a guessed catalogue would put invented facts under real
 * outreach. Every row here was typed by a person with authority, and shows
 * when it was recorded.
 */

export interface BrandView {
  id: string;
  name: string;
  categories: string[];
  positioning: 'premium' | 'mid-market' | 'value' | 'mixed' | null;
  exclusivityNotes: string;
  source: string;
  recordedOn: string;
  active: boolean;
}

export function BrandCatalogue({ initial }: { initial: BrandView[] }) {
  const [brands, setBrands] = useState(initial);
  const [failure, setFailure] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [positioning, setPositioning] = useState<string>('premium');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch('/api/commercial/brands', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          categories,
          positioning: positioning === 'unset' ? null : positioning,
          exclusivityNotes: notes,
          source: 'alt_admin',
          active: true,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFailure(
          payload?.issues?.[0]?.message ??
            payload?.message ??
            'The brand could not be saved.',
        );
        return;
      }
      setBrands((current) =>
        [...current, payload.brand as BrandView].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setName('');
      setCategories([]);
      setNotes('');
    } catch {
      setFailure('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function setActive(brand: BrandView, active: boolean) {
    setFailure(null);
    const response = await fetch(`/api/commercial/brands/${brand.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: brand.name,
        categories: brand.categories,
        positioning: brand.positioning,
        exclusivityNotes: brand.exclusivityNotes,
        source: brand.source,
        recordedOn: brand.recordedOn,
        active,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setFailure(payload?.message ?? 'The change was not saved.');
      return;
    }
    setBrands((current) =>
      current.map((b) => (b.id === brand.id ? (payload.brand as BrandView) : b)),
    );
  }

  return (
    <section aria-labelledby="catalogue-heading">
      <Rule label="Brand catalogue" className="mt-12" />
      <p id="catalogue-heading" className="text-text-muted mt-2 text-[13px]">
        The brands and lines ALT distributes, entered by an administrator. Product
        matching and outreach only ever reference rows that exist here — nothing is
        inferred from the &ldquo;more than 40 brands&rdquo; claim, which stays a sourced
        statement, not a list.
      </p>

      {failure && (
        <p role="alert" className="text-copper mt-4 text-[14px]">
          {failure}
        </p>
      )}

      <ul className="border-rule divide-rule mt-4 divide-y border">
        {brands.map((brand) => (
          <li
            key={brand.id}
            className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-text text-[14px] font-medium">
                {brand.name}
                {!brand.active && <span className="text-text-subtle"> (inactive)</span>}
              </p>
              <p className="text-text-subtle mt-0.5 text-[12px]">
                {brand.categories.length > 0
                  ? brand.categories.join(', ')
                  : 'No categories'}
                {brand.positioning ? ` · ${brand.positioning}` : ''} · recorded{' '}
                {brand.recordedOn}
              </p>
              {brand.exclusivityNotes && (
                <p className="text-text-muted mt-1 text-[12px] leading-relaxed">
                  {brand.exclusivityNotes}
                </p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void setActive(brand, !brand.active)}
            >
              {brand.active ? 'Deactivate' : 'Reactivate'}
            </Button>
          </li>
        ))}
        {brands.length === 0 && (
          <li className="text-text-muted px-4 py-6 text-center text-[13px]">
            The catalogue is empty. Add the brands ALT actually distributes;
            recommendations stay silent until it has entries.
          </li>
        )}
      </ul>

      <form
        className="mt-6 max-w-2xl space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
        noValidate
      >
        <TextField
          label="Brand name"
          name="brandName"
          required
          value={name}
          onChange={setName}
        />
        <ChipInput
          label="Categories"
          name="brandCategories"
          value={categories}
          onChange={setCategories}
          max={20}
          placeholder="Dog food, cat litter, aquatics…"
        />
        <RadioCards
          label="Positioning"
          name="brandPositioning"
          value={positioning}
          onChange={setPositioning}
          options={[
            { value: 'premium', label: 'Premium' },
            { value: 'mid-market', label: 'Mid-market' },
            { value: 'value', label: 'Value' },
            { value: 'mixed', label: 'Mixed' },
          ]}
          columns={2}
        />
        <TextAreaField
          label="Exclusivity notes"
          name="brandExclusivity"
          rows={2}
          value={notes}
          onChange={setNotes}
          hint="Territory restrictions or exclusive arrangements, with their dates. Matching never suggests a restricted combination."
        />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? 'Adding…' : 'Add brand'}
          </Button>
          <Meta aria-hidden="true">Recorded under your authority, dated today</Meta>
        </div>
      </form>
    </section>
  );
}
