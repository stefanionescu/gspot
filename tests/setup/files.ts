// Reads file trees, checks paths, and builds zip archives for tests.
import { join } from 'node:path';
import { crc32 } from 'node:zlib';
import { ZIP_LAYOUT } from '#tests/data/test-setup.ts';
import type { ZipEntry } from '#tests/types/samples.ts';
import { open, lstat, access, readdir, readlink } from 'node:fs/promises';

/**
 * Reads every path in a repository with its mode and contents, to check that a write kept them.
 *
 * @param repositoryRoot folder to read.
 * @returns each path and its mode and contents.
 */
export async function readTree(repositoryRoot: string): Promise<Record<string, string>> {
    const entries = await readdir(repositoryRoot, { recursive: true });
    return Object.fromEntries(
        await Promise.all(
            entries.map(async (path) => {
                const full = join(repositoryRoot, path);
                const attributes = await lstat(full);
                let bytes = 'directory';
                if (attributes.isSymbolicLink()) bytes = `symlink:${await readlink(full)}`;
                else if (attributes.isFile()) {
                    await using file = await open(full, 'r');
                    const content = await file.readFile();
                    const fileAttributes = await file.stat();
                    return [path, `${String(fileAttributes.mode)}:file:${content.toString('base64')}`] as const;
                }
                return [path, `${String(attributes.mode)}:${bytes}`] as const;
            }),
        ),
    );
}

/**
 * Checks whether a filesystem path exists, following symbolic links.
 *
 * @param path the file or folder.
 * @returns whether the path exists; false when access fails.
 */
export function isOnDisk(path: string): Promise<boolean> {
    return access(path).then(
        () => true,
        () => false,
    );
}

/**
 * Write files into an uncompressed zip archive with their Unix file modes.
 *
 * @param entries files to store.
 * @returns the archive bytes.
 */
export function encodeZipArchive(entries: readonly ZipEntry[]): Buffer<ArrayBuffer> {
    const local: Buffer[] = [];
    const folder: Buffer[] = [];
    let offset = 0;
    for (const [name, data, mode] of entries) {
        const filename = Buffer.from(name);
        const header = Buffer.alloc(ZIP_LAYOUT.local.size);
        header.writeUInt32LE(ZIP_LAYOUT.local.signature);
        header.writeUInt16LE(ZIP_LAYOUT.local.version, ZIP_LAYOUT.local.versionOffset);
        header.writeUInt32LE(crc32(data), ZIP_LAYOUT.local.crcOffset);
        header.writeUInt32LE(data.length, ZIP_LAYOUT.local.compressedSizeOffset);
        header.writeUInt32LE(data.length, ZIP_LAYOUT.local.sizeOffset);
        header.writeUInt16LE(filename.length, ZIP_LAYOUT.local.nameLengthOffset);
        local.push(header, filename, data);
        const central = Buffer.alloc(ZIP_LAYOUT.central.size);
        central.writeUInt32LE(ZIP_LAYOUT.central.signature);
        central.writeUInt16LE(ZIP_LAYOUT.central.version, ZIP_LAYOUT.central.versionOffset);
        header.copy(
            central,
            ZIP_LAYOUT.central.localCopyOffset,
            ZIP_LAYOUT.central.localStart,
            ZIP_LAYOUT.central.localEnd,
        );
        central.writeUInt32LE(
            ((mode ?? ZIP_LAYOUT.unix.regular) << ZIP_LAYOUT.unix.modeShift) >>> 0,
            ZIP_LAYOUT.central.modeOffset,
        );
        central.writeUInt32LE(offset, ZIP_LAYOUT.central.localOffset);
        folder.push(central, filename);
        offset += header.length + filename.length + data.length;
    }
    const end = Buffer.alloc(ZIP_LAYOUT.end.size);
    end.writeUInt32LE(ZIP_LAYOUT.end.signature);
    end.writeUInt16LE(entries.length, ZIP_LAYOUT.end.diskCountOffset);
    end.writeUInt16LE(entries.length, ZIP_LAYOUT.end.countOffset);
    end.writeUInt32LE(
        folder.reduce((size, part) => size + part.length, 0),
        ZIP_LAYOUT.end.sizeOffset,
    );
    end.writeUInt32LE(offset, ZIP_LAYOUT.end.directoryOffset);
    return Buffer.concat([...local, ...folder, end]);
}
