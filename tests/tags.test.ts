import { describe, it, beforeAll, expect, afterAll } from "vitest";
import request from "supertest";

import app from "../src/server.ts";
import { cleanupDB } from "./setup/dbHelpers.ts";
import { initializeRedisClient } from "../src/db/redis.ts";

const agent = request.agent(app);

describe("Tags endpoints tests", () => {
  beforeAll(async () => {
    await agent
      .post("/api/auth/register")
      .send({
        email: "test@gmail.com",
        username: "test",
        password: "test1234",
      })
      .expect(201);

    await initializeRedisClient();
  });

  afterAll(async () => {
    await cleanupDB();
  });

  describe("POST /api/tags", () => {
    it("should creates a tag and returns it", async () => {
      const response = await agent
        .post("/api/tags")
        .send({ name: "Example" })
        .expect(201);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("tag");
    });

    it("should fail to create a tag cause of below 3 characters", async () => {
      const response = await agent
        .post("/api/tags")
        .send({ name: " Ex" })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Validation Error.");
    });

    it("should fail to create a tag cause of above 15 characters", async () => {
      const response = await agent
        .post("/api/tags")
        .send({ name: "onetwothreefourfivesixseven" })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Validation Error.");
    });

    it("should fail to create a tag cause of no body", async () => {
      const response = await agent.post("/api/tags").send({}).expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Validation Error.");
    });

    it("should fail to create a tag cause of trying to create same named tag twice and stores in lowercase", async () => {
      await agent.post("/api/tags").send({ name: "Same" }).expect(201);
      const response = await agent
        .post("/api/tags")
        .send({ name: "same" })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Validation Error.");
    });
  });

  describe("GET /api/tags", () => {
    it("should return tags of authenticated users", async () => {
      const response = await agent.get("/api/tags").expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("tags");
    });
  });

  describe("GET /api/tags/:id", () => {
    it("should return tag specific with specific id", async () => {
      const tag = await agent
        .post("/api/tags")
        .send({ name: "Gym" })
        .expect(201);
      const response = await agent
        .get(`/api/tags/${tag.body.tag.id}`)
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("tag");
    });
  });

  describe("PUT /api/tags/:id", () => {
    it("should update a tag", async () => {
      const tag = await agent
        .post("/api/tags")
        .send({ name: "Hero" })
        .expect(201);
      const response = await agent
        .put(`/api/tags/${tag.body.tag.id}`)
        .send({ name: "Heros" })
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("tag");
    });
  });

  describe("DELETE /api/tags/:id", () => {
    it("should delete a tag", async () => {
      const tag = await agent
        .post("/api/tags")
        .send({ name: "Grocery" })
        .expect(201);
      const response = await agent
        .delete(`/api/tags/${tag.body.tag.id}`)
        .expect(200);

      expect(response.body).toHaveProperty("message");
    });
  });
});
