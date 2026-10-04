/** One class definition or read, with its one-based source line. */
export type CssClass = { name: string; line: number };

/** Classes read from one stylesheet binding. Computed keys or rest bindings may read every class. */
export type Importer = { path: string; classes: CssClass[]; isDynamic: boolean };

/** One selected script read for lexical CSS module binding analysis. */
export type CssImporterSource = { path: string; text: string };
