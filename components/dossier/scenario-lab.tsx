'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Panel, Rule, Meta } from '@/components/ui/panel';
import { TextField, RadioCards } from '@/components/ui/field';
import {
  scenarioAssumptionsSchema,
  SCENARIO_PRESETS,
  RISK_TOLERANCES,
  RISK_TOLERANCE_LABEL,
  type RiskTolerance,
  type ScenarioAssumptions,
} from '@/schemas/market-entry/scenario-lab';
import {
  computeScenario,
  type ScenarioBase,
  type ComputedFigure,
} from '@/lib/market-entry/scenario-lab';

/**
 * The Scenario Lab.
 *
 * The customer's numbers on the left, what follows from them on the right,
 * and the arithmetic in between shown in words on every figure. Results
 * recompute as assumptions change — the engine is pure integer arithmetic,
 * so there is nothing to wait for and nothing to fetch.
 *
 * The evidence boundary is visual as well as verbal: report-sourced starting
 * values are labelled as such, everything editable is labelled as the
 * customer's assumption, and the footer states plainly that scenarios are
 * planning arithmetic, not forecasts and not financial advice.
 */

interface SavedScenario {
  id: string;
  name: string;
  assumptions: Record<string, unknown>;
}

/** Form state: strings as typed, parsed into assumptions on every render. */
interface LabForm {
  horizonMonths: string;
  price: string;
  unitCost: string;
  budget: string;
  demandLow: string;
  demandHigh: string;
  conversion: string;
  capacity: string;
  wholesaleShare: string;
  wholesaleDiscount: string;
  risk: RiskTolerance;
}

function moneyToMinor(value: string): number | null {
  const trimmed = value.trim().replace(/[^\d.]/g, '');
  if (trimmed.length === 0 || !/\d/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

function minorToMoney(minor: number | null): string {
  return minor === null ? '' : (minor / 100).toFixed(2);
}

function intOr(value: string, fallback: number): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function formFrom(assumptions: Partial<ScenarioAssumptions>): LabForm {
  return {
    horizonMonths: String(assumptions.horizonMonths ?? 12),
    price: minorToMoney(assumptions.priceMinor ?? null),
    unitCost: minorToMoney(assumptions.unitCostMinor ?? null),
    budget: minorToMoney(assumptions.budgetMinor ?? null),
    demandLow: assumptions.monthlyDemandLow ? String(assumptions.monthlyDemandLow) : '',
    demandHigh: assumptions.monthlyDemandHigh
      ? String(assumptions.monthlyDemandHigh)
      : '',
    conversion: String(assumptions.conversionPercent ?? 70),
    capacity:
      assumptions.capacityUnitsPerMonth != null
        ? String(assumptions.capacityUnitsPerMonth)
        : '',
    wholesaleShare: String(assumptions.wholesaleSharePercent ?? 0),
    wholesaleDiscount: String(assumptions.wholesaleDiscountPercent ?? 30),
    risk: assumptions.riskTolerance ?? 'base',
  };
}

function assumptionsFrom(
  form: LabForm,
): ReturnType<typeof scenarioAssumptionsSchema.safeParse> {
  return scenarioAssumptionsSchema.safeParse({
    horizonMonths: intOr(form.horizonMonths, 12),
    priceMinor: moneyToMinor(form.price),
    unitCostMinor: moneyToMinor(form.unitCost),
    budgetMinor: moneyToMinor(form.budget),
    monthlyDemandLow: intOr(form.demandLow, 0),
    monthlyDemandHigh: intOr(form.demandHigh, 0),
    conversionPercent: intOr(form.conversion, 70),
    capacityUnitsPerMonth: form.capacity.trim() === '' ? null : intOr(form.capacity, 0),
    wholesaleSharePercent: intOr(form.wholesaleShare, 0),
    wholesaleDiscountPercent: intOr(form.wholesaleDiscount, 30),
    riskTolerance: form.risk,
  });
}

function Figure({
  label,
  figure,
  render,
}: {
  label: string;
  figure: ComputedFigure;
  render: (value: number) => string;
}) {
  return (
    <div className="border-rule border-t py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-text-muted text-[13px]">{label}</span>
        <span className="text-text text-[17px]" data-numeric>
          {figure.value === null ? '—' : render(figure.value)}
        </span>
      </div>
      <p className="text-text-faint mt-1 text-[12px] leading-relaxed">
        {figure.value === null
          ? `Needs: ${figure.missingInputs.join('; ')}`
          : `= ${figure.formula}`}
      </p>
    </div>
  );
}

export function ScenarioLab({
  publicId,
  base,
  initialAssumptions,
  initialSaved,
}: {
  publicId: string;
  base: ScenarioBase;
  initialAssumptions: Partial<ScenarioAssumptions>;
  initialSaved: SavedScenario[];
}) {
  const [form, setForm] = useState<LabForm>(() => formFrom(initialAssumptions));
  const [saved, setSaved] = useState<SavedScenario[]>(initialSaved);
  const [scenarioName, setScenarioName] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const set = (key: keyof LabForm) => (value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setNotice(null);
  };

  const parsed = useMemo(() => assumptionsFrom(form), [form]);
  const results = useMemo(
    () => (parsed.success ? computeScenario(base, parsed.data) : null),
    [base, parsed],
  );

  const errorFor = (field: string) =>
    parsed.success
      ? undefined
      : parsed.error.issues.find((issue) => String(issue.path[0]) === field)?.message;

  const currency = base.currency ?? '';
  const asMoney = (minor: number) =>
    `${(minor / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;

  async function saveScenario() {
    if (saveBusy || !parsed.success) return;
    setSaveBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/research/${publicId}/scenarios`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: scenarioName, assumptions: parsed.data }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice(payload?.message ?? 'The scenario could not be saved.');
        return;
      }
      const scenario = payload.scenario as SavedScenario;
      setSaved((previous) => [
        scenario,
        ...previous.filter((entry) => entry.id !== scenario.id),
      ]);
      setNotice(`Saved as “${scenario.name}”.`);
      setScenarioName('');
    } catch {
      setNotice('We could not reach the server. Nothing was saved.');
    } finally {
      setSaveBusy(false);
    }
  }

  async function deleteScenario(id: string) {
    try {
      const response = await fetch(`/api/research/${publicId}/scenarios?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setSaved((previous) => previous.filter((entry) => entry.id !== id));
      }
    } catch {
      // Leaving the entry visible is the honest failure mode.
    }
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      {/* ── Assumptions ────────────────────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Meta>Starting points</Meta>
          {RISK_TOLERANCES.map((tolerance) => (
            <Button
              key={tolerance}
              variant={form.risk === tolerance ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                const preset = SCENARIO_PRESETS[tolerance];
                setForm((previous) => ({
                  ...previous,
                  risk: preset.riskTolerance,
                  conversion: String(preset.conversionPercent),
                }));
              }}
            >
              {RISK_TOLERANCE_LABEL[tolerance]}
            </Button>
          ))}
        </div>
        <p className="text-text-faint mt-2 text-[12px] leading-relaxed">
          Presets set the posture and a conversion starting point. They never touch your
          demand range — that claim is yours to make.
        </p>

        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField
              label={`Selling price${currency ? ` (${currency})` : ''}`}
              name="price"
              inputMode="decimal"
              value={form.price}
              onChange={set('price')}
              hint={
                base.targetPriceMinor !== null
                  ? 'Started from the target price in your brief.'
                  : base.currentPriceMinor !== null
                    ? 'Started from the current price in your brief.'
                    : 'Your brief did not name a price.'
              }
              error={errorFor('priceMinor')}
            />
            <TextField
              label={`Unit cost${currency ? ` (${currency})` : ''}`}
              name="unitCost"
              inputMode="decimal"
              value={form.unitCost}
              onChange={set('unitCost')}
              hint={
                base.unitCostMinor !== null
                  ? 'From your brief; edit freely.'
                  : 'Your brief did not name a unit cost.'
              }
              error={errorFor('unitCostMinor')}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField
              label="Monthly demand — low end"
              name="demandLow"
              inputMode="numeric"
              value={form.demandLow}
              onChange={set('demandLow')}
              hint="Units per month. Your assumption — the research does not supply one."
              error={errorFor('monthlyDemandLow')}
            />
            <TextField
              label="Monthly demand — high end"
              name="demandHigh"
              inputMode="numeric"
              value={form.demandHigh}
              onChange={set('demandHigh')}
              error={errorFor('monthlyDemandHigh')}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <TextField
              label="Conversion (%)"
              name="conversion"
              inputMode="numeric"
              value={form.conversion}
              onChange={set('conversion')}
              hint="Share of that demand you win."
              error={errorFor('conversionPercent')}
            />
            <TextField
              label="Capacity (units/month)"
              name="capacity"
              inputMode="numeric"
              value={form.capacity}
              onChange={set('capacity')}
              hint="Blank means unconstrained."
              error={errorFor('capacityUnitsPerMonth')}
            />
            <TextField
              label="Horizon (months)"
              name="horizonMonths"
              inputMode="numeric"
              value={form.horizonMonths}
              onChange={set('horizonMonths')}
              error={errorFor('horizonMonths')}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <TextField
              label={`Launch budget${currency ? ` (${currency})` : ''}`}
              name="budget"
              inputMode="decimal"
              value={form.budget}
              onChange={set('budget')}
              hint={
                base.launchBudgetMinor !== null
                  ? 'From your brief.'
                  : 'Optional — enables the recoup figures.'
              }
              error={errorFor('budgetMinor')}
            />
            <TextField
              label="Wholesale share (%)"
              name="wholesaleShare"
              inputMode="numeric"
              value={form.wholesaleShare}
              onChange={set('wholesaleShare')}
              hint="Volume sold at trade discount."
              error={errorFor('wholesaleSharePercent')}
            />
            <TextField
              label="Trade discount (%)"
              name="wholesaleDiscount"
              inputMode="numeric"
              value={form.wholesaleDiscount}
              onChange={set('wholesaleDiscount')}
              error={errorFor('wholesaleDiscountPercent')}
            />
          </div>

          <RadioCards
            label="Risk posture"
            name="risk"
            value={form.risk}
            onChange={(value) => set('risk')(value)}
            options={RISK_TOLERANCES.map((tolerance) => ({
              value: tolerance,
              label: RISK_TOLERANCE_LABEL[tolerance],
              description:
                tolerance === 'conservative'
                  ? 'Reads the low end of your demand range'
                  : tolerance === 'base'
                    ? 'Reads the midpoint of your range'
                    : 'Reads the high end of your range',
            }))}
            columns={3}
          />
        </div>

        {/* ── Saving ─────────────────────────────────────────────────── */}
        <Rule label="Saved scenarios" className="mt-10" />
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <TextField
              label="Name this scenario"
              name="scenarioName"
              value={scenarioName}
              onChange={setScenarioName}
              placeholder="The cautious one"
            />
          </div>
          <Button
            onClick={() => void saveScenario()}
            disabled={saveBusy || !parsed.success || scenarioName.trim().length === 0}
          >
            {saveBusy ? 'Saving…' : 'Save scenario'}
          </Button>
        </div>
        {notice && (
          <p role="status" className="text-text-subtle mt-3 text-[13px]">
            {notice}
          </p>
        )}

        {saved.length > 0 && (
          <ul className="mt-4 space-y-2">
            {saved.map((scenario) => (
              <li
                key={scenario.id}
                className="border-rule flex flex-wrap items-center justify-between gap-2 border p-3"
              >
                <span className="text-text text-[14px]">{scenario.name}</span>
                <span className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const restored = scenarioAssumptionsSchema.safeParse(
                        scenario.assumptions,
                      );
                      if (restored.success) {
                        setForm(formFrom(restored.data));
                        setNotice(`Loaded “${scenario.name}”.`);
                      }
                    }}
                  >
                    Load
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void deleteScenario(scenario.id)}
                  >
                    Delete
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Results ────────────────────────────────────────────────────── */}
      <div>
        <Panel edge="signal">
          <div className="p-5">
            <Meta>What follows from these numbers</Meta>
            {results ? (
              <div className="mt-3">
                <Figure
                  label="Monthly volume"
                  figure={results.monthlyUnits}
                  render={(value) => `${value.toLocaleString('en-GB')} units`}
                />
                <Figure
                  label={`Volume over ${parsed.success ? parsed.data.horizonMonths : '—'} months`}
                  figure={results.totalUnits}
                  render={(value) => `${value.toLocaleString('en-GB')} units`}
                />
                <Figure
                  label="Blended price per unit"
                  figure={results.blendedPriceMinor}
                  render={asMoney}
                />
                <Figure
                  label="Gross margin per unit"
                  figure={results.grossMarginPerUnitMinor}
                  render={asMoney}
                />
                <Figure
                  label="Gross margin"
                  figure={results.grossMarginPercent}
                  render={(value) => `${value}%`}
                />
                <Figure label="Revenue" figure={results.revenueMinor} render={asMoney} />
                <Figure
                  label="Gross profit"
                  figure={results.grossProfitMinor}
                  render={asMoney}
                />
                <Figure
                  label="Units to recoup launch budget"
                  figure={results.breakEvenUnits}
                  render={(value) => `${value.toLocaleString('en-GB')} units`}
                />
                <Figure
                  label="Months to recoup budget"
                  figure={results.monthsToRecoupBudget}
                  render={(value) => `${value} months`}
                />
                {results.capacityLimited && (
                  <p className="text-copper mt-3 text-[13px] leading-relaxed">
                    Volume is limited by your stated capacity, not by demand.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-text-muted mt-3 text-[14px] leading-relaxed">
                Fix the highlighted assumptions to see results.
              </p>
            )}
          </div>
        </Panel>

        <p className="text-text-faint mt-4 text-[12px] leading-relaxed">
          Scenarios are planning arithmetic over assumptions you control. They are not
          forecasts, not research findings, and not financial advice. Gross figures ignore
          freight, duty, tax and operating costs.
        </p>
      </div>
    </div>
  );
}
