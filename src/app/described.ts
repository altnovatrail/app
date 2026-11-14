// The value of `aria-describedby` for a field: the IDs of its hint and error that are shown (section
// 3.9 of docs/architecture.md; WCAG 3.3.1).

/** The IDs given, those not `false`, as `aria-describedby` names them; none — no attribute. */
export function described(...ids: (string | false)[]): string | undefined {
  const named = ids.filter((id): id is string => id !== false);
  return named.length === 0 ? undefined : named.join(" ");
}
