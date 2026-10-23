export type KeyPath = readonly (string | number)[];

export type EditableFile = {
    getValue(keys: KeyPath): unknown;
    set(keys: KeyPath, value: unknown): void;
    getText(): string;
};
