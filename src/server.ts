import express from "express";
import cors from "cors";
import session from "express-session";
import connectPgSession from "connect-pg-simple";

import { errorHandler } from "./middlewares/errorHandler.ts";
import { env } from "../env.ts";
import { client } from "./db/connection.ts";

const app = express();

const pgSession = connectPgSession(session);

// App configurations
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: env.COOKIE_SECRET_KEY,
    resave: false,
    saveUninitialized: true,
    store: new pgSession({
      tableName: "user_sessions",
      pool: client,
      createTableIfMissing: true,
    }),
    cookie: function (req) {
      const match = req.url.match(/^\/([^/]+)/);
      return {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: true,
        secure: req.secure || false,
        path: match ? "/" + match[1] : "/",
      };
    },
  }),
);

// API Health Check
app.get("/health", (req, res) => {
  res.json({
    message: "LedgerFlow API...",
  });
});

// Error Handler and Catcher
app.use(errorHandler);

export default app;

export { app };
