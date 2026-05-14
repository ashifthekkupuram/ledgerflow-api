import { validate } from "uuid";
import { z } from "zod";

export const tagIdParamSchema = z.object({
  id: z
    .string("ID param required.")
    .refine((id) => validate(id), "Invalid param ID."),
});

export const tagBodySchema = z.object({
  name: z
    .string("Name is required")
    .toLowerCase()
    .trim()
    .min(3, "Name must be atleast 3 Characters long.")
    .max(15, "Name can only have 15 characters maximum."),
});

export const tagQuerySchema = z.object({
  name: z.string("Name must be a string").optional(),
});
