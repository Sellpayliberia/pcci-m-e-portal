export const locationSeed = [
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
];
export function seedLocations() {
  const rows = [];
  for (const [
    county,
    city,
    district,
    community,
    market,
    lat,
    lng,
  ] of locationSeed) {
    let parentId = null;
    for (const [type, name] of [
      ["County", county],
      ["City", city],
      ["District", district],
      ["Community", community],
      ["Market", market],
    ]) {
      const id = `${type}-${name}`.toLowerCase().replaceAll(" ", "-");
      if (!rows.some((r) => r.id === id))
        rows.push({
          id,
          name,
          type,
          parentId,
          county,
          city: type === "County" ? null : city,
          latitude: lat,
          longitude: lng,
        });
      parentId = id;
    }
  }
  return rows;
}
