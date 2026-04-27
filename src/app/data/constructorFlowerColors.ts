export type ConstructorFlowerColor = "red" | "pink" | "white" | "yellow" | "blue" | "green";

function normalizeKey(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const COLOR_OVERRIDES: Record<string, ConstructorFlowerColor> = {
  "аваланж белая": "white",
  "вайт барбодос": "white",
  "крем грация": "white",
  "ред наоми": "red",
  "эва ред": "red",
  "эль торо": "red",
  "баттеркап": "yellow",
  "пени лейн": "yellow",
  "пич аваланж": "yellow",
  "пич дименшн": "yellow",
  "леди бомбастик": "pink",
  "лавли лидия": "pink",
  "лавандер бабблс": "pink",
  "пинк аваланж": "pink",
  "пинк дименшн": "pink",
  "пинк флойд": "pink",
  "мисс пигги": "pink",
  "мисти бабблс": "pink",
  "джумилия": "pink",
  "барбодос": "pink",
  "аква": "pink",
  "грация": "pink",
  "испана": "pink",
  "кимберли": "pink",
  "кинг бабблс": "pink",
  "лидия": "pink",
  "лондон таймс": "pink",
  "марвелос бабблс": "pink",
  "маритим": "pink",
  "пакая": "pink",
  "пиони бабблс": "pink",
  "питер парк": "pink",
  "ридженс парк": "pink",
  "свит ревайвл": "pink",
  "скайвард": "pink",
  "скарлет дименшн": "red",
  "софи лорен": "pink",
  "спешл дименшн": "pink",
  "шангрила": "pink",
  "вау": "pink"
};

export function inferConstructorFlowerColor(name: string): ConstructorFlowerColor {
  const normalized = normalizeKey(name);
  const override = COLOR_OVERRIDES[normalized];
  if (override) return override;

  if (normalized.includes("бел") || normalized.includes("cream") || normalized.includes("ivory")) return "white";
  if (normalized.includes("ред") || normalized.includes("крас") || normalized.includes("scarlet") || normalized.includes("бордо")) return "red";
  if (normalized.includes("голуб") || normalized.includes("син") || normalized.includes("blue")) return "blue";
  if (normalized.includes("желт") || normalized.includes("gold") || normalized.includes("золот") || normalized.includes("пич")) return "yellow";
  if (normalized.includes("грин") || normalized.includes("эвк") || normalized.includes("green")) return "green";
  return "pink";
}

