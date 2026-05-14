import type { Request, Response, NextFunction } from "express";

import db from "../db/connection.ts";
import { accountTransactions } from "../db/schema.ts";
import { eq } from "drizzle-orm";

const transactionOwner = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const transaction = await db.query.accountTransactions.findFirst({
      where: eq(accountTransactions.id, id as string),
      with: {
        account: {
          columns: {
            userId: true,
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction Not Found.",
      });
    }

    if (
      !transaction.account ||
      transaction.account.userId !== req.session.userId
    ) {
      return res.status(403).json({
        message: "Forbidden",
      });
    }

    next();
  } catch (e) {
    next(e);
  }
};

export default transactionOwner;
