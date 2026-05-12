import type { Request, Response } from "express";
import { promisify } from "util";
import { DrizzleQueryError, eq } from "drizzle-orm";
import { DatabaseError } from "pg";

import db from "../../db/connection.ts";
import { users } from "../../db/schema.ts";
import { comparePassword, hashPassword } from "../../utils/password.ts";

export const login = async (req: Request, res: Response) => {
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
    throw e;
  }
};

export const register = async (req: Request, res: Response) => {
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
    if (e instanceof DrizzleQueryError && e.cause instanceof DatabaseError) {
      // Check if user with email already exist
      if (
        e.cause.code === "23505" &&
        e.cause.constraint === "users_email_unique"
      ) {
        return res.status(400).json({
          error: "user with the email already exist.",
        });
      }

      // Check if user with username already exist
      if (
        e.cause.code === "23505" &&
        e.cause.constraint === "users_username_unique"
      ) {
        return res.status(400).json({
          error: "username already taken.",
        });
      }
    }
    throw e;
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        return res.status(400).json({
          error: "Logout Failed.",
        });
      }
    });

    return res.json({
      message: "Logout Successful.",
    });
  } catch (e) {
    throw e;
  }
};
