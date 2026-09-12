/**
 * Turn a provider error into something worth showing a person.
 *
 * Gemini returns its failures as a JSON blob; putting that straight in the UI
 * leaks internals and reads as a crash. Pull out the human sentence, and fall
 * back to a plain description of the common cases.
 *
 * Lives outside the "use server" action module because a server-action file may
 * only export async functions.
 */
export function humanizeAiError(raw: string): string {
  let message = raw;
  const start = raw.indexOf("{");
  if (start !== -1) {
    try {
      const parsed = JSON.parse(raw.slice(start));
      message = parsed?.error?.message ?? raw;
    } catch {
      // Not JSON after all — keep the original text.
    }
  }
  if (/quota|RESOURCE_EXHAUSTED|429/i.test(raw)) {
    return "the daily AI quota is used up";
  }
  if (/UNAVAILABLE|503|high demand|overloaded/i.test(raw)) {
    return "the AI service is busy right now";
  }
  if (/API key|API_KEY_INVALID|PERMISSION_DENIED|401|403/i.test(raw)) {
    return "the AI key was rejected";
  }
  const trimmed = message.trim().replace(/\s+/g, " ");
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
}
