import { JwtPayload } from "jsonwebtoken";
import { signToken, verifyToken as verifyJwtToken } from "../config/jwt";

export const issueJwt = (userId: string) => signToken(userId);

export const verifyToken = (token: string): JwtPayload & { sub?: string } =>
  verifyJwtToken(token);
