export interface Message{
    id: string;
    text: string;
    from: "me" | "them";
    createdAt: string;
    status?: "sent" | "delivered" | "read";
}

export const message: Message[] = [
  {
  id: "1",
  text: "Fantastic news! You worked so hard for it!",
  from: "me",
  createdAt:"1/25/2016-10:55",
  status: "read"
},

];
