import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export const hashPassword = (raw: string) => bcrypt.hash(raw, SALT_ROUNDS);

export const comparePassword = (raw: string, hashed: string) =>
  bcrypt.compare(raw, hashed);
