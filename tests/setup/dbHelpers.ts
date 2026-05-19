import { sql } from "drizzle-orm";
import db from "../../src/db/connection.ts";

import {
  users,
  accounts,
  tags,
  accountTransactions,
  transactionTags,
  type NewUser,
  type NewAccount,
  type NewTag,
  type AccountType,
} from "../../src/db/schema.ts";

import { hashPassword, comparePassword } from "../../src/utils/password.ts";

export const createTestUser = async (userData: Partial<NewUser> = {}) => {
  const defaultData = {
    email: `${Date.now()}@test.com`,
    username: `${Date.now()}`,
    name: `Test User`,
    password: "test1234",
    ...userData,
  };

  const hashedPassword = await hashPassword(defaultData.password);
  const [user] = await db
    .insert(users)
    .values({
      ...defaultData,
      password: hashedPassword,
    })
    .returning();

  return { user, rawPassword: defaultData.password };
};

export const createTestAccount = async (
  userId: string,
  accountData: Partial<NewAccount> = {},
) => {
  const defaultData = {
    name: `Test ${Date.now()}`,
    type: "bank" as AccountType,
    userId,
    ...accountData,
  };

  const [account] = await db.insert(accounts).values(defaultData).returning();

  return { account };
};

export const createTestTag = async (
  userId: string,
  tagData: Partial<NewTag> = {},
) => {
  const defaultData = {
    name: `Test ${Date.now()}`,
    userId,
    ...tagData,
  };

  const [tag] = await db.insert(tags).values(defaultData).returning();

  return { tag };
};

export const cleanupDB = async () => {
  await db.delete(transactionTags);
  await db.delete(tags);
  await db.delete(accountTransactions);
  await db.delete(accounts);
  await db.delete(users);
};
