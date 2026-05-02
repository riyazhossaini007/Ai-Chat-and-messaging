import SettingsLayout from "../settings/SettingsLayout";
import { motion } from "motion/react";
import { slidePanelVariant } from "../lib/motionVariants";

export default function SettingsPage() {
  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#020617]">
      <div className="pointer-events-none absolute -top-36 -left-28 h-[520px] w-[520px] bg-[radial-gradient(circle,rgba(34,211,238,0.2),transparent_70%)] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-44 -right-24 h-[500px] w-[500px] bg-[radial-gradient(circle,rgba(16,185,129,0.16),transparent_70%)] blur-3xl" />

      <motion.div
        variants={slidePanelVariant}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative z-10 flex h-full flex-1 overflow-hidden"
      >
        <SettingsLayout />
      </motion.div>
    </div>
  );
}
