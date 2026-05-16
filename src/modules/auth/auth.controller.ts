import type { NextFunction, Request, Response } from "express";
import { promisify } from "util";
import { eq } from "drizzle-orm";

import db from "../../db/connection.ts";
import { users } from "../../db/schema.ts";
import { comparePassword, hashPassword } from "../../utils/password.ts";

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password } = req.body;

    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user) {
      return res.status(400).json({
        error: "Invalid Credentials.",
      });
    }

    const match = await comparePassword(password, user.password);

    if (!match) {
      return res.status(400).json({
        error: "Invalid Credentials.",
      });
    }

    const regenerate = promisify(req.session.regenerate).bind(req.session);
    const save = promisify(req.session.save).bind(req.session);

    await regenerate();

    req.session.userId = user.id;

    await save();

    return res.json({
      message: "Login Successfull",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        createdAt: user.createdAt,
      },
    });
  } catch (e) {
    next(e);
  }
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, username, name, password } = req.body;

    const hashedPassword = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({ email, username, password: hashedPassword, name })
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        name: users.name,
        createdAt: users.createdAt,
      });

    if (!user) {
      throw new Error("Something went wrong");
    }

    const regenerate = promisify(req.session.regenerate).bind(req.session);
    const save = promisify(req.session.save).bind(req.session);

    await regenerate();

    req.session.userId = user.id;

    await save();

    return res.json({
      message: "Register Successfull",
      user,
    });
  } catch (e) {
    next(e);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const destroy = promisify(req.session.destroy).bind(req.session);

    await destroy();

    res.clearCookie("connect.sid");

    return res.json({
      message: "Logout Successful.",
    });
  } catch (e) {
    next(e);
  }
};
