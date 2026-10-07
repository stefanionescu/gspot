/** The keys and array indexes locating one value in a structured document. */
export type KeyPath = (string | number)[];

/** An explicitly authored field value written by the managed merge operation. */
export type KeyChange = { path: KeyPath; value: unknown };

/** A structured document that preserves comments and layout when reading and editing keys. */
export type ConfigurationDocument = {
    format: 'toml' | 'json';
    value(path: KeyPath): unknown;
    set(path: KeyPath, value: unknown): void;
    text(): string;
};
