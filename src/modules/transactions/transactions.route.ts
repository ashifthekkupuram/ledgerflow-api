import { Router } from "express";

import {
  getTransaction,
  deleteTransaction,
  updateTransaction,
  recoverTransaction,
} from "./transactions.controller.ts";
import { validateBody, validateParams } from "../../middlewares/validation.ts";
import {
  transactionIdParamSchema,
  transactionBodySchema,
} from "./transactions.schema.ts";
import authenticate from "../../middlewares/authenticate.ts";
import transactionOwner from "../../middlewares/transactionOwner.ts";
import newTagsOwner from "../../middlewares/newTagsOwner.ts";

const transactionRoute = Router();

transactionRoute.get(
  "/:id",
  authenticate,
  validateParams(transactionIdParamSchema),
  transactionOwner,
  getTransaction,
);

transactionRoute.put(
  "/:id",
  authenticate,
  validateParams(transactionIdParamSchema),
  transactionOwner,
  validateBody(transactionBodySchema),
  newTagsOwner,
  updateTransaction,
);

transactionRoute.delete(
  "/:id",
  authenticate,
  validateParams(transactionIdParamSchema),
  transactionOwner,
  deleteTransaction,
);

transactionRoute.patch(
  "/:id/recover",
  authenticate,
  validateParams(transactionIdParamSchema),
  transactionOwner,
  recoverTransaction,
);

export default transactionRoute;
