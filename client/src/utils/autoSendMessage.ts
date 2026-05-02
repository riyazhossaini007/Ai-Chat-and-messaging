import { useEffect, useRef } from "react";

type Params = {
  initialMessage?: string;
  sendMessage: (msg: string) => void;
};

export const useAutoSendMessage = ({
  initialMessage,
  sendMessage,
}: Params) => {
  const sentRef = useRef(false);

  useEffect(() => {
    if (!initialMessage) return;
    if (sentRef.current) return;

    sendMessage(initialMessage);
    sentRef.current = true;
  }, [initialMessage, sendMessage]);
};
