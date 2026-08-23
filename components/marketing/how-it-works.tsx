const STEPS = [
  {
    number: '01',
    title: 'You enter an address',
    detail:
      'We check it is a real, publicly reachable website before anything else happens.',
  },
  {
    number: '02',
    title: 'We read the page',
    detail:
      'Titles, headings, links, images, structured data, robots directives and the text itself — measured, not guessed.',
  },
  {
    number: '03',
    title: 'The analysis runs',
    detail:
      'Those measurements go to an AI model that interprets them and writes the recommendations. It never invents the underlying data.',
  },
  {
    number: '04',
    title: 'You get a report',
    detail:
      'Scores, issues ranked by impact and effort, an action plan, and a plain statement of what we could not determine.',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="mx-auto max-w-[1240px] px-5 py-20 md:px-8 md:py-28"
    >
      <div className="max-w-2xl">
        <h2 className="text-3xl font-semibold md:text-4xl">How it works</h2>
        <p className="text-ink-muted measure mt-4 text-lg leading-relaxed">
          Four steps, about a minute. No crawler to install, no account to create.
        </p>
      </div>

      <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step) => (
          <li key={step.number} className="relative">
            <span className="text-brand font-mono text-xs font-medium tracking-wider">
              {step.number}
            </span>
            <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
            <p className="text-ink-muted mt-2 text-[15px] leading-relaxed">
              {step.detail}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
