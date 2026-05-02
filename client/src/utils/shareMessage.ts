type SharePayload = {
  title?: string;
  text?: string;
  url?: string;
};

const isHttpUrl = (value?: string) => Boolean(value && /^https?:\/\//i.test(value));

export const shareMessage = async ({ title = "Euclit", text = "", url }: SharePayload) => {
  const normalizedText = text.trim();
  const normalizedUrl = url?.trim();
  const shareUrl = isHttpUrl(normalizedUrl) ? normalizedUrl : undefined;
  const fallbackText = shareUrl
    ? `${normalizedText || "Shared via Euclit"}\n${shareUrl}`
    : normalizedText || "Shared via Euclit";

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title,
        text: normalizedText || undefined,
        url: shareUrl,
      });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(fallbackText);
      return;
    } catch {
      // fall through to prompt fallback
    }
  }

  if (typeof window !== "undefined") {
    window.prompt("Copy and share this text:", fallbackText);
  }
};
