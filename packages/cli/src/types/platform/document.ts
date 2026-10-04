/** The keys and array indexes locating one value in a structured document. */
export type KeyPath = (string | number)[];

/** An explicitly authored field value written by the managed merge operation. */
export type KeyChange = { path: KeyPath; value: unknown };
