import { useEffect, useState } from "react";

export function useAnimatedPlaceholder(
  placeholders: readonly string[],
  typingSpeed = 80,
  deletingSpeed = 40,
  pauseTime = 1200
): string {
  const [text, setText] = useState<string>("");
  const [index, setIndex] = useState<number>(0);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    const current = placeholders[index];
    let timeout: number;

    if (!isDeleting && text.length < current.length) {
      timeout = window.setTimeout(
        () => setText(current.slice(0, text.length + 1)),
        typingSpeed
      );
    } else if (!isDeleting && text.length === current.length) {
      timeout = window.setTimeout(() => setIsDeleting(true), pauseTime);
    } else if (isDeleting && text.length > 0) {
      timeout = window.setTimeout(
        () => setText(current.slice(0, text.length - 1)),
        deletingSpeed
      );
    } else {
      setIsDeleting(false);
      setIndex((i) => (i + 1) % placeholders.length);
    }

    return () => clearTimeout(timeout);
  }, [text, isDeleting, index, placeholders, typingSpeed, deletingSpeed, pauseTime]);

  return text;
}
