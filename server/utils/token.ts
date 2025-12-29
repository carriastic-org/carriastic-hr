import crypto from "node:crypto";

export const createRandomToken = (bytes = 48) =>
  crypto.randomBytes(bytes).toString("hex");

export const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const addHours = (hours: number, from = new Date()) =>
  new Date(from.getTime() + hours * 60 * 60 * 1000);
