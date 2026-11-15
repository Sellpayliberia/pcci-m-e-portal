import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { demoReports } from "../../src/data.ts";
import { trainingWorkspaces } from "../../db/schema.ts";

const metrics = z.object(Object.fromEntries(
  ["spaces", "waste", "drains", "youth", "cbo", "reach", "volunteers", "ppe"].map(key =>
    [key, z.number().finite().min(0).max(["youth", "cbo", "ppe"].includes(key) ? 100 : 10000000)])
));
const input = z.object({
  version: z.number().int().positive(),
  report: z.object({
    id: z.string().uuid(), team: z.string().trim().min(1).max(150),
    county: z.string().trim().min(1).max(100), city: z.string().trim().min(1).max(100),
    periodStart: z.iso.date(), periodEnd: z.iso.date(),
    notes: z.string().max(3000), metrics,
  }).refine(r => r.periodEnd >= r.periodStart, "End date must follow start date"),
});
const transitions = {
  Draft: ["Submitted"], Returned: ["Submitted"],
  Submitted: ["City Verified", "Returned"],
  "City Verified": ["Admin Approved", "Returned"], "Admin Approved": [],
};
function samples() {
  return demoReports.slice(0, 8).map((r, i) => ({
    id: randomUUID(), number: `TRAIN-${String(i + 1).padStart(3, "0")}`,
    team: r.team, county: r.county, city: r.city, status: r.status,
    periodStart: r.data.periodStart, periodEnd: r.data.periodEnd,
    metrics: r.data.metrics, notes: "Illustrative training exercise. Practice checking quantities and reviewing a report.",
    history: [],
  }));
}
export function registerTraining(app, db) {
  const load = async (userId) => {
    await db.insert(trainingWorkspaces).values({ userId, reports: samples() }).onConflictDoNothing();
    const [row] = await db.select().from(trainingWorkspaces).where(eq(trainingWorkspaces.userId, userId));
    return row;
  };
  const save = async (req, res, workspace, reports) => {
    const [row] = await db.update(trainingWorkspaces).set({ reports, version: sql`${trainingWorkspaces.version} + 1` })
      .where(and(eq(trainingWorkspaces.userId, req.user.id), eq(trainingWorkspaces.version, workspace.version))).returning();
    if (!row) return res.status(409).json({ error: "Training workspace changed. Reload before trying again." });
    res.json(row);
  };
  app.get("/api/training", async (req, res) => res.json(await load(req.user.id)));
  app.put("/api/training/report", async (req, res) => {
    const parsed = input.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Check the report fields, date range and metric limits." });
    const workspace = await load(req.user.id);
    if (workspace.version !== parsed.data.version) return res.status(409).json({ error: "Training workspace changed. Reload before saving." });
    const r = parsed.data.report;
    const old = workspace.reports.find(v => v.id === r.id);
    if (old && !["Draft", "Returned"].includes(old.status)) return res.status(400).json({ error: "Only draft or returned practice reports can be edited." });
    if (!old && workspace.reports.length >= 100) return res.status(400).json({ error: "Reset the workspace to start more exercises (100 report limit)." });
    const report = { ...r, number: old?.number || `TRAIN-${String(workspace.reports.length + 1).padStart(3, "0")}`, status: old?.status || "Draft", history: old?.history || [] };
    await save(req, res, workspace, old ? workspace.reports.map(v => v.id === r.id ? report : v) : [...workspace.reports, report]);
  });
  app.post("/api/training/transition", async (req, res) => {
    const parsed = z.object({ id: z.string().uuid(), version: z.number().int().positive(), status: z.string().max(30) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid practice transition." });
    const workspace = await load(req.user.id);
    if (workspace.version !== parsed.data.version) return res.status(409).json({ error: "Training workspace changed. Reload before trying again." });
    const report = workspace.reports.find(v => v.id === parsed.data.id);
    if (!report || !transitions[report.status]?.includes(parsed.data.status)) return res.status(400).json({ error: "This practice transition is unavailable." });
    const updated = { ...report, status: parsed.data.status, history: [...report.history, { from: report.status, to: parsed.data.status, at: new Date().toISOString() }] };
    await save(req, res, workspace, workspace.reports.map(v => v.id === report.id ? updated : v));
  });
  app.post("/api/training/reset", async (req, res) => {
    const workspace = await load(req.user.id);
    if (workspace.version !== req.body.version) return res.status(409).json({ error: "Training workspace changed. Reload before resetting." });
    await save(req, res, workspace, samples());
  });
}
