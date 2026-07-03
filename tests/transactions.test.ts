import { describe, it, beforeAll, expect, afterAll } from "vitest";
import request from "supertest";

import app from "../src/server.ts";
import { cleanupDB } from "./setup/dbHelpers.ts";
import { initializeRedisClient } from "../src/utils/redis.ts";

const agent = request.agent(app);

describe("transactions endpoints test", () => {
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

  describe("GET /api/transaction/id", () => {
    it("should return a transaction", async () => {
      const account = await agent
        .post("/api/accounts")
        .send({ type: "bank", balance: 3000, name: "Test" })
        .expect(201);

      const response = await agent
        .post(`/api/accounts/${account.body.account.id}/transactions`)
        .send({ type: "income", amount: 1000 })
        .expect(201);

      const transaction = await agent
        .get(`/api/transaction/${response.body.transaction.id}`)
        .expect(200);

      expect(transaction.body).toHaveProperty("message");
      expect(transaction.body).toHaveProperty("transaction");
    });
  });

  describe("PUT /api/transaction/id", () => {
    it("should update transaction and reflect change in the account balance", async () => {
      const account = await agent
        .post("/api/accounts")
        .send({ type: "bank", balance: 3000, name: "Test 4" })
        .expect(201);
      const tag = await agent
        .post("/api/tags")
        .send({ name: "Example" })
        .expect(201);

      const response = await agent
        .post(`/api/accounts/${account.body.account.id}/transactions`)
        .send({ type: "income", amount: 1000, tagIds: [tag.body.tag.id] })
        .expect(201);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("transaction");
      expect(response.body.transaction.tags).toHaveLength(1);
      expect(response.body.transaction.tags[0].id).toBe(tag.body.tag.id);

      const newTag = await agent
        .post("/api/tags")
        .send({ name: "Example 2" })
        .expect(201);

      const newResponse = await agent
        .put(`/api/transaction/${response.body.transaction.id}`)
        .send({
          type: "expense",
          amount: 1000,
          deleteTagIds: [tag.body.tag.id],
          addTagIds: [newTag.body.tag.id],
        })
        .expect(200);

      expect(newResponse.body).toHaveProperty("message");
      expect(newResponse.body).toHaveProperty("transaction");
      expect(newResponse.body.transaction.type).toBe("expense");
      expect(newResponse.body.transaction.tags).toHaveLength(1);
      expect(newResponse.body.transaction.tags[0].id).toBe(newTag.body.tag.id);

      const newAccount = await agent
        .get(`/api/accounts/${account.body.account.id}`)
        .expect(200);

      expect(newAccount.body).toHaveProperty("message");
      expect(newAccount.body).toHaveProperty("account");
      expect(newAccount.body.account.balance).toBe("2000.00");
    });
  });

  describe("DELETE /api/transaction/id", () => {
    it("should delete a transaction and reflect change in the account balance", async () => {
      const account = await agent
        .post("/api/accounts")
        .send({ type: "bank", balance: 3000, name: "Test 2" })
        .expect(201);

      const response = await agent
        .post(`/api/accounts/${account.body.account.id}/transactions`)
        .send({ type: "income", amount: 1000 })
        .expect(201);

      const deletedTransaction = await agent
        .delete(`/api/transaction/${response.body.transaction.id}`)
        .expect(200);

      expect(deletedTransaction.body).toHaveProperty("message");

      const updatedAccount = await agent
        .get(`/api/accounts/${account.body.account.id}`)
        .expect(200);

      expect(updatedAccount.body).toHaveProperty("message");
      expect(updatedAccount.body).toHaveProperty("account");
      expect(updatedAccount.body.account.balance).toBe("3000.00");
    });
  });

  describe("PATCH /api/transaction/id", () => {
    it("should recover a deleted transaction and reflect change in the account balance", async () => {
      const account = await agent
        .post("/api/accounts")
        .send({ type: "bank", balance: 3000, name: "Test 3" })
        .expect(201);

      const response = await agent
        .post(`/api/accounts/${account.body.account.id}/transactions`)
        .send({ type: "income", amount: 1000 })
        .expect(201);

      const deletedTransaction = await agent
        .delete(`/api/transaction/${response.body.transaction.id}`)
        .expect(200);

      expect(deletedTransaction.body).toHaveProperty("message");

      const recoverTransaction = await agent
        .patch(`/api/transaction/${response.body.transaction.id}/recover`)
        .expect(200);

      expect(recoverTransaction.body).toHaveProperty("message");

      const updatedAccount = await agent
        .get(`/api/accounts/${account.body.account.id}`)
        .expect(200);

      expect(updatedAccount.body).toHaveProperty("message");
      expect(updatedAccount.body).toHaveProperty("account");
      expect(updatedAccount.body.account.balance).toBe("4000.00");
    });
  });
});
