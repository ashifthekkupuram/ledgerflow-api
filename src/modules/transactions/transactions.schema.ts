import { z } from "zod";
import { validate } from "uuid";

export const transactionIdParamSchema = z.object({
  id: z
    .string("ID param required.")
    .refine((id) => validate(id), "Invalid param ID."),
});

export const transactionBodySchema = z.object({
  description: z.string().optional(),
  amount: z.coerce
    .number("Amount is Required.")
    .min(1, "Amount must be above 0")
    .optional(),
  type: z
    .enum(
      ["income", "expense"],
      "Type is required and it must be income or expense.",
    )
    .optional(),
  transactionDate: z.date("Transaction Date must be a date.").optional(),
  deleteTagIds: z
    .array(z.string(), "Deleting Tags must be list of Tag IDs.")
    .default([]),
  addTagIds: z
    .array(z.string(), "Adding Tags must be list of Tag IDs.")
    .default([]),
});
