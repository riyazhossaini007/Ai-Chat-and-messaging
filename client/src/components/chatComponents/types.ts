export interface Account {
  username: string;
  name: string;
  avatar?: string;
}

export const account : Account [] = [
 {
  username: "@riyaz007",
  name: "Riyaz Hossaini",
  avatar: "",
 },
 {
  username: "@Miraj01",
  name: "Miraj Hossaini",
  avatar: "",
 },
 {
  username: "@elon102",
  name: "Elon Musk",
  avatar: "",
 },
 {
  username: "@zuck",
  name: "Mark Zuck",
  avatar: "",
 },
 {
  username: "@altman020",
  name: "Sam Altman",
  avatar: "",
 },
];





export interface Message {
  id: string;
  sender: "me" | "them";
  kind?: "USER" | "SYSTEM";
  content: string | null;
  text: string | null;
  decryptError?: boolean;
  mediaUrl?: string;
  messageType?: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
  deletedForEveryone?: boolean;
  deletedAt?: string | null;
  deletedById?: string | null;
  replyToId?: string;
  replyTo?: {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    decryptError?: boolean;
    mediaUrl?: string;
    messageType: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
    deletedForEveryone?: boolean;
  } | null;
  isForwarded?: boolean;
  starred?: boolean;
  createdAt?: string;
  time: string;
  status?: "sent" | "delivered" | "read";
  isUploading?: boolean;
  uploadProgress?: number;
  reactionSummary?: Array<{
    emoji: string;
    count: number;
    reactedByMe: boolean;
  }>;
}

export const message : Message[] = [
  {
    id: "001",
    sender: "me",
    content:"hello",
    text: "hello",
    time: "10:55",
    status: "sent",
  },
];



export type SidebarChat = {
  id: string;
  username: string;
  lastMessage: string;
  avatar: string;
  unread?: number;
};
