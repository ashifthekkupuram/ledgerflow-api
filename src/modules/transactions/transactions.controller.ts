import type { NextFunction, Request, Response } from "express";
import { eq, inArray, sql } from "drizzle-orm";

import db from "../../db/connection.ts";
import {
  accounts,
  accountTransactions,
  transactionTags,
} from "../../db/schema.ts";

export const getTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const transaction = await db.query.accountTransactions.findFirst({
      where: eq(accountTransactions.id, id as string),
      with: {
        tagLinks: {
          with: {
            tag: true,
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction Not Found.",
      });
    }

    const filtered = {
      ...transaction,
      tags: transaction.tagLinks.map((t) => t.tag),
      tagLinks: undefined,
    };

    return res.json({
      message: "Transaction Retrieved.",
      transaction: filtered,
    });
  } catch (e) {
    next(e);
  }
};

export const updateTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const {
      amount,
      type,
      description,
      transactionDate,
      deleteTagIds,
      addTagIds,
    } = req.body;

    const [transaction] = await db
      .select()
      .from(accountTransactions)
      .where(eq(accountTransactions.id, id as string));

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction Not Found.",
      });
    }

    const finalType = type ?? transaction.type;
    const finalAmount = amount ?? transaction.amount;

    const amountChanged =
      amount !== undefined && Number(amount) !== Number(transaction.amount);
    const typeChanged = type !== undefined && type !== transaction.type;

    const oldEffect =
      transaction.type === "income"
        ? Number(transaction.amount)
        : -Number(transaction.amount);

    const newEffect =
      finalType === "income" ? Number(finalAmount) : -Number(finalAmount);

    const diff = newEffect - oldEffect;

    // Starting the transaction
    await db.transaction(async (tx) => {
      if (amountChanged || typeChanged) {
        // Locking Account
        await tx
          .select({ id: accounts.id })
          .from(accounts)
          .where(eq(accounts.id, transaction.accountId))
          .for("update");

        // Updating the account
        await tx
          .update(accounts)
          .set({ balance: sql`${accounts.balance} + ${diff}` })
          .where(eq(accounts.id, transaction.accountId));
      }

      //Updating the accountTransaction
      await tx
        .update(accountTransactions)
        .set({
          ...(amount !== undefined && { amount }),
          ...(description !== undefined && { description }),
          ...(transactionDate !== undefined && { transactionDate }),
          ...(type !== undefined && { type }),
        })
        .where(eq(accountTransactions.id, transaction.id));

      // Creating Tags if Ids exist
      if (addTagIds && addTagIds.length > 0) {
        const tags = addTagIds.map((t: string) => ({
          accountTransactionId: transaction.id,
          tagId: t,
        }));

        await tx.insert(transactionTags).values(tags);
      }

      // Deleting Tags if Ids exist
      if (deleteTagIds && deleteTagIds.length > 0) {
        await tx
          .delete(transactionTags)
          .where(inArray(transactionTags.id, deleteTagIds));
      }
    });

    const newTransaction = await db.query.accountTransactions.findFirst({
      where: eq(accountTransactions.id, transaction.id),
      with: {
        tagLinks: {
          with: {
            tag: true,
          },
        },
      },
    });

    const filtered = {
      ...newTransaction,
      tags: newTransaction?.tagLinks.map((t) => t.tag),
      tagLinks: undefined,
    };

    return res.json({
      message: "Transaction Updated.",
      transaction: filtered,
    });
  } catch (e) {
    next(e);
  }
};

export const deleteTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const [transaction] = await db
      .select()
      .from(accountTransactions)
      .where(eq(accountTransactions.id, id as string));

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction Not Found.",
      });
    }

    if (transaction.deletedAt) {
      return res.status(400).json({
        message: "Already already deleted.",
      });
    }

    // Starting a Transaction
    await db.transaction(async (tx) => {
      // Locking the account
      await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.id, transaction.accountId))
        .for("update");

      const change =
        transaction.type === "income"
          ? Number(transaction.amount)
          : -Number(transaction.amount);

      const reverseChange = -change;

      await tx
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} + ${reverseChange}`,
        })
        .where(eq(accounts.id, transaction.accountId));

      await tx
        .update(accountTransactions)
        .set({ deletedAt: new Date() })
        .where(eq(accountTransactions.id, transaction.id));
    });

    return res.json({
      message: "Transaction Deleted.",
    });
  } catch (e) {
    next(e);
  }
};

export const recoverTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const [transaction] = await db
      .select()
      .from(accountTransactions)
      .where(eq(accountTransactions.id, id as string));

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction Not Found.",
      });
    }

    if (!transaction.deletedAt) {
      return res.status(400).json({
        message: "Transaction is not deleted to recover.",
      });
    }

    // Starting a Transaction
    await db.transaction(async (tx) => {
      // Locking the account
      await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.id, transaction.accountId))
        .for("update");

      const change =
        transaction.type === "income"
          ? Number(transaction.amount)
          : -Number(transaction.amount);

      await tx
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} + ${change}`,
        })
        .where(eq(accounts.id, transaction.accountId));

      await tx
        .update(accountTransactions)
        .set({ deletedAt: null })
        .where(eq(accountTransactions.id, transaction.id));
    });

    const recoveredTransaction = await db.query.accountTransactions.findFirst({
      where: eq(accountTransactions.id, transaction.id),
      with: {
        tagLinks: {
          with: {
            tag: true,
          },
        },
      },
    });

    if (!recoveredTransaction) {
      return res.status(404).json({
        message: "Transaction Not Found.",
      });
    }

    const filtered = {
      ...recoveredTransaction,
      tags: recoveredTransaction?.tagLinks.map((tl) => tl.tag),
      tagLinks: undefined,
    };

    return res.json({
      message: "Transaction Recovered.",
      transaction: filtered,
    });
  } catch (e) {
    next(e);
  }
};
