import { z } from "zod";

export const changePasswordBodySchema = z.object({
  oldPassword: z.string("Old Password Required."),
  newPassword: z
    .string("New Password Required.")
    .min(8, "New Password Must have atleast 8 characters."),
});

export const updateUserBodySchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(4, "Username must have at least 4 characters.")
    .max(50, "Username can only have 50 characters maximum.")
    .optional(),
  name: z
    .string()
    .trim()
    .min(4, "Name must have 4 characters minimum.")
    .max(50, "Name can only have 50 characters maximum.")
    .optional(),
});
