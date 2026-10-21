/** The keys and array indexes locating one value in a structured document. */
export type KeyPath = readonly (string | number)[];

/** A structured document that preserves comments and layout when reading and editing keys. */
export type EditableFile = {
    getValue(keys: KeyPath): unknown;
    set(keys: KeyPath, value: unknown): void;
    getText(): string;
};
