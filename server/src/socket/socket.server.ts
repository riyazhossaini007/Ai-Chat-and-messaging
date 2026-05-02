import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { env } from "../config/env";
import { socketAuthMiddleware } from "./socket.auth";
import { registerSocketEvents } from "./socket.events";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
  IOServer,
} from "./types";

let io: IOServer | null = null;

const resolveCorsOrigin = () => (env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN);

export const initSocket = (server: HttpServer) => {
  io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(server, {
    cors: {
      origin: resolveCorsOrigin(),
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);
  registerSocketEvents(io);

  return io;
};

export const getIO = () => io;
