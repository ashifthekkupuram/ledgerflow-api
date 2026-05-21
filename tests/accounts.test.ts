import { describe, it, beforeAll, expect, afterAll } from "vitest";
import request from "supertest";

import app from "../src/server.ts";
import { cleanupDB } from "./setup/dbHelpers.ts";

const agent = request.agent(app);

describe("accounts end points tests", () => {
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

  describe("POST /api/accounts", () => {
    it("should create an account", async () => {
      const response = await agent
        .post("/api/accounts")
        .send({ name: "Test", type: "bank", balance: 2000 })
        .expect(201);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("account");
    });

    it("can't create an account without name and type", async () => {
      const response = await agent
        .post("/api/accounts")
        .send({ balance: 2000 })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Validation Error.");
    });

    it("can't create an account with balance below 0", async () => {
      const response = await agent
        .post("/api/accounts")
        .send({ balance: -1000 })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Validation Error.");
    });
  });

  describe("GET /api/accounts", () => {
    it("should return acccounts of authenticated user", async () => {
      const response = await agent.get("/api/accounts").expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("accounts");
      expect(response.body).toHaveProperty("totalAccounts");
    });
  });

  describe("GET /api/accounts/id", () => {
    it("should return acccount by id", async () => {
      const account = await agent
        .post("/api/accounts")
        .send({ name: "Neon", type: "wallet", balance: 3000 })
        .expect(201);
      const response = await agent
        .get(`/api/accounts/${account.body.account.id}`)
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("account");
    });
  });

  describe("PUT /api/accounts/id", () => {
    it("should update acccount by id", async () => {
      const account = await agent
        .post("/api/accounts")
        .send({ name: "Neon 1", type: "wallet", balance: 3000 })
        .expect(201);
      const response = await agent
        .put(`/api/accounts/${account.body.account.id}`)
        .send({ name: "Salary", type: "bank", balance: 4000 })
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("account");
    });
  });

  describe("DELETE /api/accounts/id", () => {
    it("should delete acccount by id", async () => {
      const account = await agent
        .post("/api/accounts")
        .send({ name: "Neon 2", type: "wallet", balance: 3000 })
        .expect(201);
      const response = await agent
        .delete(`/api/accounts/${account.body.account.id}`)
        .expect(200);

      expect(response.body).toHaveProperty("message");
    });
  });

  describe("POST /api/accounts/id/transaction", () => {
    it("should create transaciton for account(expense)", async () => {
      const account = await agent
        .post("/api/accounts")
        .send({ name: "Testing", type: "wallet", balance: 3000 })
        .expect(201);

      const tag = await agent
        .post("/api/tags")
        .send({ name: "Example" })
        .expect(201);

      const response = await agent
        .post(`/api/accounts/${account.body.account.id}/transactions`)
        .send({
          amount: 500,
          type: "expense",
          description: "food",
          tagIds: [tag.body.tag.id],
        })
        .expect(201);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("transaction");
      expect(response.body.transaction.amount).toBe("500.00");

      const updatedAccount = await agent
        .get(`/api/accounts/${account.body.account.id}`)
        .expect(200);

      expect(updatedAccount.body).toHaveProperty("message");
      expect(updatedAccount.body).toHaveProperty("account");
      expect(updatedAccount.body.account.balance).toBe("2500.00");
    });

    it("should create transaciton for account(income)", async () => {
      const account = await agent
        .post("/api/accounts")
        .send({ name: "Testing 2", type: "wallet", balance: 3000 })
        .expect(201);
      const tag = await agent
        .post("/api/tags")
        .send({ name: "Example 2" })
        .expect(201);

      const response = await agent
        .post(`/api/accounts/${account.body.account.id}/transactions`)
        .send({
          amount: 500,
          type: "income",
          description: "salary",
          tagIds: [tag.body.tag.id],
        })
        .expect(201);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("transaction");
      expect(response.body.transaction.amount).toBe("500.00");

      const updatedAccount = await agent
        .get(`/api/accounts/${account.body.account.id}`)
        .expect(200);

      expect(updatedAccount.body).toHaveProperty("message");
      expect(updatedAccount.body).toHaveProperty("account");
      expect(updatedAccount.body.account.balance).toBe("3500.00");
    });

    it("should create transaciton for account", async () => {
      const account = await agent
        .post("/api/accounts")
        .send({ name: "Testing 3", type: "wallet", balance: 1000 })
        .expect(201);

      const response = await agent
        .post(`/api/accounts/${account.body.account.id}/transactions`)
        .send({
          amount: 1500,
          type: "expense",
          description: "food",
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Insufficient balance.");
    });
  });

  describe("GET /api/accounts/id/transaction", () => {
    it("should return transactions of an account", async () => {
      const account = await agent
        .post("/api/accounts")
        .send({ name: "Testing 4", type: "wallet", balance: 3000 })
        .expect(201);

      await agent
        .post(`/api/accounts/${account.body.account.id}/transactions`)
        .send({
          amount: 1500,
          type: "expense",
          description: "food",
        })
        .expect(201);

      await agent
        .post(`/api/accounts/${account.body.account.id}/transactions`)
        .send({
          amount: 1500,
          type: "income",
          description: "salary",
        })
        .expect(201);

      const updatedAccount = await agent
        .get(`/api/accounts/${account.body.account.id}/transactions`)
        .expect(200);

      expect(updatedAccount.body).toHaveProperty("message");
      expect(updatedAccount.body).toHaveProperty("transactions");
      expect(updatedAccount.body.transactions).toHaveLength(2);
    });
  });
});
