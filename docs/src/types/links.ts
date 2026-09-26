// The types of the built-site link check.

/** One built page: its path, the anchors it defines, and the links it makes. */
export type PageLinks = { path: string; ids: Set<string>; links: string[] };
