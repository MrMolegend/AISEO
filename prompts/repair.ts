/**
 * The schema-repair prompt.
 *
 * Sent once, and only once, when an otherwise-complete audit fails validation.
 * It replays the model's own output and names the exact rules it broke, which is
 * far cheaper and more reliable than asking for a fresh audit — the analysis is
 * usually sound and only the bookkeeping is wrong.
 */
export function buildRepairMessage(problems: string[]): string {
  const list = problems.map((problem, index) => `${index + 1}. ${problem}`).join('\n');

  return `Your previous audit did not pass validation. These specific problems were found:

${list}

Produce the complete audit again, corrected.

Important:
- Keep everything that was already correct. Do not rewrite the analysis; fix only what is listed above.
- Return the whole audit, not a patch or a diff.
- Every id referenced from topPriorities and actionPlan must exist in issues.
- Every critical or high severity issue must include evidence.
- Respect every length limit by editing text down, never by cutting it off mid-sentence.`;
}
