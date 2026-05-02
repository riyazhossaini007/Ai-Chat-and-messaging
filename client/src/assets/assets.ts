import logo from "./icon.png";
import logo_full from "./logo_full.png";
import search_icon from "./search_icon.svg";
import user_icon from "./user_icon.svg";
import theme_icon from "./theme_icon.svg";
import send_icon from "./send_icon.svg";
import stop_icon from "./stop_icon.svg";
import mountain_img from "./mountain_img.jpg";
import menu_icon from "./menu_icon.svg";
import close_icon from "./close_icon.svg";
import bin_icon from "./bin_icon.svg";
import logout_icon from "./logout_icon.svg";
import diamond_icon from "./diamond_icon.svg";
import gallery_icon from "./gallery_icon.svg";



export const assets = {
    logo,
    logo_full,
    search_icon,
    user_icon,
    theme_icon,
    send_icon,
    stop_icon,
    mountain_img,
    menu_icon,
    close_icon,
    bin_icon,
    logout_icon,
    diamond_icon,
    gallery_icon
};


/* =======================
   User
======================= */

export interface User {
  _id: string;
  name: string;
  email: string;
  password: string;
  credits: number;
}

/* =======================
   Plan
======================= */

export interface Plan {
  _id: string;
  name: string;
  price: number;
  credits: number;
  features: string[];
}

/* =======================
   Chat Message
======================= */

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  isImage: boolean;
  isPublished: boolean;
  role: MessageRole;
  content: string;
  timestamp: number;
}

/* =======================
   Chat
======================= */

export interface Chat {
  _id: string | number;
  userId: string;
  name: string;
  userName: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}


/* =======================
   Published Image
======================= */

export interface PublishedImage {
  imageUrl: string;
  userName: string;
}

export const dummyUserData: User = {
  _id: "689c6deed410acddc0d95a0e",
  name: "GreatStack",
  email: "admin@example.com",
  password: "$2b$10$VESVdPDjL5LF.KCU6jKyqeXNSLASAAfpR2kkIJExtMO.PJvZJAudy",
  credits: 200,
};

export const dummyPlans: Plan[] = [
  {
    _id: "basic",
    name: "Basic",
    price: 10,
    credits: 100,
    features: [
      "100 text generations",
      "50 image generations",
      "Standard support",
      "Access to basic models",
    ],
  },
  {
    _id: "pro",
    name: "Pro",
    price: 20,
    credits: 500,
    features: [
      "500 text generations",
      "200 image generations",
      "Priority support",
      "Access to pro models",
      "Faster response time",
    ],
  },
  {
    _id: "premium",
    name: "Premium",
    price: 30,
    credits: 1000,
    features: [
      "1000 text generations",
      "500 image generations",
      "24/7 VIP support",
      "Access to premium models",
      "Dedicated account manager",
    ],
  },
];

export const dummyChats: Chat[] = [
  {
    _id: "689de4bbaa932dc3a8ef6cd7",
    userId: "689c6deed410acddc0d95a0e",
    userName: "GreatStack",
    name: "New Chat",
    messages: [
      {
        isImage: false,
        isPublished: false,
        role: "user",
        content: "a boy running on water",
        timestamp: 1755178179612,
      },
      
    ],
    createdAt: "2025-08-14T13:29:31.398Z",
    updatedAt: "2025-08-14T13:29:54.753Z",
  },
  {
    _id: Date.now(),
    userId: "gs123456789",
    userName: "GreatStack",
    name: "New Chat",
    messages: [],
    createdAt: "2025-08-13T17:29:52.421Z",
    updatedAt: "2025-08-14T09:39:19.046Z",
  },
];
