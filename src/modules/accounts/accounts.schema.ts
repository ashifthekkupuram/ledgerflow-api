import { z } from "zod";
import { validate } from "uuid";

export const accountIdParamSchema = z.object({
  id: z
    .string("ID param required.")
    .refine((id) => validate(id), "Invalid param ID."),
});

export const accountQuerySchema = z.object({
  page: z.coerce.number().default(1),
  name: z.string().optional(),
  type: z
    .enum(["bank", "wallet", "upi"], "Type must be bank, wallet or upi.")
    .optional(),
});

export const accountBodySchema = z.object({
  name: z
    .string("Name is required.")
    .min(4, "Name must have at least 4 characters.")
    .max(20, "Name can only have 20 characters maximum.")
    .toLowerCase(),
  balance: z.coerce.number().min(0, "Balance must be 0 or above").default(0),
  type: z.enum(
    ["bank", "wallet", "upi"],
    "Type is required and it must be bank, wallet or upi.",
  ),
});

export const transactionBodySchema = z.object({
  description: z.string().optional(),
  amount: z.coerce
    .number("Amount is Required.")
    .min(1, "Amount must be above 0"),
  type: z.enum(
    ["income", "expense"],
    "Type is required and it must be income or expense.",
  ),
  transactionDate: z.date("Transaction Date must be a date.").optional(),
  tagIds: z.array(z.string(), "Tags must be list of Tag IDs.").default([]),
});

export const transactionQuerySchema = z.object({
  page: z.coerce.number().default(1),
  description: z.string().optional(),
  type: z
    .enum(
      ["income", "expense"],
      "Type is required and it must be income or expense.",
    )
    .optional(),
  transactionDate: z.date("Transaction Date must be a date.").optional(),
  afterDate: z.date("After Date must be a date").optional(),
  befourDate: z.date("Befour Date must be a date").optional(),
});
