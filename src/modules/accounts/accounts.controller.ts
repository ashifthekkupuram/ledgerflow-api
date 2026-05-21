import type { NextFunction, Request, Response } from "express";
import { eq, count, ilike, and, gte, lte, sql, isNull } from "drizzle-orm";

import { env } from "../../../env.ts";
import db from "../../db/connection.ts";
import {
  accounts,
  accountTransactions,
  transactionTags,
  type AccountType,
  type AccountTransactionType,
} from "../../db/schema.ts";

export const getAccounts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, name, type } = req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const offset = (pageNumber - 1) * env.ACCOUNTS_PAGE_LIMIT;

    const filters = and(
      eq(accounts.userId, req.session.userId || ""),
      name ? ilike(accounts.name, `%${name}%`) : undefined,
      type ? eq(accounts.type, type as AccountType) : undefined,
    );

    const results = await db
      .select({ totalAccounts: count() })
      .from(accounts)
      .where(filters);

    const totalAccounts = results[0]?.totalAccounts ?? 0;

    const datas = await db
      .select()
      .from(accounts)
      .where(filters)
      .orderBy(accounts.createdAt)
      .limit(env.ACCOUNTS_PAGE_LIMIT)
      .offset(offset);

    return res.json({
      message: "Account Retrieved.",
      accounts: datas,
      totalAccounts,
    });
  } catch (e) {
    next(e);
  }
};

export const getAccountById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id as string));

    if (!account) {
      return res.status(404).json({
        error: "Account not found.",
      });
    }

    return res.json({
      message: "Account Retrieved.",
      account,
    });
  } catch (e) {
    next(e);
  }
};

export const createAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, balance, type } = req.body;

    const [account] = await db
      .insert(accounts)
      .values({
        name,
        balance,
        userId: req.session.userId as string,
        type: type as AccountType,
      })
      .returning();

    return res.status(201).json({
      message: "Account created.",
      account,
    });
  } catch (e) {
    next(e);
  }
};

export const updateAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { name, balance, type } = req.body;

    const [account] = await db
      .update(accounts)
      .set({
        balance,
        name,
        type: type as AccountType,
      })
      .where(eq(accounts.id, id as string))
      .returning();

    if (!account) {
      return res.status(404).json({
        error: "Account not found.",
      });
    }

    return res.json({
      message: "Account updated.",
      account,
    });
  } catch (e) {
    next(e);
  }
};

export const deleteAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const [account] = await db
      .delete(accounts)
      .where(eq(accounts.id, id as string))
      .returning();

    if (!account) {
      return res.status(404).json({
        error: "Account not found.",
      });
    }

    return res.json({
      message: "Account deleted.",
    });
  } catch (e) {
    next(e);
  }
};

export const createTransactionByAccountId = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { amount, type, description, transactionDate, tagIds } = req.body;

    const tagDatas = tagIds as string[];

    // Starting Transaction
    const newTransaction = await db.transaction(async (tx) => {
      // locking the account
      await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.id, id as string))
        .for("update");

      // Creating AccountTransaction
      const [transaction] = await tx
        .insert(accountTransactions)
        .values({
          accountId: id as string,
          amount,
          transactionDate,
          type,
          description,
        })
        .returning();

      // Checking if transaction created or not
      if (!transaction) {
        throw new Error("Failed to create transaction.");
      }

      // Updating the balance of the account
      await tx
        .update(accounts)
        .set({
          balance:
            type === "income"
              ? sql`${accounts.balance} + ${amount}`
              : sql`${accounts.balance} - ${amount}`,
        })
        .where(eq(accounts.id, id as string));

      // Creating tags data
      const tags = tagDatas.map((t) => ({
        accountTransactionId: transaction.id,
        tagId: t,
      }));

      // Checking tags exist or not
      if (tags.length > 0) {
        // Creating AccountTransactionTags
        await tx.insert(transactionTags).values(tags);
      }

      return transaction;
    });

    if (!newTransaction) throw new Error("Something went wrong.");

    return res.status(201).json({
      message: "Transaction created.",
      transaction: newTransaction,
    });
  } catch (e) {
    next(e);
  }
};

export const getTransactionsByAccountId = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { page, type, description, afterDate, befourDate } = req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const offset = (pageNumber - 1) * env.TRANSACTION_PAGE_LIMIT;

    const filters = and(
      eq(accountTransactions.accountId, id as string),
      isNull(accountTransactions.deletedAt),
      type
        ? eq(accountTransactions.type, type as AccountTransactionType)
        : undefined,
      description
        ? ilike(accountTransactions.description, `%${description}%`)
        : undefined,
      afterDate
        ? gte(
            accountTransactions.transactionDate,
            new Date(afterDate as string),
          )
        : undefined,
      befourDate
        ? lte(
            accountTransactions.transactionDate,
            new Date(befourDate as string),
          )
        : undefined,
    );

    const result = await db
      .select({ totalTransactions: count() })
      .from(accountTransactions)
      .where(filters);

    const totalTransactions = result[0]?.totalTransactions ?? 0;

    const transactions = await db.query.accountTransactions.findMany({
      where: filters,
      orderBy: accountTransactions.transactionDate,
      limit: env.TRANSACTION_PAGE_LIMIT,
      offset,
      with: {
        tagLinks: {
          with: {
            tag: true,
          },
        },
      },
    });

    const filteredTransacions = transactions.map((tr) => ({
      ...tr,
      tags: tr.tagLinks.map((tl) => tl.tag),
      tagLinks: undefined,
    }));

    return res.json({
      message: "Transactions retieved.",
      transactions: filteredTransacions,
      totalTransactions,
    });
  } catch (e) {
    next(e);
  }
};
