export type FileSnapshot = { bytes: Buffer; mode: number; isLink?: true };

export type ConfinedRoot = {
    source(path: string): string;
    list(path?: string): string[];
    stat(path: string): import('node:fs').Stats | undefined;
    validate(path: string, value: FileSnapshot, proposed?: ReadonlyMap<string, FileSnapshot | undefined>): void;
    readEntry(path: string): FileSnapshot | undefined;
    read(path: string): FileSnapshot | undefined;
    write(path: string, value: FileSnapshot, expected: FileSnapshot | undefined): void;
    remove(path: string, expected: FileSnapshot): void;
    mkdir(path: string, mode: number): void;
    rmdir(path: string): void;
    lock(path: string): void;
    close(): void;
};
