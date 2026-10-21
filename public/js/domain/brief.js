// A Markdown summary for pasting into an issue tracker or notes. The headings stay in English on purpose.
// Contact details are left out, because briefs are often pasted into public places.

function formatQuote(quote) {
  if (!quote) return "not sent";
  const parts = [`${quote.amount} ${quote.currency}`];
  if (quote.timeline) parts.push(quote.timeline);
  if (quote.validUntil) parts.push(`valid until ${quote.validUntil}`);
  return parts.join(", ");
}

export function buildBrief(
  request,
  { preferredChannel = null, internalNotes = "", tags = [] } = {},
) {
  const lines = [
    `# ${request.title}`,
    "",
    `- **App name:** ${request.appName}`,
    `- **Requester:** ${request.requesterName}`,
    `- **Status:** ${request.status}`,
    `- **Platforms:** ${request.platforms.join(", ")}`,
    `- **Template:** ${request.template ?? "none"}`,
    `- **Budget:** ${request.budgetRange ?? "not given"}`,
    `- **Deadline:** ${request.deadline ?? "none"}`,
    `- **Preferred contact:** ${preferredChannel ?? "not given"}`,
    `- **Quote:** ${formatQuote(request.quote)}`,
    "",
    "## Description",
    "",
    request.appDescription,
  ];
  if (request.notes) lines.push("", "## Notes from the requester", "", request.notes);
  if (internalNotes) lines.push("", "## Internal notes", "", internalNotes);
  if (tags.length > 0) lines.push("", `Tags: ${tags.join(", ")}`);
  return `${lines.join("\n")}\n`;
}
