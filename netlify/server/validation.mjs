import { z } from "zod";
const text = z.string().max(500).optional();
const quantity = z.coerce.number().finite().min(0);
const metric = z.object({
  spaces: quantity,
  waste: quantity,
  drains: quantity,
  youth: quantity.max(100),
  cbo: quantity.max(100),
  reach: quantity,
  volunteers: quantity,
  ppe: quantity.max(100),
});
const attendance = z.record(z.string(), quantity);
const sanitation = z.object({
  site: text,
  siteType: text,
  location: text,
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  activities: text,
  date: text,
  start: text,
  end: text,
  wasteType: z.enum(["Household", "Municipal", ""]).optional(),
  weight: quantity.optional(),
  before: z.enum(["Poor", "Fair", "Good", ""]).optional(),
  after: z.enum(["Poor", "Fair", "Good", ""]).optional(),
});
const awareness = z.object({
  site: text,
  siteType: text,
  medium: z.enum(["In-person", "Digital", ""]).optional(),
  conducted: z.enum(["Yes", "No", ""]).optional(),
  reached: quantity.optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
});
export const reportInput = z.object({
  team: z.string().max(200),
  county: z.string().max(200),
  city: z.string().max(200),
  district: text,
  community: text,
  version: z.number().int().positive().optional(),
  data: z.object({
    type: z.enum(["Daily", "Weekly"]),
    supervisor: text,
    phone: text,
    periodStart: text,
    periodEnd: text,
    market: text,
    zone: text,
    cost: quantity.optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    metrics: metric,
    attendance: attendance.optional(),
    attendanceNotes: z.string().max(3000).optional(),
    sanitation: z.array(sanitation).max(200).optional(),
    awareness: z.array(awareness).max(200).optional(),
    equipment: z
      .array(
        z.object({
          name: text,
          received: quantity.optional(),
          available: quantity.optional(),
          condition: text,
        }),
      )
      .max(100)
      .optional(),
    challenges: z
      .array(
        z.object({
          challenge: text,
          escalation: text,
          responsible: text,
          priority: text,
        }),
      )
      .max(100)
      .optional(),
    checklist: z.record(z.string(), z.boolean()).optional(),
    photos: z
      .array(z.object({ id: z.string(), url: z.string(), name: z.string() }))
      .max(100)
      .optional(),
  }),
});
export const userInput = z.object({
  name: z.string().min(1).max(160).optional(),
  role: z
    .enum([
      "Super Admin",
      "Admin/M&E Officer",
      "City Verifier",
      "Team Supervisor",
      "Viewer",
    ])
    .optional(),
  county: z.string().max(160).nullable().optional(),
  city: z.string().max(160).nullable().optional(),
  active: z.boolean().optional(),
  password: z.string().max(72).optional(),
});
