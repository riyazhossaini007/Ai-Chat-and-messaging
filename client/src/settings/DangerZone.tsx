import { useState } from "react";
import type { SettingsSectionProps } from "./SettingsLayout";

type DangerActionProps = {
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
};

function DangerAction({ title, description, buttonLabel, onClick }: DangerActionProps) {
  return (
    <div className="rounded-xl border border-semantic-error/35 bg-zinc-950/70 p-4">
      <div className="text-sm font-semibold text-semantic-error">{title}</div>
      <div className="mt-1 text-xs text-text-muted">{description}</div>
      <button
        type="button"
        onClick={onClick}
        className="mt-3 rounded-lg border border-semantic-error/40 px-3 py-1.5 text-xs text-semantic-error hover:bg-semantic-error/10"
      >
        {buttonLabel}
      </button>
    </div>
  );
}

export default function DangerZone({ showToast, requestConfirm }: SettingsSectionProps) {
  const [deleteInput, setDeleteInput] = useState("");

  const confirmAction = async (title: string, body: string, label: string) => {
    const confirmed = await requestConfirm({
      title,
      body,
      confirmLabel: label,
      tone: "danger",
    });
    return confirmed;
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-semantic-error/35 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(244,63,94,0.55)] md:p-5">
        <h3 className="text-base font-semibold text-semantic-error">Advanced Actions</h3>
        <p className="mt-1 text-xs text-text-muted">
          These actions can cause permanent changes. Confirm carefully before proceeding.
        </p>

        <div className="mt-4 space-y-3">
          <DangerAction
            title="Clear chat cache"
            description="Removes temporary files stored on this device."
            buttonLabel="Clear Cache"
            onClick={async () => {
              const ok = await confirmAction(
                "Clear chat cache?",
                "This will remove local cached data. Messages in cloud history remain available.",
                "Clear"
              );
              if (!ok) return;
              showToast("Chat cache cleared");
            }}
          />

          <DangerAction
            title="Export account data"
            description="Creates a downloadable archive of your account data."
            buttonLabel="Export Data"
            onClick={async () => {
              const ok = await confirmAction(
                "Export account data?",
                "A secure export job will start and a download link will be generated.",
                "Start Export"
              );
              if (!ok) return;
              showToast("Data export started");
            }}
          />

          <DangerAction
            title="Deactivate account"
            description="Temporarily disable your account. You can reactivate later."
            buttonLabel="Deactivate"
            onClick={async () => {
              const ok = await confirmAction(
                "Deactivate account?",
                "Your profile will be hidden until you sign in again.",
                "Deactivate"
              );
              if (!ok) return;
              showToast("Account deactivated", "danger");
            }}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-semantic-error/35 bg-zinc-900/55 p-4 shadow-[0_24px_70px_-52px_rgba(244,63,94,0.55)] md:p-5">
        <h3 className="text-base font-semibold text-semantic-error">Delete Account</h3>
        <p className="mt-1 text-xs text-text-muted">
          Type <span className="font-semibold text-semantic-error">DELETE ACCOUNT</span> to enable this action.
        </p>

        <input
          value={deleteInput}
          onChange={(e) => setDeleteInput(e.target.value)}
          placeholder="DELETE ACCOUNT"
          className="mt-3 w-full rounded-lg border border-semantic-error/40 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none"
        />

        <button
          type="button"
          disabled={deleteInput !== "DELETE ACCOUNT"}
          onClick={async () => {
            const ok = await confirmAction(
              "Permanently delete account?",
              "This action cannot be undone and all account data will be permanently removed.",
              "Delete Forever"
            );
            if (!ok) return;
            showToast("Account deletion requested", "danger");
            setDeleteInput("");
          }}
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            deleteInput === "DELETE ACCOUNT"
              ? "bg-semantic-error text-white hover:opacity-90"
              : "cursor-not-allowed border border-semantic-error/30 text-semantic-error/60"
          }`}
        >
          Delete Account
        </button>
      </section>
    </div>
  );
}
