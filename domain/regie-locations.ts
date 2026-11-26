/** Orte, Etappe 4b: the places of a scene for the Regie. Pure mapping; the server reads the rows. */
export type SceneLocationRow = {
  entity_id: string;
  location_id: string;
  level: string;
  revision: number;
  world_state: string;
  attributes: string;
  title: string;
};

export type SceneLocation = {
  id: string;
  locationId: string;
  level: string;
  title: string;
  revision: number;
  worldState: string;
  main: boolean;
};

const object = (raw: string): Record<string, unknown> => {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

/** Keeps the scene's order, skips unknown and archived or deleted places, and prefers the visible title. */
export function sceneLocationsFrom(rows: SceneLocationRow[], ids: string[], mainIds: Set<string>): SceneLocation[] {
  return ids.flatMap(id => {
    const row = rows.find(item => item.entity_id === id);
    if (!row) return [];
    const data = object(row.attributes);
    if (data.lifecycle === "archived" || data.lifecycle === "deleted") return [];
    const title = typeof data.title === "string" && data.title ? data.title : row.title;
    return [{ id, locationId: row.location_id, level: row.level, title, revision: row.revision, worldState: row.world_state, main: mainIds.has(id) }];
  });
}
