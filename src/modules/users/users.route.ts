import { Router } from "express";

import { getUser, changePassword, updateUser } from "./users.controller.ts";
import { validateBody } from "../../middlewares/validation.ts";
import {
  changePasswordBodySchema,
  updateUserBodySchema,
} from "./users.schema.ts";
import authenticate from "../../middlewares/authenticate.ts";

const usersRoute = Router();

// GET User Details
usersRoute.get("/", authenticate, getUser);

// UPDATE User
usersRoute.patch(
  "/",
  authenticate,
  validateBody(updateUserBodySchema),
  updateUser,
);

// Change Password
usersRoute.post(
  "/change-password",
  authenticate,
  validateBody(changePasswordBodySchema),
  changePassword,
);

export default usersRoute;
