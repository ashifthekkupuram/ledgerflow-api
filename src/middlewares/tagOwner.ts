import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";

import db from "../db/connection.ts";
import { tags } from "../db/schema.ts";

const tagOwner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const [tag] = await db
      .select()
      .from(tags)
      .where(eq(tags.id, id as string));

    if (!tag) {
      return res.status(404).json({
        error: "Tag not found",
      });
    }

    if (tag.userId !== req.session.userId) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    next();
  } catch (e) {
    next(e);
  }
};

export default tagOwner;
