// Applies temporary file changes and restores their original contents and modes.
import { join } from 'node:path';
import { crc32 } from 'node:zlib';
import { ZIP_LAYOUT } from '#tests/data/test-setup.ts';
import type { ZipEntry } from '#tests/types/samples.ts';
import { open, lstat, access, readdir, readlink } from 'node:fs/promises';

/**
 * Captures repository paths, file contents, and modes for write-preservation tests.
 * @param repositoryRoot the repository directory.
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
 * @param path the file or directory.
 * @returns false when filesystem access fails, matching the filesystem existence contract.
 */
export function isOnDisk(path: string): Promise<boolean> {
    return access(path).then(
        () => true,
        () => false,
    );
}

/**
 * Encode test package entries as a stored archive with their Unix file modes.
 * @param entries the entry names, bytes, and optional file modes.
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
