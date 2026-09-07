/** Shared input styling for the feedback flow. */
/** Shared input styling for the feedback flow.
 *  `jm-field` (not the decorative `jm-line` hairline) so the control boundary
 *  clears WCAG 1.4.11's 3:1, and a full-opacity placeholder so the hint text
 *  clears 4.5:1 — at 60% it landed around 2.5:1 in the light theme. */
export const fieldClass =
  "w-full rounded-lg border border-jm-field bg-jm-black px-3.5 py-2.5 text-sm text-jm-text placeholder:text-jm-muted focus:border-jm-gold";
