import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { customTables, customRecords } from "../../db/schema.ts";
export const actions = ["create", "read", "update", "delete"];
const roleNames = ["Admin/M&E Officer", "City Verifier", "Team Supervisor", "Viewer"];
const field = z.object({ key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/).refine(k => !["constructor", "prototype", "__proto__"].includes(k)), label: z.string().trim().min(1).max(100), type: z.enum(["text", "number", "date", "boolean"]), required: z.boolean() }).strict();
const permissions = z.partialRecord(z.enum(roleNames), z.array(z.enum(actions)).max(4));
export const definition = z.object({ title: z.string().trim().min(1).max(120), fields: z.array(field).min(1).max(30).refine(fs => new Set(fs.map(f => f.key)).size === fs.length, "Field keys must be unique"), permissions }).strict();
export const canUse = (user, table, action) => user.role === "Super Admin" || (table.permissions[user.role] || []).includes(action);
export function validateValues(fields, values) {
  const shape = {};
  for (const f of fields) {
    let value = f.type === "number" ? z.number().finite() : f.type === "boolean" ? z.boolean() : f.type === "date" ? z.iso.date() : z.string().trim().max(4000);
    if (f.required && f.type === "text") value = value.min(1);
    shape[f.key] = f.required ? value : value.optional();
  }
  return z.object(shape).strict().safeParse(values);
}
export const inCustomScope = (u, r) => u.role === "Super Admin" || ((!u.county || u.county === r.county) && (!u.city || u.city === r.city) && (u.role !== "Team Supervisor" || u.id === r.ownerId));
export function registerCustomForms(app, db, audit) {
  const scope = inCustomScope;
  app.get("/api/custom-tables", async (req, res) => {
    const tables = await db.select().from(customTables).orderBy(customTables.title);
    res.json(tables.filter(t => actions.some(a => canUse(req.user, t, a))));
  });
  app.post("/api/custom-tables", async (req, res) => {
    if (req.user.role !== "Super Admin") return res.sendStatus(403);
    const parsed = definition.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Provide a title, unique field keys, valid field types, and role permissions." });
    const [table] = await db.insert(customTables).values({ id: randomUUID(), ...parsed.data }).returning();
    await audit(req.user, "Created custom form", table.id);
    res.json(table);
  });
  app.use("/api/custom-tables/:tableId", async (req, res, next) => {
    const [table] = await db.select().from(customTables).where(eq(customTables.id, req.params.tableId));
    if (!table) return res.sendStatus(404);
    req.customTable = table;
    next();
  });
  app.patch("/api/custom-tables/:tableId", async (req, res) => {
    if (req.user.role !== "Super Admin") return res.sendStatus(403);
    const parsed = z.object({ title: definition.shape.title, permissions, version: z.number().int().positive() }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid form settings" });
    const { version, ...settings } = parsed.data;
    const [updated] = await db.update(customTables).set({ ...settings, version: version + 1 }).where(and(eq(customTables.id, req.customTable.id), eq(customTables.version, version))).returning();
    if (!updated) return res.status(409).json({ error: "Form settings changed. Reload before saving." });
    await audit(req.user, "Updated custom form permissions", updated.id);
    res.json(updated);
  });
  app.delete("/api/custom-tables/:tableId", async (req, res) => {
    if (req.user.role !== "Super Admin") return res.sendStatus(403);
    if (req.body.confirmTitle !== req.customTable.title) return res.status(400).json({ error: "Type the form title to confirm deletion" });
    const [deleted] = await db.delete(customTables).where(and(eq(customTables.id, req.customTable.id), eq(customTables.version, req.body.version || 0))).returning();
    if (!deleted) return res.status(409).json({ error: "Form changed. Reload before deleting." });
    await audit(req.user, "Deleted custom form and records", deleted.id);
    res.json({ ok: true });
  });
  app.get("/api/custom-tables/:tableId/records", async (req, res) => {
    if (!canUse(req.user, req.customTable, "read")) return res.sendStatus(403);
    const records = await db.select().from(customRecords).where(eq(customRecords.tableId, req.customTable.id)).orderBy(desc(customRecords.updatedAt));
    res.json(records.filter(r => scope(req.user, r)));
  });
  const write = async (req, res) => {
    const update = req.method === "PUT", table = req.customTable;
    if (!canUse(req.user, table, update ? "update" : "create")) return res.sendStatus(403);
    const parsed = z.object({ county: z.string().trim().min(1).max(120), city: z.string().trim().min(1).max(120), data: z.record(z.string(), z.unknown()), version: z.number().int().positive().optional() }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "County, city, and valid form values are required" });
    const values = validateValues(table.fields, parsed.data.data);
    if (!values.success) return res.status(400).json({ error: "Complete required fields with valid values for their types" });
    const { county, city, version } = parsed.data;
    if (!scope(req.user, { county, city, ownerId: req.user.id })) return res.sendStatus(403);
    let result;
    if (update) {
      const [existing] = await db.select().from(customRecords).where(and(eq(customRecords.id, req.params.recordId), eq(customRecords.tableId, table.id)));
      if (!existing) return res.sendStatus(404);
      if (!scope(req.user, existing)) return res.sendStatus(403);
      [result] = await db.update(customRecords).set({ county, city, data: values.data, version: (version || 0) + 1, updatedAt: new Date() }).where(and(eq(customRecords.id, existing.id), eq(customRecords.version, version || 0))).returning();
      if (!result) return res.status(409).json({ error: "Record changed. Reload and review the latest record before saving." });
    } else {
      [result] = await db.insert(customRecords).values({ id: randomUUID(), tableId: table.id, ownerId: req.user.id, county, city, data: values.data }).returning();
    }
    await audit(req.user, update ? "Updated custom record" : "Created custom record", result.id);
    res.json({ ok: true, id: result.id });
  };
  app.post("/api/custom-tables/:tableId/records", write);
  app.put("/api/custom-tables/:tableId/records/:recordId", write);
  app.delete("/api/custom-tables/:tableId/records/:recordId", async (req, res) => {
    if (!canUse(req.user, req.customTable, "delete")) return res.sendStatus(403);
    const [existing] = await db.select().from(customRecords).where(and(eq(customRecords.id, req.params.recordId), eq(customRecords.tableId, req.customTable.id)));
    if (!existing) return res.sendStatus(404);
    if (!scope(req.user, existing)) return res.sendStatus(403);
    const [deleted] = await db.delete(customRecords).where(and(eq(customRecords.id, existing.id), eq(customRecords.version, req.body.version || 0))).returning();
    if (!deleted) return res.status(409).json({ error: "Record changed. Reload before deleting." });
    await audit(req.user, "Deleted custom record", deleted.id);
    res.json({ ok: true });
  });
}
