import type { NextFunction, Request, Response } from "express";
import { ilike, and, eq } from "drizzle-orm";

import db from "../../db/connection.ts";
import { tags } from "../../db/schema.ts";

export const getTags = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name } = req.query;

    const filters = and(
      eq(tags.userId, req.session.userId as string),
      name ? ilike(tags.name, `%${name}%`) : undefined,
    );

    const datas = await db.select().from(tags).where(filters);

    return res.json({
      message: "Tags Retrieved.",
      tags: datas,
    });
  } catch (e) {
    next(e);
  }
};

export const getTagById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const [tag] = await db
      .select()
      .from(tags)
      .where(eq(tags.id, id as string));

    if (!tag) {
      return res.status(404).json({
        error: "Tag not found.",
      });
    }

    return res.json({
      message: "Tag Retrieved.",
      tag,
    });
  } catch (e) {
    next(e);
  }
};

export const createTag = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name } = req.body;

    const [tag] = await db
      .insert(tags)
      .values({ name, userId: req.session.userId as string })
      .returning();

    return res.status(201).json({
      message: "Tag created.",
      tag,
    });
  } catch (e) {
    next(e);
  }
};

export const updateTag = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const [tag] = await db
      .update(tags)
      .set({ name })
      .where(eq(tags.id, id as string))
      .returning();

    if (!tag) {
      return res.status(404).json({
        error: "Tag not found.",
      });
    }

    return res.json({
      message: "Tag updated.",
      tag,
    });
  } catch (e) {
    next(e);
  }
};

export const deleteTag = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const [tag] = await db
      .delete(tags)
      .where(eq(tags.id, id as string))
      .returning();

    if (!tag) {
      return res.status(404).json({
        error: "Tag not found.",
      });
    }

    return res.json({
      message: "Tag deleted.",
    });
  } catch (e) {
    next(e);
  }
};
