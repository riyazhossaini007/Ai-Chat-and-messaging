import { Phone, PhoneOff, Video } from "lucide-react";
import { useCallStore } from "./callStore";

export function IncomingCallModal() {
  const incoming = useCallStore((state) => state.incoming);
  const acceptIncomingCall = useCallStore((state) => state.acceptIncomingCall);
  const declineIncomingCall = useCallStore((state) => state.declineIncomingCall);

  if (!incoming) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-cyan-400/30 bg-zinc-950/95 p-5 text-white shadow-2xl">
        <div className="text-sm uppercase tracking-[0.14em] text-cyan-300/90">Incoming Call</div>
        <div className="mt-2 text-xl font-semibold">
          {incoming.type === "VIDEO" ? "Video call" : "Voice call"}
        </div>
        <div className="mt-1 text-sm text-zinc-300">From user: {incoming.incomingFromUserId}</div>
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => {
              void declineIncomingCall();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/15 px-4 py-2 text-rose-200 hover:bg-rose-500/25"
          >
            <PhoneOff size={16} />
            Decline
          </button>
          <button
            type="button"
            onClick={() => {
              void acceptIncomingCall();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-emerald-100 hover:bg-emerald-500/30"
          >
            {incoming.type === "VIDEO" ? <Video size={16} /> : <Phone size={16} />}
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
