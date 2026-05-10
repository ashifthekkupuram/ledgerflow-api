import express from "express";
import cors from "cors";

import { errorHandler } from "./middlewares/errorHandler.ts";

const app = express();

// App configurations
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
