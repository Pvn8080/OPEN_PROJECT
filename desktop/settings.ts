import { z } from "zod";
const schema = z.object({
  baseURL: z
    .string()
    .url()
    .refine((value) => {
      const u = new URL(value);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash
      );
    }, "Use an HTTPS provider URL without credentials, query or fragment"),
  model: z.string().trim().min(1).max(200),
  apiKey: z.string().max(1000).default(""),
  removeKey: z.boolean().optional(),
});
export type Settings = {
  baseURL: string;
  model: string;
  encryptedKey?: string;
};
export const defaultSettings: Settings = {
  baseURL: "https://api.openai.com/v1",
  model: "gpt-4.1-mini",
};
export function validateSettings(input: unknown) {
  return schema.parse(input);
}
export function mergeSettings(
  current: Settings,
  input: unknown,
  encrypt: (key: string) => string,
): Settings {
  const data = validateSettings(input);
  return {
    baseURL: data.baseURL.replace(/\/$/, ""),
    model: data.model,
    ...(!data.removeKey && (data.apiKey || current.encryptedKey)
      ? {
          encryptedKey: data.apiKey
            ? encrypt(data.apiKey)
            : current.encryptedKey,
        }
      : {}),
  };
}
