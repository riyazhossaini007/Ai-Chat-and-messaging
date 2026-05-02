import type { Account } from "../chatComponents/types";

type AccountGridProps = {
  accounts: Account[];
};

export default function AccountGrid({ accounts }: AccountGridProps) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <div
          key={`${account.username}-${account.name}`}
          className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
        >
          <div className="w-12 h-12 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
            {account.avatar ? (
              <img
                src={account.avatar}
                alt={account.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-semibold text-zinc-300">
                {account.name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate">
              {account.name}
            </p>
            <p className="text-xs text-zinc-400 truncate">
              {account.username.startsWith("@")
                ? account.username
                : `@${account.username}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
