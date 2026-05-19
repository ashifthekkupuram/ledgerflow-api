import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  decimal,
  pgEnum,
  text,
  check,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).unique().notNull(),
  username: varchar("username", { length: 50 }).unique().notNull(),
  name: varchar("name", { length: 50 }),
  password: varchar("password").notNull(),
  ...timestamps,
});

export const accountType = pgEnum("account_type", ["bank", "wallet", "upi"]);

export type AccountType = (typeof accountType.enumValues)[number];

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 20 }).notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    balance: decimal("balance", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    type: accountType().notNull(),
    ...timestamps,
  },
  (table) => [
    check("check_account_balance_non_negative", sql`${table.balance} >= 0`),
    unique("unique_user_account_name").on(table.userId, table.name),
    index("account_user_id_type_idx").on(table.userId, table.type),
  ],
);

export const accountTransactionType = pgEnum("account_transaction_type", [
  "income",
  "expense",
]);

export type AccountTransactionType =
  (typeof accountTransactionType.enumValues)[number];

export const accountTransactions = pgTable(
  "account_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .references(() => accounts.id, {
        onDelete: "cascade",
      })
      .notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    type: accountTransactionType().notNull(),
    description: text("description"),
    transactionDate: timestamp("transaction_date").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    ...timestamps,
  },
  (table) => [
    check("check_transaction_amount_non_negative", sql`${table.amount} > 0`),
    index("transaction_date_idx").on(table.transactionDate),
    index("account_id_and_transaction_date_idx").on(
      table.accountId,
      table.transactionDate,
    ),
    index("account_id_and_type_idx").on(table.accountId, table.type),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 15 }).notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    ...timestamps,
  },
  (table) => [
    unique("unique_tag_name_and_user_id").on(table.userId, table.name),
    index("tag_user_id_idx").on(table.userId),
  ],
);

export const transactionTags = pgTable(
  "transaction_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountTransactionId: uuid("account_transaction_id")
      .references(() => accountTransactions.id, { onDelete: "cascade" })
      .notNull(),
    tagId: uuid("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
    ...timestamps,
  },
  (table) => [
    unique("unique_transaction_tag_id_and_account_transaction_id").on(
      table.accountTransactionId,
      table.tagId,
    ),
    index("account_transaction_id_idx").on(table.accountTransactionId),
    index("tag_id_idx").on(table.tagId),
  ],
);

export const userRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  tags: many(tags),
}));

export const accountRelations = relations(accounts, ({ many, one }) => ({
  transactions: many(accountTransactions),
  user: one(users, { references: [users.id], fields: [accounts.userId] }),
}));

export const accountTransactionRelations = relations(
  accountTransactions,
  ({ one, many }) => ({
    account: one(accounts, {
      fields: [accountTransactions.accountId],
      references: [accounts.id],
    }),
    tagLinks: many(transactionTags),
  }),
);

export const tagRelations = relations(tags, ({ one }) => ({
  user: one(users, { fields: [tags.userId], references: [users.id] }),
}));

export const transactionTagRelations = relations(
  transactionTags,
  ({ one }) => ({
    tag: one(tags, { fields: [transactionTags.tagId], references: [tags.id] }),
    accountTransaction: one(accountTransactions, {
      fields: [transactionTags.accountTransactionId],
      references: [accountTransactions.id],
    }),
  }),
);

// Types for Seleting Datas
export type User = typeof users.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof accountTransactions.$inferSelect;
export type TagTransaction = typeof transactionTags.$inferSelect;

// Type for Inserting new Datas
export type NewUser = typeof users.$inferInsert;
export type NewTag = typeof tags.$inferInsert;
export type NewAccount = typeof accounts.$inferInsert;
export type NewTransaction = typeof accountTransactions.$inferInsert;
export type NewTagTransaction = typeof transactionTags.$inferInsert;
