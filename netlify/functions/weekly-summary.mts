import type { Config } from "@netlify/functions";
import { drizzle } from "drizzle-orm/netlify-db";
import { gte, eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as schema from "../../db/schema.ts";
export default async () => {
  const { RESEND_API_KEY, EMAIL_FROM, WEEKLY_SUMMARY_TO } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM || !WEEKLY_SUMMARY_TO)
    return Response.json({
      mode: "preview",
      delivered: false,
      message: "Weekly email delivery is not configured. No email was sent.",
      sample: {
        label: "Illustrative example only",
        subject: "PCCI weekly field reporting summary",
        body: "24 reports in the sample workspace. Review submitted reports, verification progress, and approved sanitation results.",
      },
    });
  const db = drizzle({ schema });
  const since = new Date(Date.now() - 7 * 86400000);
  const rows = await db
    .select()
    .from(schema.reports)
    .where(gte(schema.reports.updatedAt, since));
  const approved = rows.filter((r) => r.status === "Admin Approved");
  const waste = approved.reduce(
    (sum, r) => sum + Number((r.data as any).metrics?.waste || 0),
    0,
  );
  const period = new Date().toISOString().slice(0, 10);
  const statuses = [
    "Draft",
    "Submitted",
    "City Verified",
    "Admin Approved",
    "Returned",
  ]
    .map((s) => `${s}: ${rows.filter((r) => r.status === s).length}`)
    .join("\n");
  const text = `PCCI M&E Portal · Weekly summary\nWeek ending ${period}\n\n${rows.length} reports updated in the last seven days.\n${statuses}\n\nApproved reports recorded ${waste.toFixed(1)} metric tons of waste removed.\n\nOpen the portal to review reporting progress: https://pcci-me-portal.netlify.app\n\nMinistry of State for Presidential Affairs · Republic of Liberia`;
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `pcci-weekly-${period}`,
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: WEEKLY_SUMMARY_TO.split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      subject: `PCCI weekly field reporting summary · ${period}`,
      text,
    }),
  });
  if (!result.ok)
    return new Response("Email provider rejected delivery", { status: 502 });
  await db.insert(schema.audits).values({
    id: randomUUID(),
    action: "Weekly summary email sent",
    entity: period,
  });
  return new Response(null, { status: 204 });
};
export const config: Config = { schedule: "0 8 * * 1" };
