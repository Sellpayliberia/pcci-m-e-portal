import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/netlify-db";
import { eq, and, desc, sql } from "drizzle-orm";
import { getStore } from "@netlify/blobs";
import * as schema from "../../db/schema.ts";
import { reportInput, userInput, registrationInput } from "./validation.mjs";
import { seedLocations } from "./seed.mjs";
const { users, locations, reports, audits, meal, attempts, files, authConfig } = schema;
const db = drizzle({ schema });
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(cookieParser());
app.use(express.json({ limit: "12mb" }));
const roles = [
  "Super Admin",
  "Admin/M&E Officer",
  "City Verifier",
  "Team Supervisor",
  "Viewer",
];
const admin = (u) => ["Super Admin", "Admin/M&E Officer"].includes(u.role);
const clean = (u) => {
  const { passwordHash, ...safe } = u;
  return safe;
};
const bootstrapUsername = (process.env.SUPER_ADMIN_USERNAME || "webmasterliberia@gmail.com").trim().toLowerCase();
const secret = async () => {
  if (process.env.SESSION_SECRET?.length >= 32)
    return new TextEncoder().encode(process.env.SESSION_SECRET);
  // Insert once across concurrent instances; read the winning key from durable storage.
  await db.insert(authConfig).values({ id: "session", signingKey: randomBytes(48).toString("base64url") }).onConflictDoNothing();
  const [config] = await db.select().from(authConfig).where(eq(authConfig.id, "session"));
  return new TextEncoder().encode(config.signingKey);
};
async function audit(u, action, entity = "") {
  await db.insert(audits).values({
    id: randomUUID(),
    userId: u?.id,
    action,
    entity: String(entity).slice(0, 180),
  });
}
function allowed(u, r) {
  return (
    (!u.county || u.county === r.county) &&
    (!u.city || u.city === r.city) &&
    (u.role !== "Team Supervisor" || r.ownerId === u.id)
  );
}
async function bootstrap() {
  await db.insert(locations).values(seedLocations()).onConflictDoNothing();
  if (bootstrapUsername && process.env.SUPER_ADMIN_PASSWORD) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, bootstrapUsername))
      .limit(1);
    if (!existing) {
      if (
        process.env.SUPER_ADMIN_PASSWORD.length < 10 ||
        Buffer.byteLength(process.env.SUPER_ADMIN_PASSWORD) > 72
      )
        throw Error("Initial password must be at least 10 characters");
      await db
        .insert(users)
        .values({
          id: randomUUID(),
          username: bootstrapUsername,
          name: process.env.SUPER_ADMIN_NAME || "Administrator",
          passwordHash: await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD, 12),
          role: "Super Admin",
          active: true,
          county: null,
          city: null,
        })
        .onConflictDoNothing();
    } else {
      await db.update(users).set({ role: "Super Admin", active: true, approvalStatus: "Approved", county: null, city: null }).where(eq(users.id, existing.id));
    }
  }
}
app.use("/api", async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (
      origin &&
      origin !== `https://${req.get("host")}` &&
      origin !== `http://${req.get("host")}`
    )
      return res.status(403).json({ error: "Request origin rejected" });
  }
  next();
});
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/api/config", (req, res) =>
  res.json({
    administratorBootstrapConfigured: Boolean(
      bootstrapUsername && process.env.SUPER_ADMIN_PASSWORD,
    ),
    weeklyEmailConfigured: Boolean(
      process.env.RESEND_API_KEY &&
      process.env.EMAIL_FROM &&
      process.env.WEEKLY_SUMMARY_TO,
    ),
  }),
);
app.post("/api/register", async (req, res) => {
  const parsed = registrationInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter your full name, a valid email, and a password of 10–72 characters (maximum 72 UTF-8 bytes)." });
  const key = createHash("sha256").update(`register:${req.ip}`).digest("hex");
  const [gate] = await db.insert(attempts).values({ id: key, count: 1 }).onConflictDoUpdate({
    target: attempts.id,
    set: { count: sql`CASE WHEN ${attempts.updatedAt} < NOW() - INTERVAL '15 minutes' THEN 1 ELSE ${attempts.count} + 1 END`, updatedAt: sql`CASE WHEN ${attempts.updatedAt} < NOW() - INTERVAL '15 minutes' THEN NOW() ELSE ${attempts.updatedAt} END` },
  }).returning();
  if (gate.count > 5) return res.status(429).json({ error: "Too many registration requests. Try again in 15 minutes." });
  const b = parsed.data;
  if (b.username === bootstrapUsername)
    return res.status(400).json({ error: "This email is reserved for the portal administrator." });
  await db.insert(users).values({ id: randomUUID(), name: b.name, username: b.username,
    passwordHash: await bcrypt.hash(b.password, 12), role: "Viewer", active: false,
    approvalStatus: "Pending", county: null, city: null }).onConflictDoNothing();
  res.status(202).json({ message: "Registration received. Contact webmasterliberia@gmail.com for approval before signing in." });
});
app.post("/api/login", async (req, res) => {
  if (!process.env.SUPER_ADMIN_PASSWORD) {
    const [existing] = await db.select({ id: users.id }).from(users).limit(1);
    if (!existing)
      return res
        .status(503)
        .json({
          error:
            "Administrator setup is incomplete. Contact the portal administrator to finish secure account configuration.",
        });
  }
  await bootstrap();
  const username = String(req.body.username || "").trim().toLowerCase();
  const key = createHash("sha256")
    .update(`${req.ip}:${username}`)
    .digest("hex");
  const [a] = await db.select().from(attempts).where(eq(attempts.id, key));
  if (
    a &&
    a.count >= 8 &&
    Date.now() - new Date(a.updatedAt).getTime() < 900000
  )
    return res
      .status(429)
      .json({ error: "Too many attempts. Try again in 15 minutes." });
  const [u] = await db.select().from(users).where(eq(users.username, username));
  if (
    !u?.active ||
    u.approvalStatus !== "Approved" ||
    !(await bcrypt.compare(String(req.body.password || ""), u.passwordHash))
  ) {
    await db
      .insert(attempts)
      .values({ id: key, count: 1 })
      .onConflictDoUpdate({
        target: attempts.id,
        set: {
          count:
            a && Date.now() - new Date(a.updatedAt).getTime() < 900000
              ? a.count + 1
              : 1,
          updatedAt: new Date(),
        },
      });
    await audit(null, "Login failed", username);
    return res.status(401).json({ error: "Invalid username or password" });
  }
  const token = await new SignJWT({ v: u.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(u.id)
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(await secret());
  res.cookie("pcci_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    maxAge: 1800000,
    path: "/api",
  });
  await db.delete(attempts).where(eq(attempts.id, key));
  await audit(u, "Signed in");
  res.json(clean(u));
});
app.use("/api", async (req, res, next) => {
  let payload;
  try {
    ({ payload } = await jwtVerify(req.cookies.pcci_session || "", await secret(), {
      algorithms: ["HS256"],
    }));
  } catch {
    return res
      .status(401)
      .json({ error: "Please sign in. Sessions expire after 30 minutes." });
  }
  const [u] = await db.select().from(users).where(eq(users.id, payload.sub));
  if (!u?.active || u.approvalStatus !== "Approved" || u.sessionVersion !== payload.v)
    return res
      .status(401)
      .json({ error: "Your account session expired. Please sign in again." });
  req.user = u;
  await audit(u, `${req.method} ${req.path}`);
  next();
});
app.post("/api/feedback", async (req, res) => {
  const { title, description, community } = req.body;
  if (
    typeof title !== "string" ||
    typeof description !== "string" ||
    !title.trim() ||
    !description.trim() ||
    description.length > 4000 ||
    (community !== undefined && typeof community !== "string")
  )
    return res.status(400).json({
      error: "A subject and feedback of up to 4,000 characters are required",
    });
  const key = createHash("sha256").update(`feedback:${req.ip}`).digest("hex");
  const [a] = await db.select().from(attempts).where(eq(attempts.id, key));
  if (a && Date.now() - new Date(a.updatedAt).getTime() < 60000)
    return res
      .status(429)
      .json({ error: "Please wait a minute before sending more feedback." });
  await db
    .insert(attempts)
    .values({ id: key, count: 1 })
    .onConflictDoUpdate({
      target: attempts.id,
      set: { updatedAt: new Date() },
    });
  const id = randomUUID();
  await db.insert(meal).values({
    id,
    kind: "Grievances",
    title: String(title).slice(0, 160),
    data: { description, community },
    status: "Open",
  });
  await audit(req.user, "Feedback received", id);
  res.json({ id });
});
app.get("/api/me", (req, res) => res.json(clean(req.user)));
app.post("/api/logout", async (req, res) => {
  await db
    .update(users)
    .set({ sessionVersion: req.user.sessionVersion + 1 })
    .where(eq(users.id, req.user.id));
  res.clearCookie("pcci_session", { path: "/api" });
  res.json({ ok: true });
});
app.post("/api/password", async (req, res) => {
  if (
    String(req.body.password || "").length < 10 ||
    Buffer.byteLength(req.body.password || "") > 72
  )
    return res.status(400).json({ error: "Use at least 10 characters" });
  if (
    !(await bcrypt.compare(
      String(req.body.currentPassword || ""),
      req.user.passwordHash,
    ))
  )
    return res.status(403).json({ error: "Current password is incorrect" });
  await db
    .update(users)
    .set({
      passwordHash: await bcrypt.hash(req.body.password, 12),
      sessionVersion: req.user.sessionVersion + 1,
    })
    .where(eq(users.id, req.user.id));
  res.clearCookie("pcci_session", { path: "/api" });
  res.json({ ok: true });
});
app.get("/api/users", async (req, res) => {
  if (req.user.role !== "Super Admin") return res.sendStatus(403);
  res.json((await db.select().from(users).orderBy(users.name)).map(clean));
});
app.post("/api/users", async (req, res) => {
  if (req.user.role !== "Super Admin") return res.sendStatus(403);
  const b = req.body;
  if (
    !b.name ||
    !b.username ||
    !roles.includes(b.role) ||
    String(b.password || "").length < 10 ||
    Buffer.byteLength(b.password || "") > 72
  )
    return res.status(400).json({
      error:
        "Name, username, valid role, and a password of at least 10 characters are required",
    });
  await db.insert(users).values({
    id: randomUUID(),
    name: b.name,
    username: String(b.username).toLowerCase(),
    role: b.role,
    county: b.county || null,
    city: b.city || null,
    passwordHash: await bcrypt.hash(b.password, 12),
  });
  res.json({ ok: true });
});
app.patch("/api/users/:id", async (req, res) => {
  if (req.user.role !== "Super Admin") return res.sendStatus(403);
  const parsed = userInput.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid user details" });
  const b = parsed.data;
  const [target] = await db.select().from(users).where(eq(users.id, req.params.id));
  if (!target) return res.sendStatus(404);
  if (target.approvalStatus === "Pending" && req.user.username !== bootstrapUsername)
    return res.status(403).json({ error: "Only the designated Super Admin can approve registration requests." });
  if (
    req.params.id === req.user.id &&
    (b.active === false || (b.role && b.role !== "Super Admin"))
  )
    return res
      .status(400)
      .json({ error: "You cannot remove your own administrator access" });
  if (b.role && !roles.includes(b.role)) return res.sendStatus(400);
  const values = { sessionVersion: sql`${users.sessionVersion} + 1` };
  if (b.active === true && target.approvalStatus === "Pending") {
    values.approvalStatus = "Approved";
    await audit(req.user, "Registration approved", target.id);
  }
  for (const k of ["name", "role", "county", "city", "active"])
    if (b[k] !== undefined) values[k] = b[k];
  if (b.password) {
    if (b.password.length < 10 || Buffer.byteLength(b.password) > 72)
      return res.status(400).json({ error: "Use at least 10 characters" });
    values.passwordHash = await bcrypt.hash(b.password, 12);
  }
  await db.update(users).set(values).where(eq(users.id, req.params.id));
  res.json({ ok: true });
});
app.delete("/api/users/:id", async (req, res) => {
  if (req.user.role !== "Super Admin" || req.params.id === req.user.id)
    return res.sendStatus(403);
  const [r] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(eq(reports.ownerId, req.params.id))
    .limit(1);
  if (r)
    return res.status(409).json({
      error:
        "This user owns reports. Deactivate the account to preserve the audit trail.",
    });
  await db.delete(users).where(eq(users.id, req.params.id));
  res.json({ ok: true });
});
app.get("/api/audit", async (req, res) => {
  if (!admin(req.user)) return res.sendStatus(403);
  res.json(
    await db
      .select({
        id: audits.id,
        action: audits.action,
        entity: audits.entity,
        createdAt: audits.createdAt,
        name: users.name,
      })
      .from(audits)
      .leftJoin(users, eq(audits.userId, users.id))
      .orderBy(desc(audits.createdAt))
      .limit(500),
  );
});
app.get("/api/locations", async (req, res) => {
  await db.insert(locations).values(seedLocations()).onConflictDoNothing();
  res.json(
    (await db.select().from(locations)).filter(
      (l) =>
        (!req.user.county || l.county === req.user.county) &&
        (!req.user.city || !l.city || l.city === req.user.city),
    ),
  );
});
app.post("/api/locations", async (req, res) => {
  if (!admin(req.user)) return res.sendStatus(403);
  const rows = Array.isArray(req.body) ? req.body : [req.body];
  if (rows.length > 1000) return res.sendStatus(400);
  for (const r of rows) {
    if (
      !["County", "City", "District", "Community", "Market"].includes(r.type) ||
      !r.name ||
      !r.county ||
      !Number.isFinite(Number(r.latitude)) ||
      Math.abs(Number(r.latitude)) > 90 ||
      !Number.isFinite(Number(r.longitude)) ||
      Math.abs(Number(r.longitude)) > 180 ||
      !allowed({ ...req.user, role: "Viewer" }, r)
    )
      return res.status(400).json({
        error: "Check location names, scope, type, and GPS coordinates",
      });
    if (r.type !== "County") {
      const [p] = await db
        .select()
        .from(locations)
        .where(eq(locations.id, r.parentId || ""));
      if (
        !p ||
        p.county !== r.county ||
        (p.type !== "County" && p.city !== r.city) ||
        ["County", "City", "District", "Community", "Market"].indexOf(
          r.type,
        ) !==
          ["County", "City", "District", "Community", "Market"].indexOf(
            p.type,
          ) +
            1
      )
        return res
          .status(400)
          .json({ error: "Select a valid parent location" });
    }
    await db
      .insert(locations)
      .values({
        id: r.id || randomUUID(),
        name: r.name,
        type: r.type,
        parentId: r.parentId || null,
        county: r.county,
        city: r.city || null,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
      })
      .onConflictDoNothing();
  }
  res.json({ ok: true });
});
app.get("/api/reports", async (req, res) =>
  res.json(
    (await db.select().from(reports).orderBy(desc(reports.updatedAt))).filter(
      (r) => allowed(req.user, r),
    ),
  ),
);
app.put("/api/reports/:id", async (req, res) => {
  if (req.user.role === "Viewer" || req.user.role === "City Verifier")
    return res.sendStatus(403);
  const parsed = reportInput.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error:
        "Check report fields: " +
        parsed.error.issues
          .map((i) => i.path.join(".") + " " + i.message)
          .slice(0, 3)
          .join("; "),
    });
  const b = parsed.data;
  b.county = b.county || req.user.county || "";
  b.city = b.city || req.user.city || "";
  if (!allowed({ ...req.user, role: "Viewer" }, b))
    return res
      .status(403)
      .json({ error: "Select a location within your assigned scope" });
  const [old] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, req.params.id));
  if (
    old &&
    (!allowed(req.user, old) || !["Draft", "Returned"].includes(old.status))
  )
    return res.status(403).json({ error: "This report cannot be edited" });
  if (old && b.version !== old.version)
    return res.status(409).json({
      error: "This report changed on the server. Refresh before editing.",
    });
  const chosen = await db
    .select()
    .from(locations)
    .where(
      and(
        eq(locations.name, b.city),
        eq(locations.type, "City"),
        eq(locations.county, b.county),
      ),
    );
  if (b.city && !chosen.length)
    return res.status(400).json({
      error: "Select a valid county and city from the location directory",
    });
  if (
    b.data.periodStart &&
    b.data.periodEnd &&
    b.data.periodStart > b.data.periodEnd
  )
    return res
      .status(400)
      .json({ error: "The reporting period end must follow its start" });
  let parent = chosen[0];
  for (const [type, name] of [
    ["District", b.district],
    ["Community", b.community],
    ["Market", b.data.market],
  ]) {
    if (!name) continue;
    if (!parent)
      return res
        .status(400)
        .json({ error: "Select the parent location first" });
    const [child] = await db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.type, type),
          eq(locations.name, name),
          eq(locations.parentId, parent.id),
        ),
      );
    if (!child)
      return res.status(400).json({
        error:
          "Check the county, city, district, community, and market hierarchy",
      });
    parent = child;
  }
  for (const p of b.data.photos || []) {
    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, p.id), eq(files.reportId, req.params.id)));
    if (!file)
      return res
        .status(400)
        .json({ error: "Photo does not belong to this report" });
    p.url = `/api/photos/${file.id}`;
    p.name = file.name;
  }
  const values = {
    team: b.team,
    county: b.county,
    city: b.city,
    district: b.district || "",
    community: b.community || "",
    data: { ...b.data, history: old?.data.history || [] },
    updatedAt: new Date(),
  };
  if (old) {
    const changed = await db
      .update(reports)
      .set({ ...values, version: old.version + 1 })
      .where(and(eq(reports.id, old.id), eq(reports.version, old.version)))
      .returning();
    if (!changed.length)
      return res.status(409).json({ error: "Concurrent edit detected" });
    res.json(changed[0]);
  } else {
    const [r] = await db
      .insert(reports)
      .values({
        ...values,
        id: req.params.id,
        number: `PCCI-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        ownerId: req.user.id,
        status: "Draft",
      })
      .returning();
    res.json(r);
  }
});
app.post("/api/reports/:id/transition", async (req, res) => {
  const [r] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, req.params.id));
  if (!r || !allowed(req.user, r)) return res.sendStatus(404);
  const { status, comment, signature, position } = req.body;
  const valid =
    (status === "Submitted" &&
      ["Draft", "Returned"].includes(r.status) &&
      (r.ownerId === req.user.id || admin(req.user))) ||
    (status === "City Verified" &&
      r.status === "Submitted" &&
      (req.user.role === "City Verifier" || admin(req.user))) ||
    (status === "Admin Approved" &&
      r.status === "City Verified" &&
      admin(req.user)) ||
    (status === "Returned" &&
      ["Submitted", "City Verified"].includes(r.status) &&
      (admin(req.user) || req.user.role === "City Verifier"));
  if (!valid)
    return res
      .status(403)
      .json({ error: "This transition is not permitted for your role" });
  if (status === "Returned" && !String(comment || "").trim())
    return res.status(400).json({ error: "Return comments are required" });
  if (status === "City Verified" && (!signature || !position))
    return res
      .status(400)
      .json({ error: "Verifier position and signature are required" });
  if (
    status === "Submitted" &&
    (!r.team ||
      !r.county ||
      !r.city ||
      !r.data.supervisor ||
      !r.data.periodStart ||
      !r.data.periodEnd)
  )
    return res.status(400).json({
      error:
        "Team, county, city, supervisor, and reporting period are required",
    });
  const history = [
    ...(r.data.history || []),
    {
      status,
      comment,
      signature,
      position,
      name: req.user.name,
      date: new Date().toISOString(),
    },
  ];
  const changed = await db
    .update(reports)
    .set({
      status,
      data: { ...r.data, history },
      version: r.version + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(reports.id, r.id), eq(reports.version, r.version)))
    .returning();
  if (!changed.length)
    return res
      .status(409)
      .json({ error: "Report changed. Refresh and try again." });
  res.json(changed[0]);
});
app.post("/api/reports/:id/photos", async (req, res) => {
  const [r] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, req.params.id));
  if (
    !r ||
    !allowed(req.user, r) ||
    !["Draft", "Returned"].includes(r.status) ||
    !["Team Supervisor", "Super Admin", "Admin/M&E Officer"].includes(
      req.user.role,
    )
  )
    return res.sendStatus(403);
  const { base64, type, name } = req.body;
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(type) ||
    !base64 ||
    base64.length > 7000000
  )
    return res
      .status(400)
      .json({ error: "Upload a JPG, PNG or WebP image smaller than 5 MB" });
  const id = randomUUID();
  await getStore("pcci-photos").set(id, Buffer.from(base64, "base64"));
  await db
    .insert(files)
    .values({ id, reportId: r.id, name: String(name).slice(0, 200), type });
  res.json({ id, url: `/api/photos/${id}`, name });
});
app.get("/api/photos/:id", async (req, res) => {
  const [f] = await db.select().from(files).where(eq(files.id, req.params.id));
  if (!f) return res.sendStatus(404);
  const [r] = await db.select().from(reports).where(eq(reports.id, f.reportId));
  if (!r || !allowed(req.user, r)) return res.sendStatus(403);
  const data = await getStore("pcci-photos").get(f.id, { type: "arrayBuffer" });
  if (!data) return res.sendStatus(404);
  res.type(f.type).send(Buffer.from(data));
});
app.get("/api/meal", async (req, res) => {
  if (!admin(req.user)) return res.sendStatus(403);
  res.json(await db.select().from(meal).orderBy(desc(meal.createdAt)));
});
app.post("/api/meal", async (req, res) => {
  if (!admin(req.user)) return res.sendStatus(403);
  const b = req.body;
  if (
    ![
      "Indicators",
      "Surveys",
      "Grievances",
      "Lessons learned",
      "Action tracker",
    ].includes(b.kind) ||
    typeof b.title !== "string" ||
    !b.title.trim() ||
    b.title.length > 300
  )
    return res.sendStatus(400);
  const [r] = await db
    .insert(meal)
    .values({
      id: randomUUID(),
      kind: b.kind,
      title: b.title,
      status: "Open",
      data: b.data || {},
    })
    .returning();
  res.json(r);
});
app.post("/api/meal/:id/responses", async (req, res) => {
  if (!admin(req.user)) return res.sendStatus(403);
  const [survey] = await db
    .select()
    .from(meal)
    .where(eq(meal.id, req.params.id));
  if (!survey || survey.kind !== "Surveys") return res.sendStatus(404);
  const answers = req.body.answers || {};
  const fields = survey.data.fields || [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const a = answers[String(i)];
    if (f.required && !String(a || "").trim())
      return res.status(400).json({ error: "Complete all required questions" });
    if (
      a &&
      ["Number", "Rating 1–5"].includes(f.type) &&
      (!Number.isFinite(Number(a)) ||
        (f.type === "Rating 1–5" && (Number(a) < 1 || Number(a) > 5)))
    )
      return res
        .status(400)
        .json({ error: "Enter a valid number or a rating from 1 to 5" });
    if (String(a || "").length > 4000)
      return res
        .status(400)
        .json({ error: "Answers must be fewer than 4,000 characters" });
  }
  await db.insert(meal).values({
    id: randomUUID(),
    kind: "Survey responses",
    title: survey.title,
    status: "Closed",
    data: { surveyId: survey.id, answers, respondent: req.user.id },
  });
  res.json({ ok: true });
});
app.patch("/api/meal/:id", async (req, res) => {
  if (!admin(req.user)) return res.sendStatus(403);
  if (!["Open", "In progress", "Resolved", "Closed"].includes(req.body.status))
    return res.sendStatus(400);
  await db
    .update(meal)
    .set({ status: req.body.status })
    .where(eq(meal.id, req.params.id));
  res.json({ ok: true });
});
app.use((err, req, res, next) => {
  res.status(500).json({
    error:
      err.code === "23505"
        ? "This record already exists."
        : "The request could not be completed. Please try again or contact your administrator.",
  });
});
// Complete configured administrator setup when the deployed server starts.
if (bootstrapUsername && process.env.SUPER_ADMIN_PASSWORD) {
  await bootstrap();
}
export default app;
