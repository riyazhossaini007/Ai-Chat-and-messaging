const HIDDEN_GROUP_MESSAGES_STORAGE_KEY = "plaxeai_hidden_group_messages_v1";

const readHiddenGroupMessages = (): Record<string, string[]> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(HIDDEN_GROUP_MESSAGES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string[] | undefined>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, Array.isArray(value) ? value : []])
    );
  } catch {
    return {};
  }
};

const writeHiddenGroupMessages = (value: Record<string, string[]>) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HIDDEN_GROUP_MESSAGES_STORAGE_KEY, JSON.stringify(value));
};

export { HIDDEN_GROUP_MESSAGES_STORAGE_KEY, readHiddenGroupMessages, writeHiddenGroupMessages };
