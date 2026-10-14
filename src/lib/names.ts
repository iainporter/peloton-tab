export type NamedPerson = { id: string; name: string };

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

/**
 * Short display names for a set of people (e.g. a group's members): first
 * names, except where two people share a first name, who get full names.
 * Returns a map from id to display name.
 */
export function shortNames(people: NamedPerson[]): Map<string, string> {
  const unique = new Map(people.map((p) => [p.id, p.name]));

  const counts = new Map<string, number>();
  for (const name of unique.values()) {
    const key = firstName(name).toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const result = new Map<string, string>();
  for (const [id, name] of unique) {
    const first = firstName(name);
    result.set(id, (counts.get(first.toLowerCase()) ?? 0) > 1 ? name.trim() : first);
  }
  return result;
}
