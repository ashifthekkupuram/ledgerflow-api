import { Router } from "express";

import {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  createTransactionByAccountId,
  getTransactionsByAccountId,
} from "./accounts.controller.ts";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validation.ts";
import {
  accountIdParamSchema,
  accountQuerySchema,
  accountBodySchema,
  transactionBodySchema,
  transactionQuerySchema,
} from "./accounts.schema.ts";
import authenticate from "../../middlewares/authenticate.ts";
import accountOwner from "../../middlewares/accountOwner.ts";
import tagsOwner from "../../middlewares/tagsOwner.ts";

const accountsRoute = Router();

// GET accounts of the authenticated user
accountsRoute.get(
  "/",
  authenticate,
  validateQuery(accountQuerySchema),
  getAccounts,
);

// GET an account by ID
accountsRoute.get(
  "/:id",
  authenticate,
  validateParams(accountIdParamSchema),
  accountOwner,
  getAccountById,
);

// CREATE an account
accountsRoute.post(
  "/",
  authenticate,
  validateBody(accountBodySchema),
  createAccount,
);

// UPDATE an account
accountsRoute.put(
  "/:id",
  authenticate,
  validateParams(accountIdParamSchema),
  accountOwner,
  validateBody(accountBodySchema),
  updateAccount,
);

// DELETE an account
accountsRoute.delete(
  "/:id",
  authenticate,
  validateParams(accountIdParamSchema),
  accountOwner,
  deleteAccount,
);

// CREATE Transaction by account ID
accountsRoute.post(
  "/:id/transactions",
  authenticate,
  validateParams(accountIdParamSchema),
  accountOwner,
  validateBody(transactionBodySchema),
  tagsOwner,
  createTransactionByAccountId,
);

// Get Transactions by accound ID
accountsRoute.get(
  "/:id/transactions",
  authenticate,
  validateParams(accountIdParamSchema),
  validateQuery(transactionQuerySchema),
  accountOwner,
  getTransactionsByAccountId,
);

export default accountsRoute;
