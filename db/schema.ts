import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  doublePrecision,
  integer,
} from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  county: text("county"),
  city: text("city"),
  active: boolean("active").notNull().default(true),
  sessionVersion: integer("session_version").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const locations = pgTable("locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  parentId: text("parent_id"),
  county: text("county").notNull(),
  city: text("city"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
});
export const reports = pgTable("reports", {
  id: text("id").primaryKey(),
  number: text("number").notNull().unique(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  team: text("team").notNull(),
  county: text("county").notNull(),
  city: text("city").notNull(),
  district: text("district"),
  community: text("community"),
  status: text("status").notNull().default("Draft"),
  data: jsonb("data").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const audits = pgTable("audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  action: text("action").notNull(),
  entity: text("entity"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const meal = pgTable("meal_records", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("Open"),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const attempts = pgTable("login_attempts", {
  id: text("id").primaryKey(),
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const files = pgTable("files", {
  id: text("id").primaryKey(),
  reportId: text("report_id")
    .notNull()
    .references(() => reports.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
