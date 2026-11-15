import { get, set, del, update } from "idb-keyval";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import writeXlsxFile from "write-excel-file/browser";
import Papa from "papaparse";
import { targets, aggregate } from "./data";
export async function api(path: string, method = "GET", body?: any) {
  const r = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    if (r.status === 401 && !["/me", "/login"].includes(path))
      window.dispatchEvent(new Event("pcci-session-expired"));
    const v = await r.json().catch(() => ({
      error:
        r.status === 403
          ? "You do not have permission to perform this action."
          : "Unable to connect to the portal.",
    }));
    throw Error(v.error);
  }
  return r.json();
}
export async function queueDraft(userId: string, report: any) {
  await set(`pcci-draft:${userId}:${report.id}`, report);
  await update<string[]>(`pcci-queue:${userId}`, (ids) =>
    Array.from(new Set([...(ids || []), report.id])),
  );
}
export async function discardDraft(userId: string, id: string) {
  await del(`pcci-draft:${userId}:${id}`);
  await update<string[]>(`pcci-queue:${userId}`, (ids) =>
    (ids || []).filter((v) => v !== id),
  );
}
export async function syncDrafts(userId: string) {
  const ids = (await get<string[]>(`pcci-queue:${userId}`)) || [];
  let count = 0;
  for (const id of ids) {
    const r = await get(`pcci-draft:${userId}:${id}`);
    if (r) await api(`/reports/${id}`, "PUT", r);
    await discardDraft(userId, id);
    count++;
  }
  return count;
}
export async function localDrafts(userId: string) {
  const ids = (await get<string[]>(`pcci-queue:${userId}`)) || [];
  return (
    await Promise.all(ids.map((id) => get(`pcci-draft:${userId}:${id}`)))
  ).filter(Boolean);
}
export async function exportTable(reports: any[], format = "csv") {
  const rows = reports.map((r) => ({
    "Report number": r.number,
    Team: r.team,
    County: r.county,
    City: r.city,
    District: r.district,
    Community: r.community,
    Status: r.status,
    Type: r.data.type,
    "Period start": r.data.periodStart,
    "Period end": r.data.periodEnd,
    ...r.data.metrics,
  }));
  if (format === "pdf") {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(17);
    doc.text("PCCI | Report register", 14, 18);
    autoTable(doc, {
      startY: 27,
      head: [["Report", "Team", "County", "City", "Period", "Status"]],
      body: reports.map((r) => [
        r.number || "Draft",
        r.team,
        r.county,
        r.city,
        `${r.data.periodStart} to ${r.data.periodEnd}`,
        r.status,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [20, 45, 80] },
    });
    doc.save("PCCI-report-register.pdf");
    return;
  }
  if (format === "xlsx") {
    const keys = Object.keys(rows[0] || { "Report number": "" });
    await writeXlsxFile(
      [
        keys.map((value) => ({ value, fontWeight: "bold" })),
        ...rows.map((r) =>
          keys.map((k) => ({
            value: r[k] ?? "",
            type: typeof r[k] === "number" ? Number : String,
          })),
        ),
      ],
      { fileName: "PCCI-reports.xlsx" },
    );
  } else {
    const csv = Papa.unparse(rows, { escapeFormulae: true });
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "PCCI-reports.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
export async function reportPDF(r: any, reports: any[] = []) {
  const doc = new jsPDF();
  doc.setFillColor(20, 45, 80);
  doc.rect(0, 0, 210, 30, "F");
  doc.setTextColor(255);
  doc.setFontSize(17);
  doc.text("PCCI | FIELD REPORT", 14, 14);
  doc.setFontSize(9);
  doc.text(
    "Presidential Clean Cities Initiative · Republic of Liberia",
    14,
    22,
  );
  doc.setTextColor(20, 45, 80);
  let y = 38;
  const section = (title: string, head: string[], body: any[][]) => {
    autoTable(doc, {
      startY: y,
      head: [[title, ...head.slice(1)]],
      body,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [20, 45, 80] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    if (y > 250) {
      doc.addPage();
      y = 16;
    }
  };
  section(
    "SECTION A · TEAM & LOCATION",
    ["Field", "Details"],
    [
      ["Report", r.number || "Draft"],
      ["Team / Type", `${r.team} / ${r.data.type}`],
      ["County / City", `${r.county} / ${r.city}`],
      ["District / Community", `${r.district || ""} / ${r.community || ""}`],
      [
        "Nearest market / Zone",
        `${r.data.market || ""} / ${r.data.zone || ""}`,
      ],
      ["Period", `${r.data.periodStart} — ${r.data.periodEnd}`],
      ["Supervisor / Phone", `${r.data.supervisor} / ${r.data.phone}`],
      ["GPS", `${r.data.latitude || ""}, ${r.data.longitude || ""}`],
      ["Status", r.status],
    ],
  );
  const previous = reports.filter(
    (v) => v.id !== r.id && v.status === "Admin Approved",
  );
  const totals = aggregate(previous);
  section(
    "SECTION B · PROGRESS",
    ["Indicator", "Target", "Period result", "Cumulative", "Achieved"],
    targets.map((t) => {
      const current = Number(r.data.metrics?.[t.key] || 0);
      const total = ["youth", "cbo", "ppe"].includes(t.key)
        ? (Number(totals[t.key]) * previous.length + current) /
          (previous.length + 1)
        : Number(totals[t.key]) + current;
      return [
        t.label,
        `${t.target} ${t.unit}`,
        current,
        total.toFixed(1),
        `${((total / t.target) * 100).toFixed(1)}%`,
      ];
    }),
  );
  section(
    "ATTENDANCE",
    ["Category", "Male", "Female", "Total"],
    [
      "assigned",
      "present",
      "excused",
      "absent",
      "compliant",
      "nonCompliant",
    ].map((k) => [
      k,
      r.data.attendance?.[k + "Male"] || 0,
      r.data.attendance?.[k + "Female"] || 0,
      Number(r.data.attendance?.[k + "Male"] || 0) +
        Number(r.data.attendance?.[k + "Female"] || 0),
    ]),
  );
  section(
    "ATTENDANCE NOTES",
    ["Notes", ""],
    [[r.data.attendanceNotes || "—", ""]],
  );
  section(
    "SANITATION ACTIVITIES",
    ["Site / Type / GPS", "Activity / Date / Time", "Waste / mt", "Condition"],
    (r.data.sanitation || []).map((a) => [
      `${a.site || ""} / ${a.siteType || ""} / ${a.location || ""} / ${a.latitude || ""},${a.longitude || ""}`,
      `${a.activities || ""} / ${a.date || ""} / ${a.start || ""}–${a.end || ""}`,
      `${a.wasteType || ""} / ${a.weight || 0}`,
      `${a.before || ""} to ${a.after || ""}`,
    ]),
  );
  section(
    "AWARENESS ACTIVITIES",
    ["Site / Type", "Medium / Conducted", "People reached", "Rating 1–5"],
    (r.data.awareness || []).map((a) => [
      `${a.site || ""} / ${a.siteType || ""}`,
      `${a.medium || ""} / ${a.conducted || ""}`,
      a.reached || 0,
      a.rating || "",
    ]),
  );
  section(
    "AWARENESS TOTAL",
    ["Total people reached", ""],
    [
      [
        (r.data.awareness || []).reduce(
          (s: number, a: any) => s + Number(a.reached || 0),
          0,
        ),
        "",
      ],
    ],
  );
  section(
    "EQUIPMENT",
    ["Item", "Received", "Available", "Condition"],
    (r.data.equipment || []).map((e) => [
      e.name,
      e.received,
      e.available,
      e.condition,
    ]),
  );
  section(
    "CHALLENGES & ESCALATIONS",
    ["Challenge", "Escalation"],
    (r.data.challenges || []).map((c) => [c.challenge, c.escalation]),
  );
  section(
    "VERIFICATION & APPROVAL",
    ["Status", "Name / Position", "Signature", "Date / Comments"],
    (r.data.history || []).map((h) => [
      h.status,
      `${h.name} / ${h.position || ""}`,
      h.signature || "",
      `${h.date} ${h.comment || ""}`,
    ]),
  );
  section(
    "DOCUMENTATION",
    ["Item", "Details"],
    [
      ...Object.entries(r.data.checklist || {}).map(([k, v]) => [
        k,
        v ? "Yes" : "No",
      ]),
      ...(r.data.photos || []).map((p) => ["Photo", p.name]),
    ],
  );
  if (r.data.photos?.length) {
    doc.addPage();
    let py = 20;
    doc.setFontSize(14);
    doc.text("PHOTO DOCUMENTATION", 14, py);
    py += 10;
    for (const p of r.data.photos) {
      try {
        const response = await fetch(p.url, { credentials: "same-origin" });
        if (!response.ok) continue;
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = 800;
        canvas.height = Math.round((img.height / img.width) * 800);
        canvas
          .getContext("2d")!
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const height = Math.min(130, (170 * canvas.height) / canvas.width);
        if (py + height > 275) {
          doc.addPage();
          py = 20;
        }
        doc.setFontSize(9);
        doc.text(String(p.name).slice(0, 80), 14, py);
        doc.addImage(
          canvas.toDataURL("image/jpeg", 0.8),
          "JPEG",
          14,
          py + 5,
          170,
          height,
        );
        py += height + 17;
      } catch {}
    }
  }
  doc.save(`${r.number || "PCCI-draft"}.pdf`);
}
