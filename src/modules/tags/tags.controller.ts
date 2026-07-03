import type { NextFunction, Request, Response } from "express";
import { ilike, and, eq } from "drizzle-orm";

import db from "../../db/connection.ts";
import { tags } from "../../db/schema.ts";
import { invalidateCache, redisClient } from "../../utils/redis.ts";

import { getVersion } from "../../utils/redis.ts";

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

    const version = await getVersion(req.session.userId || "", "tags");

    const cacheKey = `tags:v${version}:${req.session.userId || ""}:${name}`;

    let cacheData = await redisClient.get(cacheKey);

    if (cacheData) {
      return res.json({
        message: "Tags Retrieved.",
        tags: JSON.parse(cacheData),
      });
    }

    const datas = await db.select().from(tags).where(filters);

    await redisClient.set(cacheKey, JSON.stringify(datas), {
      expiration: { type: "EX", value: 300 },
    });

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

    const versionKey = `tags:version:${req.session.userId}`;

    await invalidateCache(req.session.userId || "", "tags");

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

    await invalidateCache(req.session.userId || "", "tags");

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

    await invalidateCache(req.session.userId || "", "tags");

    return res.json({
      message: "Tag deleted.",
    });
  } catch (e) {
    next(e);
  }
};
