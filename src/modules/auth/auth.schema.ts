import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .email({ error: "Email is required and must be a valid Email." })
    .toLowerCase(),
  password: z.string({ error: "Password is required." }),
});

export const registerSchema = z.object({
  email: z
    .email({ error: "Email is required and must be a valid Email." })
    .toLowerCase(),
  username: z
    .string({ error: "username is required." })
    .trim()
    .toLowerCase()
    .min(4, "Username must have at least 4 characters.")
    .max(50, "Username can only have 50 characters maximum."),
  name: z
    .string({ error: "Name must be valid." })
    .trim()
    .min(4, "Name must have 4 characters minimum.")
    .max(50, "Name can only have 50 characters maximum.")
    .optional(),
  password: z
    .string({ error: "Password is required." })
    .min(8, "Password must have at least 8 characters."),
});
