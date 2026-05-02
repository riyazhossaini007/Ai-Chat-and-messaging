import jwt, { JwtPayload, SignOptions, Secret } from "jsonwebtoken";
import { env } from "./env";

export interface AuthTokenPayload extends JwtPayload {
  sub: string;
}

/**
 * Sign JWT token
 */
export const signToken = (userId: string): string => {
  const secret: Secret = env.JWT_SECRET;

  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };

  return jwt.sign({ sub: userId }, secret, options);
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): AuthTokenPayload => {
  const secret: Secret = env.JWT_SECRET;

  return jwt.verify(token, secret) as AuthTokenPayload;
};
