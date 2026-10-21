// A budget is a range of whole numbers in the developer's own currency. Both ends are null when nothing was given.
// A range of 0 to 0 means the project does not pay.

export function budgetOf(request) {
  const min = request.budgetMin ?? null;
  const max = request.budgetMax ?? null;
  if (min === null || max === null) return { kind: "none", min: null, max: null };
  if (max === 0) return { kind: "free", min, max };
  return { kind: "range", min, max };
}

// The budget as plain text for Markdown briefs. Headings and labels stay in English, like the rest of the brief.
export function budgetSummary(request) {
  const budget = budgetOf(request);
  if (budget.kind === "none") return "not given";
  if (budget.kind === "free") return "free";
  return `${budget.min}–${budget.max}`;
}
