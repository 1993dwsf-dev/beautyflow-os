/**
 * Convex mutations throw ConvexError for business rules. This helper extracts
 * the pt-BR message so the UI never shows a technical stack or a silent failure.
 */
const FALLBACK =
  "Não foi possível concluir a operação. Tente novamente em instantes.";

export function errorMessage(error: unknown): string {
  if (!error) return FALLBACK;
  const anyError = error as {
    data?: { message?: string; code?: string };
    message?: string;
  };
  if (anyError.data && typeof anyError.data.message === "string") {
    return anyError.data.message;
  }
  const raw = typeof anyError.message === "string" ? anyError.message : "";
  if (!raw) return FALLBACK;
  const cleaned = raw
    .replace(/^Uncaught\s+/i, "")
    .replace(/^ConvexError:\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();
  if (
    !cleaned ||
    /server error/i.test(cleaned) ||
    /\[Request ID/i.test(cleaned) ||
    /internal/i.test(cleaned)
  ) {
    return FALLBACK;
  }
  // ConvexError payloads arrive as a JSON string in some SDK versions.
  if (cleaned.startsWith("{")) {
    try {
      const parsed = JSON.parse(cleaned) as { message?: string };
      if (parsed.message) return parsed.message;
    } catch {
      /* fall through */
    }
  }
  return cleaned;
}

export function errorCode(error: unknown): string | undefined {
  const anyError = error as { data?: { code?: string } };
  return anyError?.data?.code;
}
