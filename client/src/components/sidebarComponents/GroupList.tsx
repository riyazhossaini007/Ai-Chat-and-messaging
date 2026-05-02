import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BellOff,
  Info,
  MoreVertical,
  Pin,
  PinOff,
  Trash2,
  Users,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { createPortal } from "react-dom";

export type GroupRole = "CREATOR" | "ADMIN" | "MEMBER";

export type GroupItem = {
  groupId: string;
  chatId: string;
  title: string;
  avatar?: string | null;
  memberCount: number;
  lastMessage?: string;
  lastMessageAt?: string;
  unseenCount?: number;
  role: GroupRole;
  isPinned?: boolean;
  isArchived?: boolean;
};

export type GroupActionId =
  | "pin"
  | "archive"
  | "mute"
  | "view-info"
  | "leave"
  | "add-members"
  | "remove-members"
  | "edit-description"
  | "edit-rules"
  | "invite-link"
  | "revoke-invite"
  | "assign-admin"
  | "remove-admin"
  | "delete-group";

type GroupAction = {
  id: GroupActionId;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  section: "chat" | "members" | "manage" | "roles" | "danger";
  advanced?: boolean;
  tone?: "danger";
};

type GroupListProps = {
  groups: GroupItem[];
  activeId?: string;
  onSelectGroup?: (group: GroupItem) => void;
  onAction?: (action: GroupActionId, group: GroupItem) => void;
};

const formatTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const menuActionsForRole = (group: GroupItem): GroupAction[] => {
  const common: GroupAction[] = [
    {
      id: "pin",
      label: group.isPinned ? "Unpin group" : "Pin group",
      icon: group.isPinned ? PinOff : Pin,
      section: "chat",
    },
    {
      id: "archive",
      label: group.isArchived ? "Unarchive group" : "Archive group",
      icon: group.isArchived ? ArchiveRestore : Archive,
      section: "chat",
    },
    { id: "mute", label: "Mute notifications", icon: BellOff, section: "chat" },
    { id: "view-info", label: "View group info", icon: Info, section: "chat" },
    { id: "leave", label: "Leave group", icon: LogOut, section: "danger", tone: "danger" },
  ];

  if (group.role !== "CREATOR") return common;
  return [...common, { id: "delete-group", label: "Delete group", icon: Trash2, section: "danger", tone: "danger" }];
};

export default function GroupList({ groups, activeId, onSelectGroup, onAction }: GroupListProps) {
  const [menuGroup, setMenuGroup] = useState<GroupItem | null>(null);
  const [activeMenuSection, setActiveMenuSection] = useState<GroupAction["section"] | null>(null);
  const [confirmLeaveFor, setConfirmLeaveFor] = useState<GroupItem | null>(null);
  const [confirmDeleteFor, setConfirmDeleteFor] = useState<GroupItem | null>(null);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>();

  useEffect(() => {
    if (!menuGroup) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      setMenuGroup(null);
      setActiveMenuSection(null);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuGroup(null);
        setActiveMenuSection(null);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [menuGroup]);

  useEffect(() => {
    if (!menuGroup || !anchorRef.current || !menuRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    const gap = 8;
    const top = anchor.bottom + gap;
    let left = anchor.right - menu.width;
    if (left < gap) left = gap;
    if (left + menu.width > window.innerWidth - gap) {
      left = window.innerWidth - menu.width - gap;
    }
    const availableBelow = Math.max(120, window.innerHeight - top - gap);
    setMenuStyle({
      top: Math.round(top),
      left: Math.round(left),
      maxHeight: Math.round(availableBelow),
      overflowY: "auto",
    });
  }, [menuGroup]);

  const menuActions = useMemo(
    () => (menuGroup ? menuActionsForRole(menuGroup) : []),
    [menuGroup]
  );
  const sectionLabelMap: Record<GroupAction["section"], string> = {
    chat: "Chat",
    members: "Members",
    manage: "Manage",
    roles: "Roles",
    danger: "Danger",
  };
  const sectionOrder: GroupAction["section"][] = ["chat", "members", "manage", "roles", "danger"];
  const sections = sectionOrder
    .map((section) => ({
      section,
      items: menuActions.filter((action) => action.section === section),
    }))
    .filter((entry) => entry.items.length > 0);

  useEffect(() => {
    if (!menuGroup) return;
    if (activeMenuSection && sections.some((entry) => entry.section === activeMenuSection)) return;
    setActiveMenuSection(sections[0]?.section ?? null);
  }, [activeMenuSection, menuGroup, sections]);

  return (
    <div className="flex flex-col gap-1 px-2">
      {groups.map((group) => {
        const isActive = group.groupId === activeId;
        return (
          <button
            key={group.groupId}
            type="button"
            className={`group relative flex w-full items-center gap-3 rounded-xl border px-2 py-2 text-left transition ${
              isActive
                ? "border-cyan-400/45 bg-cyan-400/10 shadow-[0_10px_25px_-18px_rgba(34,211,238,0.9)]"
                : "border-transparent hover:bg-zinc-900/80"
            }`}
            onClick={() => onSelectGroup?.(group)}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-primary-gradient" />
            )}
            <div className={`h-10 w-10 shrink-0 overflow-hidden rounded-full border bg-zinc-800 ${
              isActive ? "border-cyan-300/45" : "border-zinc-700"
            }`}>
              {group.avatar ? (
                <img src={group.avatar} alt={group.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold uppercase text-zinc-200">
                  {group.title.slice(0, 1)}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className={`truncate text-sm font-semibold ${isActive ? "text-cyan-100" : "text-zinc-100"}`}>{group.title}</p>
                <span className={`shrink-0 text-[11px] ${isActive ? "text-cyan-200/80" : "text-zinc-400"}`}>{formatTime(group.lastMessageAt)}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <p className={`truncate text-xs ${isActive ? "text-cyan-100/80" : "text-zinc-400"}`}>
                  {group.lastMessage || `${group.memberCount} members`}
                </p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                    <Users size={12} />
                    {group.memberCount}
                  </span>
                  {(group.unseenCount ?? 0) > 0 && (
                    <span className="rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {(group.unseenCount ?? 0) > 99 ? "99+" : group.unseenCount}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              ref={menuGroup?.groupId === group.groupId ? anchorRef : undefined}
              type="button"
              aria-label="Group menu"
              onClick={(event) => {
                event.stopPropagation();
                setMenuGroup((prev) => (prev?.groupId === group.groupId ? null : group));
                setActiveMenuSection(null);
              }}
              className="shrink-0 rounded-md p-1 text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              <MoreVertical size={16} />
            </button>
          </button>
        );
      })}

      {menuGroup &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="fixed z-[220] w-60 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-xl backdrop-blur"
          >
          {sections.map(({ section, items }) => {
            const isOpen = activeMenuSection === section;
            return (
              <div key={section} className="mb-1 last:mb-0">
                <button
                  type="button"
                  onClick={() => setActiveMenuSection((prev) => (prev === section ? null : section))}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                    section === "danger"
                      ? "text-rose-300 hover:bg-rose-500/10"
                      : "text-zinc-100 hover:bg-white/10"
                  } ${isOpen ? "bg-white/10" : ""}`}
                >
                  <span>{sectionLabelMap[section]}</span>
                  <ChevronRight
                    size={14}
                    className={`transition-transform ${isOpen ? "rotate-90" : "rotate-0"}`}
                  />
                </button>
                {isOpen && (
                  <div className="mt-1 space-y-1 border-l border-zinc-800/80 pl-2">
                    {items.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => {
                          if (action.id === "leave") {
                            setConfirmLeaveFor(menuGroup);
                            setMenuGroup(null);
                            setActiveMenuSection(null);
                            return;
                          }
                          if (action.id === "delete-group") {
                            setConfirmDeleteFor(menuGroup);
                            setMenuGroup(null);
                            setActiveMenuSection(null);
                            return;
                          }
                          onAction?.(action.id, menuGroup);
                          setMenuGroup(null);
                          setActiveMenuSection(null);
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-white/10 ${
                          action.tone === "danger" ? "text-rose-300" : "text-zinc-200"
                        }`}
                      >
                        <action.icon size={14} />
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          </div>,
          document.body
        )}

      {confirmLeaveFor && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-sm font-semibold text-zinc-100">Leave group?</div>
            <p className="mt-2 text-xs text-zinc-400">
              You will stop receiving messages from this group until you join again.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmLeaveFor(null)}
                className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onAction?.("leave", confirmLeaveFor);
                  setConfirmLeaveFor(null);
                }}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm text-white"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteFor && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-sm font-semibold text-zinc-100">Delete group?</div>
            <p className="mt-2 text-xs text-zinc-400">
              This permanently deletes the group and all messages for everyone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteFor(null)}
                className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onAction?.("delete-group", confirmDeleteFor);
                  setConfirmDeleteFor(null);
                }}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
