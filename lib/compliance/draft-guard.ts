/** Shared by the generator, the confirm step, and the authoring form. */
export const UNUSABLE_CHECKABLE_INTENT =
  "No checkable condition was produced. This draft must not be evaluated until a precise condition is written.";

export function isUsableCheckableIntent(checkableIntent: string): boolean {
  const text = checkableIntent.trim();
  return text.length >= 20 && text !== UNUSABLE_CHECKABLE_INTENT;
}
