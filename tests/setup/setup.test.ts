import { describe, test, expect } from "vitest";

import { createTestUser, cleanupDB } from "./dbHelpers.ts";

describe("Test setup", () => {
  test("should connect to test db", async () => {
    const { user } = await createTestUser();

    expect(user).toBeDefined();
    await cleanupDB();
  });
});
