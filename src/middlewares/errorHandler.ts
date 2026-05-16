import { DrizzleQueryError } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { DatabaseError } from "pg";
import { env } from "../../env.ts";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (
      err instanceof DrizzleQueryError &&
      err.cause instanceof DatabaseError
    ) {
      // Unique Errors
      if (err.cause.code === "23505") {
        // Transaction Cannot Add Same Tags
        if (
          err.cause.constraint ===
          "unique_transaction_tag_id_and_account_transaction_id"
        ) {
          return res.status(400).json({
            error: "Field errors.",
            details: [{ name: "tags", message: "Cannot add same tag twice." }],
          });
        }

        // A user cannot create two tags with the same name
        if (err.cause.constraint === "unique_tag_name_and_user_id") {
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

        // A user cannot create two accounts with the same name
        if (err.cause.constraint === "unique_user_account_name") {
          return res.status(400).json({
            error: "Already Exist.",
            details: [
              {
                name: "name",
                message: "An Account with same name already exist.",
              },
            ],
          });
        }

        // Cannot create user with email that already exist
        if (err.cause.constraint === "users_email_unique") {
          return res.status(400).json({
            error: "Validation Error",
            details: [
              {
                name: "email",
                message: "User with the email already exist.",
              },
            ],
          });
        }

        // User cannot take username that taken by others
        if (err.cause.constraint === "users_username_unique") {
          return res.status(400).json({
            error: "Validation Error",
            details: [
              {
                name: "username",
                message: "Username is taken.",
              },
            ],
          });
        }
      }

      // Check Errors
      if (err.cause.code === "23514") {
        // Account balance cannot go below 0 balance
        if (err.cause.constraint === "check_account_balance_non_negative") {
          return res.status(400).json({
            error: "Insufficient balance.",
          });
        }

        // Transaction amount must be above 0
        if (err.cause.constraint === "check_transaction_amount_non_negative") {
          return res.status(400).json({
            error: "Invalid Fields.",
            details: [
              {
                name: "amount",
                message: "Amount must be above 0.",
              },
            ],
          });
        }
      }
    }

    let status = 500;
    let message = "Internal Server Error";
    let stack = "";

    if (err instanceof Error) {
      message = err.message;
      stack = err.stack || "";
    }

    return res.status(status).json({
      error: message,
      ...(env.NODE_ENV === "development" && {
        stack,
      }),
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({
      error: "Internal Server Error",
      ...(env.NODE_ENV === "development" && {
        stack: e instanceof Error ? e.stack : "",
      }),
    });
  }
};
