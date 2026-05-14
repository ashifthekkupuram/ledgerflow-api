import type { Request, Response, NextFunction } from "express";
import { inArray } from "drizzle-orm";

import db from "../db/connection.ts";
import { tags } from "../db/schema.ts";

const newTagsOwner = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { addTagIds } = req.body;

    // Getting the tags
    const datas = await db
      .select({ id: tags.id, userId: tags.userId })
      .from(tags)
      .where(inArray(tags.id, addTagIds));

    if (datas.length !== addTagIds.length) {
      return res.status(400).json({
        error: "Some of the tags don't exist",
      });
    }

    // Checking the ownership of the tags
    const Unauthorized = datas.some((tag) => tag.userId !== req.session.userId);
    if (Unauthorized) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    next();
  } catch (e) {
    next(e);
  }
};

export default newTagsOwner;
