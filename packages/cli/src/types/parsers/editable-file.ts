/** The keys and array indexes locating one value in a structured document. */
export type KeyPath = readonly (string | number)[];

/** A structured document that preserves comments and layout when reading and editing keys. */
export type EditableFile = {
    getValue(path: KeyPath): unknown;
    set(path: KeyPath, value: unknown): void;
    getText(): string;
};
