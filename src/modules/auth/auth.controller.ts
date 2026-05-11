import type { Request, Response } from "express";

import db from "../../db/connection.ts";
import { users } from "../../db/schema.ts";
import { DrizzleQueryError, eq } from "drizzle-orm";
import { comparePassword, hashPassword } from "../../utils/password.ts";
import { DatabaseError } from "pg";

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

    req.session.regenerate((err) => {
      if (err) throw new Error("Something went wrong");
      req.session.userId = user.id;
    });

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

    req.session.regenerate((err) => {
      if (err) throw new Error("Session creation failed.");
      req.session.userId = user!.id;
    });

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
