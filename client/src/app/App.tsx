import AppRoutes from "./routes";
import { IncomingCallModal } from "../features/calls/IncomingCallModal";
import { CallScreen } from "../features/calls/CallScreen";
import { CallHistory } from "../features/calls/CallHistory";
import { CallSettings } from "../features/calls/CallSettings";

export default function App() {
  return (
    <>
      <AppRoutes />
      <IncomingCallModal />
      <CallScreen />
      <CallHistory />
      <CallSettings />
    </>
  );
}
