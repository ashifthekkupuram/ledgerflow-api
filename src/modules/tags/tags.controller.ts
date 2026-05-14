import type { Request, Response } from "express";
import { ilike, and, eq, DrizzleQueryError } from "drizzle-orm";

import db from "../../db/connection.ts";
import { tags } from "../../db/schema.ts";
import { DatabaseError } from "pg";

export const getTags = async (req: Request, res: Response) => {
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
    throw e;
  }
};

export const getTagById = async (req: Request, res: Response) => {
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
    throw e;
  }
};

export const createTag = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    const [tag] = await db
      .insert(tags)
      .values({ name, userId: req.session.userId as string })
      .returning();

    return res.json({
      message: "Tag created.",
      tag,
    });
  } catch (e) {
    if (e instanceof DrizzleQueryError && e.cause instanceof DatabaseError) {
      if (
        e.cause.code === "23505" &&
        e.cause.constraint === "unique_tag_name_and_user_id"
      ) {
        return res.status(400).json({
          error: "Invalid Fields",
          details: [
            {
              name: "name",
              message: "Tag with the name already exist.",
            },
          ],
        });
      }
    }
    throw e;
  }
};

export const updateTag = async (req: Request, res: Response) => {
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
    throw e;
  }
};

export const deleteTag = async (req: Request, res: Response) => {
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
    if (e instanceof DrizzleQueryError && e.cause instanceof DatabaseError) {
      if (
        e.cause.code === "23505" &&
        e.cause.constraint === "unique_tag_name_and_user_id"
      ) {
        return res.status(400).json({
          error: "Invalid Fields",
          details: [
            {
              name: "name",
              message: "Tag with the name already exist.",
            },
          ],
        });
      }
    }
    throw e;
  }
};
