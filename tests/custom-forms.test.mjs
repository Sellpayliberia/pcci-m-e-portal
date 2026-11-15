import test from "node:test";
import assert from "node:assert/strict";
import { canUse, inCustomScope, validateValues, definition } from "../netlify/server/custom-forms.mjs";
test("CRUD grants are independent and deny access by default", () => {
  const table = { permissions: { Viewer: ["create"], "City Verifier": ["read", "update"] } };
  assert.equal(canUse({ role: "Viewer" }, table, "create"), true);
  assert.equal(canUse({ role: "Viewer" }, table, "read"), false);
  assert.equal(canUse({ role: "Team Supervisor" }, table, "delete"), false);
  for (const action of ["create", "read", "update", "delete"]) assert.equal(canUse({ role: "Super Admin" }, table, action), true);
});
test("geography and supervisor ownership constrain custom records", () => {
  const record = { county: "Margibi", city: "Kakata", ownerId: "one" };
  assert.equal(inCustomScope({ role: "Viewer", county: "Montserrado" }, record), false);
  assert.equal(inCustomScope({ role: "City Verifier", county: "Margibi", city: "Kakata" }, record), true);
  assert.equal(inCustomScope({ role: "Team Supervisor", id: "two" }, record), false);
  assert.equal(inCustomScope({ role: "Team Supervisor", id: "one" }, record), true);
});
test("typed values reject unknown fields, wrong types, invalid dates and missing requirements", () => {
  const fields = [{ key: "count", type: "number", required: true }, { key: "day", type: "date", required: false }, { key: "checked", type: "boolean", required: true }];
  assert.equal(validateValues(fields, { count: 0, checked: false }).success, true);
  for (const values of [{ count: "2", checked: true }, { count: 2 }, { count: 2, checked: false, extra: "bad" }, { count: 2, checked: true, day: "2026-02-30" }, { count: Infinity, checked: true }]) assert.equal(validateValues(fields, values).success, false);
});
test("definitions prevent duplicate or unsafe field keys and unsupported grants", () => {
  const field = { key: "count", label: "Count", type: "number", required: true };
  const valid = { title: "Activity census", fields: [field], permissions: { Viewer: ["read"] } };
  assert.equal(definition.safeParse(valid).success, true);
  assert.equal(definition.safeParse({ ...valid, fields: [field, field] }).success, false);
  assert.equal(definition.safeParse({ ...valid, fields: [{ ...field, key: "constructor" }] }).success, false);
  assert.equal(definition.safeParse({ ...valid, permissions: { Viewer: ["approve"] } }).success, false);
});

test("API rejects unauthorized CRUD and hides records outside geographic scope", async () => {
  const { default: express } = await import("express");
  const { registerCustomForms } = await import("../netlify/server/custom-forms.mjs");
  const table = { id: "table", title: "Census", fields: [{ key: "count", type: "number", required: true }], permissions: { Viewer: ["read"] } };
  const records = [{ id: "local", county: "Margibi", city: "Kakata" }, { id: "outside", county: "Montserrado", city: "Monrovia" }];
  let selections = 0;
  const db = { select: () => ({ from: () => ({ where: () => { selections++; const value = [table]; return Object.assign(Promise.resolve(value), { orderBy: async () => records }); } }) }) };
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { req.user = { role: "Viewer", county: "Margibi" }; next(); });
  registerCustomForms(app, db, async () => {});
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/custom-tables`;
  try {
    const read = await fetch(`${url}/table/records`);
    assert.equal(read.status, 200);
    assert.deepEqual((await read.json()).map(r => r.id), ["local"]);
    for (const [path, method] of [["", "POST"], ["/table", "PATCH"], ["/table", "DELETE"], ["/table/records", "POST"], ["/table/records/local", "PUT"], ["/table/records/local", "DELETE"]]) {
      const response = await fetch(url + path, { method, headers: { "Content-Type": "application/json" }, body: "{}" });
      assert.equal(response.status, 403, `${method} ${path}`);
    }
    assert.ok(selections > 0);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
