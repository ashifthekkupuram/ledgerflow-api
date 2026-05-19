import { describe, it, afterEach, expect } from "vitest";
import request from "supertest";

import { createTestUser, cleanupDB } from "./setup/dbHelpers.ts";
import app from "../src/server.ts";

describe("Auth endpoints test", () => {
  afterEach(async () => {
    await cleanupDB();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user", async () => {
      const userData = {
        email: "test@gmail.com",
        username: "test",
        password: "test1234",
      };
      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).not.toHaveProperty("password");
    });

    it("should return 400 error for invalid email", async () => {
      const userData = {
        email: "test@gmailcom",
        username: "test",
        password: "test1234",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Validation Error.");
    });

    it("should return 400 error for invalid password", async () => {
      const userData = {
        email: "test@gmail.com",
        username: "test",
        password: "test123",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Validation Error.");
    });

    it("should return 400 error for empty body", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Validation Error.");
    });

    it("should return 400 error for using the already existing email", async () => {
      await createTestUser({
        email: "test@gmail.com",
        password: "test1234",
        username: "test",
      });

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "test@gmail.com",
          password: "test1234",
          username: "test1",
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Validation Error.");
    });

    it("should return 400 error for using the already existing username", async () => {
      await createTestUser({
        email: "test@gmail.com",
        password: "test1234",
        username: "test",
      });

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "test1@gmail.com",
          password: "test1234",
          username: "test",
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Validation Error.");
    });
  });

  describe("POST /api/auth/login", () => {
    it("Should login for the correct email and password", async () => {
      const { user, rawPassword } = await createTestUser();

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: user.email,
          password: rawPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).not.toHaveProperty("password");
    });

    it("Should return error for wrong email", async () => {
      const { rawPassword } = await createTestUser();

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "test@gmail.com",
          password: rawPassword,
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Invalid Credentials.");
    });

    it("Should return error for wrong password", async () => {
      const { user } = await createTestUser();

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: user.email,
          password: "mockpass",
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Invalid Credentials.");
    });

    it("Should return error for empty body", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Validation Error.");
    });
  });
});
