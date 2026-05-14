import { Router } from "express";

import {
  getTags,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
} from "./tags.controller.ts";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validation.ts";
import {
  tagIdParamSchema,
  tagBodySchema,
  tagQuerySchema,
} from "./tags.schema.ts";
import authenticate from "../../middlewares/authenticate.ts";
import tagOwner from "../../middlewares/tagOwner.ts";

const tagsRoute = Router();

tagsRoute.get("/", authenticate, validateQuery(tagQuerySchema), getTags);
tagsRoute.get(
  "/:id",
  authenticate,
  validateParams(tagIdParamSchema),
  tagOwner,
  getTagById,
);

tagsRoute.post("/", authenticate, validateBody(tagBodySchema), createTag);

tagsRoute.put(
  "/:id",
  authenticate,
  validateParams(tagIdParamSchema),
  tagOwner,
  validateBody(tagBodySchema),
  updateTag,
);

tagsRoute.delete(
  "/:id",
  authenticate,
  validateParams(tagIdParamSchema),
  tagOwner,
  deleteTag,
);

export default tagsRoute;
