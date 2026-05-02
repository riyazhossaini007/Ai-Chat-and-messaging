export type MediaScope = "chat" | "all";

export type SidebarMediaItem = {
  id: string;
  title: string;
  type: "image" | "video" | "file";
  previewUrl: string;
  fullUrl?: string;
  chatId?: string;
  groupId?: string;
  aiSessionId?: string;
};

export const userMediaItems: SidebarMediaItem[] = [
  {
    id: "u-1",
    title: "City skyline",
    type: "image",
    previewUrl: "https://picsum.photos/seed/plx-user-1/640/420",
    chatId: "riyaz007",
  },
  {
    id: "u-2",
    title: "Weekend road clip",
    type: "video",
    previewUrl: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
    chatId: "riyaz007",
  },
  {
    id: "u-3",
    title: "Workspace setup",
    type: "image",
    previewUrl: "https://picsum.photos/seed/plx-user-2/640/420",
    chatId: "Miraj01",
  },
  {
    id: "u-4",
    title: "Design draft",
    type: "image",
    previewUrl: "https://picsum.photos/seed/plx-user-3/640/420",
    chatId: "elon102",
  },
  {
    id: "u-5",
    title: "Launch teaser",
    type: "video",
    previewUrl: "https://samplelib.com/lib/preview/mp4/sample-10s.mp4",
    chatId: "zuck",
  },
  {
    id: "u-6",
    title: "Product snapshot",
    type: "image",
    previewUrl: "https://picsum.photos/seed/plx-user-4/640/420",
    chatId: "altman020",
  },
];

export const groupMediaItems: SidebarMediaItem[] = [
  {
    id: "g-1",
    title: "Sprint board",
    type: "image",
    previewUrl: "https://picsum.photos/seed/plx-group-1/640/420",
    groupId: "engineering-hub",
  },
  {
    id: "g-2",
    title: "Demo walkthrough",
    type: "video",
    previewUrl: "https://samplelib.com/lib/preview/mp4/sample-15s.mp4",
    groupId: "engineering-hub",
  },
  {
    id: "g-3",
    title: "Marketing concept",
    type: "image",
    previewUrl: "https://picsum.photos/seed/plx-group-2/640/420",
    groupId: "growth-team",
  },
  {
    id: "g-4",
    title: "Campaign reel",
    type: "video",
    previewUrl: "https://samplelib.com/lib/preview/mp4/sample-20s.mp4",
    groupId: "growth-team",
  },
  {
    id: "g-5",
    title: "UI references",
    type: "image",
    previewUrl: "https://picsum.photos/seed/plx-group-3/640/420",
    groupId: "design-club",
  },
];

export const aiMediaItems: SidebarMediaItem[] = [
  {
    id: "a-1",
    title: "Vision render 01",
    type: "image",
    previewUrl: "https://picsum.photos/seed/plx-ai-1/640/420",
    aiSessionId: "vision-1",
  },
  {
    id: "a-2",
    title: "Logic flow capture",
    type: "image",
    previewUrl: "https://picsum.photos/seed/plx-ai-2/640/420",
    aiSessionId: "logic-2",
  },
  {
    id: "a-3",
    title: "Code explainer clip",
    type: "video",
    previewUrl: "https://samplelib.com/lib/preview/mp4/sample-30s.mp4",
    aiSessionId: "code-1",
  },
  {
    id: "a-4",
    title: "Creative storyboard",
    type: "image",
    previewUrl: "https://picsum.photos/seed/plx-ai-3/640/420",
    aiSessionId: "spark-2",
  },
  {
    id: "a-5",
    title: "Sage summary board",
    type: "image",
    previewUrl: "https://picsum.photos/seed/plx-ai-4/640/420",
    aiSessionId: "sage-1",
  },
];
