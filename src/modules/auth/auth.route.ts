import { Router } from "express";

import { login, register, logout } from "./auth.controller.ts";
import { validateBody } from "../../middlewares/validation.ts";
import { loginSchema, registerSchema } from "./auth.schema.ts";

const authRoute = Router();

authRoute.post("/login", validateBody(loginSchema), login);
authRoute.post("/register", validateBody(registerSchema), register);
authRoute.post("/logout", logout);

export default authRoute;
