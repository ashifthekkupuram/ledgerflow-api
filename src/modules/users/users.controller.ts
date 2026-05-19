import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";

import db from "../../db/connection.ts";
import { users } from "../../db/schema.ts";
import { comparePassword, hashPassword } from "../../utils/password.ts";
import { promisify } from "node:util";

export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        username: users.username,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, req.session.userId as string));

    if (!user) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    return res.json({
      message: "User retrieved.",
      user,
    });
  } catch (e) {
    next(e);
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { username, name } = req.body;

    const [user] = await db
      .update(users)
      .set({
        ...(username !== undefined && { username }),
        ...(name !== undefined && { name }),
      })
      .where(eq(users.id, req.session.userId as string))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        username: users.username,
        createdAt: users.createdAt,
      });

    if (!user) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    return res.json({
      message: "User updated.",
      user,
    });
  } catch (e) {
    next(e);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId as string));

    if (!user) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    const matchOldPassword = await comparePassword(oldPassword, user.password);

    if (!matchOldPassword) {
      return res.status(400).json({
        error: "Invalid Fields.",
        details: [
          {
            name: "oldPassword",
            message: "Invalid Old Password.",
          },
        ],
      });
    }

    const changedPassword = await hashPassword(newPassword);

    await db
      .update(users)
      .set({ password: changedPassword })
      .where(eq(users.id, req.session.userId as string));

    const destroy = promisify(req.session.destroy).bind(req.session);

    await destroy();

    res.clearCookie("connect.sid");

    return res.json({
      message: "Password changed.",
    });
  } catch (e) {
    next(e);
  }
};
