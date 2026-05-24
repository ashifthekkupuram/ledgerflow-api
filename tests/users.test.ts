import { describe, it, beforeAll, expect, afterAll } from "vitest";
import request from "supertest";

import app from "../src/server.ts";
import { cleanupDB } from "./setup/dbHelpers.ts";

const agent = request.agent(app);

describe("users endpoints test", () => {
  beforeAll(async () => {
    await agent
      .post("/api/auth/register")
      .send({
        email: "test@gmail.com",
        username: "test",
        password: "test1234",
      })
      .expect(201);
  });

  afterAll(async () => {
    await cleanupDB();
  });

  describe("GET /api/users", () => {
    it("should return user detail for authenticated users", async () => {
      const response = await agent.get("/api/users").expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).not.toHaveProperty("password");
    });

    it("should return error for unauthenticated users", async () => {
      const response = await request(app).get("/api/users").expect(401);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("PATCH /api/users", () => {
    it("should change user details", async () => {
      const response = await agent
        .patch("/api/users")
        .send({ name: "Test New", username: "test1234" })
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).not.toHaveProperty("password");
      expect(response.body.user.name).toBe("Test New");
      expect(response.body.user.username).toBe("test1234");
    });
  });

  describe("POST /api/users/change-password", () => {
    it("should change password of the auth user", async () => {
      const response = await agent
        .post("/api/users/change-password")
        .send({ oldPassword: "test1234", newPassword: "test4321" })
        .expect(200);

      expect(response.body).toHaveProperty("message");
    });
  });
});
