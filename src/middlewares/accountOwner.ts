import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";

import db from "../db/connection.ts";
import { accounts } from "../db/schema.ts";

const accountOwner = async (
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

      console.log(account)

    if (!account) {
      return res.status(404).json({
        error: "Account not found.",
      });
    }

    if (account?.userId !== req.session.userId) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    next();
  } catch (e) {
    next(e);
  }
};

export default accountOwner;
