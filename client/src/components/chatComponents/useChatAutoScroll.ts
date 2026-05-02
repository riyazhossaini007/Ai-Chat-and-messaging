import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

type ScrollBehaviorMode = "smooth" | "auto";
type MessageArrivalType = "incoming" | "outgoing" | "system";

type UseChatAutoScrollArgs = {
  containerRef: RefObject<HTMLElement | null>;
  deps?: readonly unknown[];
  threshold?: number;
};

type ScrollToBottomOptions = {
  behavior?: ScrollBehaviorMode;
};

const DEFAULT_THRESHOLD = 80;

export function useChatAutoScroll({
  containerRef,
  deps = [],
  threshold = DEFAULT_THRESHOLD,
}: UseChatAutoScrollArgs) {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);

  const isAtBottomRef = useRef(true);
  const unseenCountRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  const scrollListenerRafRef = useRef<number | null>(null);
  const pendingScrollBehaviorRef = useRef<ScrollBehaviorMode | null>(null);
  const previousMetricsRef = useRef({
    scrollTop: 0,
    scrollHeight: 0,
  });

  const updateBottomState = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
    const nextAtBottom = distance <= threshold;
    isAtBottomRef.current = nextAtBottom;
    setIsAtBottom(nextAtBottom);
    if (nextAtBottom && unseenCountRef.current > 0) {
      unseenCountRef.current = 0;
      setUnseenCount(0);
    }
    return nextAtBottom;
  }, [containerRef, threshold]);

  const runScrollToBottom = useCallback((behavior: ScrollBehaviorMode) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    isAtBottomRef.current = true;
    setIsAtBottom(true);
    if (unseenCountRef.current > 0) {
      unseenCountRef.current = 0;
      setUnseenCount(0);
    }
  }, [containerRef]);

  const scrollToBottom = useCallback(
    ({ behavior = "auto" }: ScrollToBottomOptions = {}) => {
      pendingScrollBehaviorRef.current = behavior;
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        const nextBehavior = pendingScrollBehaviorRef.current ?? "auto";
        pendingScrollBehaviorRef.current = null;
        runScrollToBottom(nextBehavior);
      });
    },
    [runScrollToBottom]
  );

  const onNewMessage = useCallback(
    (type: MessageArrivalType) => {
      if (type === "outgoing") {
        scrollToBottom({ behavior: "smooth" });
        return;
      }

      const nearBottom = updateBottomState();
      if (nearBottom) {
        scrollToBottom({ behavior: "smooth" });
        return;
      }

      unseenCountRef.current += 1;
      setUnseenCount(unseenCountRef.current);
    },
    [scrollToBottom, updateBottomState]
  );

  const onPrependMessages = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollTop: previousTop, scrollHeight: previousHeight } = previousMetricsRef.current;
    window.requestAnimationFrame(() => {
      const nextEl = containerRef.current;
      if (!nextEl) return;
      const heightDelta = nextEl.scrollHeight - previousHeight;
      if (heightDelta <= 0) return;
      nextEl.scrollTop = previousTop + heightDelta;
      updateBottomState();
    });
  }, [containerRef, updateBottomState]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      if (scrollListenerRafRef.current !== null) return;
      scrollListenerRafRef.current = window.requestAnimationFrame(() => {
        scrollListenerRafRef.current = null;
        updateBottomState();
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    updateBottomState();

    return () => {
      el.removeEventListener("scroll", onScroll);
      if (scrollListenerRafRef.current !== null) {
        window.cancelAnimationFrame(scrollListenerRafRef.current);
        scrollListenerRafRef.current = null;
      }
    };
  }, [containerRef, updateBottomState]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    previousMetricsRef.current = {
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
    };
    updateBottomState();
  }, [containerRef, updateBottomState, ...deps]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, []);

  return {
    isAtBottom,
    unseenCount,
    scrollToBottom,
    onNewMessage,
    onPrependMessages,
  };
}
