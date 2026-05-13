import type { Request, Response, NextFunction } from "express";

const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    next();
  } catch (e) {
    next(e);
  }
};

export default authenticate;
