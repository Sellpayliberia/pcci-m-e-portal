export const targets = [
  {
    key: "spaces",
    label: "Public spaces cleaned",
    target: 120,
    unit: "spaces",
    icon: "spaces",
  },
  {
    key: "waste",
    label: "Waste removed",
    target: 2500,
    unit: "metric tons",
    icon: "waste",
  },
  {
    key: "drains",
    label: "Drainages cleared",
    target: 100,
    unit: "drainages",
    icon: "drains",
  },
  {
    key: "youth",
    label: "Youth participation",
    target: 95,
    unit: "%",
    icon: "youth",
  },
  { key: "cbo", label: "CBO participation", target: 95, unit: "%" },
  { key: "reach", label: "Citizens reached", target: 500000, unit: "people" },
  {
    key: "volunteers",
    label: "Volunteers engaged",
    target: 300,
    unit: "people",
  },
  { key: "ppe", label: "PPE compliance", target: 95, unit: "%" },
];
export const demoLocations = [
  [
    "Montserrado",
    "Monrovia",
    "Greater Monrovia",
    "West Point",
    "West Point Market",
    6.328,
    -10.806,
  ],
  [
    "Montserrado",
    "Paynesville",
    "Paynesville District",
    "Red Light",
    "Red Light Market",
    6.288,
    -10.707,
  ],
  [
    "Margibi",
    "Kakata",
    "Kakata District",
    "Kakata Central",
    "Kakata Market",
    6.529,
    -10.354,
  ],
  [
    "Grand Bassa",
    "Buchanan",
    "Buchanan District",
    "Bassa Community",
    "Buchanan Market",
    5.881,
    -10.043,
  ],
]
  .flatMap(
    ([county, city, district, community, market, latitude, longitude]) => {
      let parentId: any = null;
      return ["County", "City", "District", "Community", "Market"].map(
        (type, i) => {
          const name = [county, city, district, community, market][i];
          const id = `${type}-${name}`.toLowerCase().replaceAll(" ", "-");
          const r = {
            id,
            name,
            type,
            parentId,
            county,
            city: type === "County" ? null : city,
            latitude,
            longitude,
          };
          parentId = id;
          return r;
        },
      );
    },
  )
  .filter((r, i, a) => a.findIndex((v) => v.id === r.id) === i);
export const demoReports = Array.from({ length: 24 }, (_, i) => {
  const l = demoLocations.filter((l) => l.type === "Market")[i % 4];
  const statuses = [
    "Admin Approved",
    "Submitted",
    "City Verified",
    "Draft",
    "Returned",
    "Admin Approved",
  ];
  const periodEnd = new Date(Date.UTC(2026, 10, 15 - Math.floor(i / 4) * 7));
  const periodStart = new Date(periodEnd);
  periodStart.setUTCDate(periodStart.getUTCDate() - (i % 3 ? 6 : 0));
  return {
    id: `sample-${i}`,
    number: `PCCI-2026-${String(148 - i).padStart(4, "0")}`,
    ownerId: "demo",
    team: [
      "Monrovia Clean Team A",
      "Paynesville Youth Brigade",
      "Kakata Green Team",
      "Buchanan Coastal Team",
    ][i % 4],
    county: l.county,
    city: l.city,
    district: demoLocations.find(
      (p) => p.id === demoLocations.find((p) => p.id === l.parentId)?.parentId,
    )?.name,
    community: demoLocations.find((p) => p.id === l.parentId)?.name,
    status: statuses[i % 6],
    version: 1,
    createdAt: periodEnd.toISOString(),
    updatedAt: periodEnd.toISOString(),
    data: {
      type: i % 3 ? "Weekly" : "Daily",
      supervisor: [
        "Josephine Kollie",
        "Emmanuel Tamba",
        "Martha K. Doe",
        "Samuel G. Wesseh",
      ][i % 4],
      phone: "+231 77 000 0000",
      periodStart: periodStart.toISOString().slice(0, 10),
      periodEnd: periodEnd.toISOString().slice(0, 10),
      latitude: Number(l.latitude) + (i % 3) * 0.008,
      longitude: Number(l.longitude) + (i % 3) * 0.012,
      metrics: {
        spaces: 3 + (i % 3),
        waste: 55 + i * 2.1,
        drains: 2 + (i % 3),
        youth: 88 + (i % 10),
        cbo: 91 + (i % 8),
        reach: 8500 + i * 444,
        volunteers: 8 + (i % 7),
        ppe: 89 + (i % 10),
      },
      attendance: {
        assignedMale: 25,
        assignedFemale: 19,
        presentMale: 22 - (i % 3),
        presentFemale: 17,
        compliantMale: 21,
        compliantFemale: 16,
      },
      sanitation: [
        {
          site: l.name,
          siteType: "Market",
          activities: "Sweeping, Clear Drains",
          wasteType: i % 2 ? "Municipal" : "Household",
          weight: 55 + i * 2.1,
          before: "Poor",
          after: i % 3 ? "Good" : "Fair",
          date: periodEnd.toISOString().slice(0, 10),
          latitude: l.latitude,
          longitude: l.longitude,
        },
      ],
      awareness: [
        {
          site: l.name,
          siteType: "Market",
          medium: "In-person",
          conducted: "Yes",
          reached: 8500 + i * 444,
          rating: 3 + (i % 3),
        },
      ],
      history: [],
    },
  };
});
export const roles = [
  "Super Admin",
  "Admin/M&E Officer",
  "City Verifier",
  "Team Supervisor",
  "Viewer",
];
export const emptyReport = () => ({
  id: crypto.randomUUID(),
  team: "",
  county: "",
  city: "",
  district: "",
  community: "",
  status: "Draft",
  version: undefined,
  data: {
    type: "Weekly",
    supervisor: "",
    phone: "",
    periodStart: "",
    periodEnd: "",
    market: "",
    zone: "",
    metrics: Object.fromEntries(targets.map((t) => [t.key, 0])),
    attendance: {},
    sanitation: [],
    awareness: [],
    equipment: [
      "Shovels",
      "Rakes",
      "Brooms",
      "Wheelbarrows",
      "Cutlasses",
      "Hoes",
      "Tricycles",
    ].map((name) => ({ name, received: 0, available: 0, condition: "Good" })),
    challenges: [],
    photos: [],
    checklist: {},
    history: [],
  },
});
export function aggregate(reports: any[]) {
  const approved = reports.filter((r) => r.status === "Admin Approved");
  return Object.fromEntries(
    targets.map((t) => {
      const a = approved.map((r) => Number(r.data.metrics?.[t.key] || 0));
      return [
        t.key,
        ["youth", "cbo", "ppe"].includes(t.key)
          ? a.reduce((s, v) => s + v, 0) / (a.length || 1)
          : a.reduce((s, v) => s + v, 0),
      ];
    }),
  );
}
export const fmt = (n: number) =>
  Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n || 0);
