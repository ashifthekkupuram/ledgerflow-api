import { z, ZodError, ZodType } from "zod";
import type { Request, Response, NextFunction } from "express";

export const validateBody = <T>(schema: ZodType<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedBody = schema.parse(req.body);
      req.body = validatedBody;
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        console.log(e.issues)
        return res.status(400).json({
          error: "Invalid Fields.",
          details: e.issues.map((err) => ({
            name: err.path.join("."),
            message: err.message,
          })),
        });
      }
      throw e;
    }
  };
};

export const validateParams = <T>(schema: ZodType<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.params);
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        return res.status(400).json({
          error: "Invalid Fields.",
          details: e.issues.map((err) => ({
            name: err.path.join("."),
            message: err.message,
          })),
        });
      }
      throw e;
    }
  };
};

export const validateQuery = <T>(schema: ZodType<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.query);
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        return res.status(400).json({
          error: "Invalid Fields.",
          details: e.issues.map((err) => ({
            name: err.path.join("."),
            message: err.message,
          })),
        });
      }
      throw e;
    }
  };
};
