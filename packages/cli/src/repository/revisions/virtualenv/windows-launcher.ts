import { win32 } from 'node:path';
import { SelectionError } from '#cli/configurations/select.ts';
import type { WindowsImage, WindowsResource } from '#cli/types/repository/revisions.ts';

import {
    HOST_KIND,
    WORD_SIZE,
    PE32_MAGIC,
    SHORT_SIZE,
    OFFSET_MASK,
    RCDATA_TYPE,
    SECTION_SIZE,
    CHECKSUM_FIELD,
    DIRECTORY_FLAG,
    DOS_HEADER_SIZE,
    PE32_PLUS_MAGIC,
    PE_OFFSET_FIELD,
    COFF_HEADER_SIZE,
    PE_SIGNATURE_SIZE,
    RESOURCE_DIRECTORY,
    SIZE_OF_CODE_FIELD,
    RESOURCE_ENTRY_SIZE,
    SECTION_COUNT_FIELD,
    SIZE_OF_IMAGE_FIELD,
    DIRECTORY_ENTRY_SIZE,
    FILE_ALIGNMENT_FIELD,
    CERTIFICATE_DIRECTORY,
    SIZE_OF_HEADERS_FIELD,
    SECTION_RAW_SIZE_FIELD,
    PE32_DIRECTORIES_OFFSET,
    RESOURCE_ID_COUNT_FIELD,
    SECTION_ALIGNMENT_FIELD,
    SECTION_RAW_POINTER_FIELD,
    OPTIONAL_HEADER_SIZE_FIELD,
    RESOURCE_NAMED_COUNT_FIELD,
    RESOURCE_TABLE_HEADER_SIZE,
    SECTION_VIRTUAL_SIZE_FIELD,
    RESOURCE_ENTRY_TARGET_FIELD,
    RESOURCE_PAYLOAD_SIZE_FIELD,
    PE32_PLUS_DIRECTORIES_OFFSET,
    READABLE_INITIALIZED_SECTION,
    SECTION_CHARACTERISTICS_FIELD,
    SECTION_VIRTUAL_ADDRESS_FIELD,
} from '#cli/constants/repository/windows-launcher.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: A throw cannot sit in an expression, and eleven parser branches return this one.
function fail(): never {
    throw new SelectionError([
        'Cannot relocate installed Windows Python launcher metadata. Reinstall dependencies for the selected revision.',
    ]);
}

function readImage(bytes: Buffer): WindowsImage | undefined {
    if (bytes.length < DOS_HEADER_SIZE || bytes.toString('ascii', 0, 'MZ'.length) !== 'MZ') return undefined;
    const pe = bytes.readUInt32LE(PE_OFFSET_FIELD);
    const coff = pe + PE_SIGNATURE_SIZE;
    const optional = coff + COFF_HEADER_SIZE;
    if (optional > bytes.length || bytes.toString('ascii', pe, coff) !== 'PE\0\0') return undefined;
    const range = (offset: number, length: number): number => {
        if (offset < 0 || length < 0 || offset + length > bytes.length) fail();
        return offset;
    };
    const count = bytes.readUInt16LE(range(coff + SECTION_COUNT_FIELD, SHORT_SIZE));
    const magic = bytes.readUInt16LE(range(optional, SHORT_SIZE));
    if (magic !== PE32_MAGIC && magic !== PE32_PLUS_MAGIC) return undefined;
    const directories = optional + (magic === PE32_PLUS_MAGIC ? PE32_PLUS_DIRECTORIES_OFFSET : PE32_DIRECTORIES_OFFSET);
    const sectionTable = optional + bytes.readUInt16LE(range(coff + OPTIONAL_HEADER_SIZE_FIELD, SHORT_SIZE));
    range(sectionTable, count * SECTION_SIZE);
    const sections = Array.from({ length: count }, (_, index) => sectionTable + index * SECTION_SIZE);
    const location = (rva: number, size: number): number => {
        for (const section of sections) {
            const address = bytes.readUInt32LE(range(section + SECTION_VIRTUAL_ADDRESS_FIELD, WORD_SIZE));
            const rawSize = bytes.readUInt32LE(range(section + SECTION_RAW_SIZE_FIELD, WORD_SIZE));
            if (rva >= address && rva + size <= address + rawSize)
                return range(
                    bytes.readUInt32LE(range(section + SECTION_RAW_POINTER_FIELD, WORD_SIZE)) + rva - address,
                    size,
                );
        }
        return fail();
    };
    return {
        bytes,
        coff,
        optional,
        directories,
        sectionTable,
        count,
        sections,
        short: (offset: number): number => bytes.readUInt16LE(range(offset, SHORT_SIZE)),
        word: (offset: number): number => bytes.readUInt32LE(range(offset, WORD_SIZE)),
        range,
        location,
    };
}

function readResources(image: WindowsImage): { isHost: boolean; path: WindowsResource } | undefined {
    const { bytes, directories, short, word, range, location } = image;
    const resourceRva = word(directories + RESOURCE_DIRECTORY * DIRECTORY_ENTRY_SIZE);
    if (resourceRva === 0) return undefined;
    const resources = location(resourceRva, RESOURCE_TABLE_HEADER_SIZE);
    const entries = (offset: number): { name: string | number; target: number; directory: boolean }[] => {
        const table = resources + offset;
        const length = short(table + RESOURCE_NAMED_COUNT_FIELD) + short(table + RESOURCE_ID_COUNT_FIELD);
        range(table + RESOURCE_TABLE_HEADER_SIZE, length * RESOURCE_ENTRY_SIZE);
        return Array.from({ length }, (_, index) => {
            const entry = table + RESOURCE_TABLE_HEADER_SIZE + index * RESOURCE_ENTRY_SIZE;
            const key = word(entry);
            const target = word(entry + RESOURCE_ENTRY_TARGET_FIELD);
            let name: string | number = key;
            if ((key & DIRECTORY_FLAG) !== 0) {
                const start = resources + (key & OFFSET_MASK);
                const size = short(start) * SHORT_SIZE;
                range(start + SHORT_SIZE, size);
                name = bytes.toString('utf16le', start + SHORT_SIZE, start + SHORT_SIZE + size);
            }
            return { name, target: target & OFFSET_MASK, directory: (target & DIRECTORY_FLAG) !== 0 };
        });
    };
    const resourceBranch = entries(0).find((entry) => entry.name === RCDATA_TYPE && entry.directory);
    if (resourceBranch === undefined) return undefined;
    const named = entries(resourceBranch.target);
    const resource = (name: string): WindowsResource | undefined => {
        const entry = named.find((entry) => entry.name === name && entry.directory);
        if (entry === undefined) return undefined;
        const languages = entries(entry.target);
        if (languages.length !== 1 || languages[0]?.directory !== false) return fail();
        const descriptor = resources + languages[0].target;
        const size = word(descriptor + RESOURCE_PAYLOAD_SIZE_FIELD);
        return { descriptor, offset: location(word(descriptor), size), size };
    };
    const kind = resource('UV_TRAMPOLINE_KIND');
    if (kind === undefined) return undefined;
    if (kind.size !== 1) return fail();
    const isHost = bytes[kind.offset] === HOST_KIND;
    if (!isHost && bytes[kind.offset] !== 1) return fail();
    const path = resource('UV_PYTHON_PATH');
    if (path === undefined) return fail();
    return { isHost, path };
}

function appendPath(image: WindowsImage, path: WindowsResource, destination: string): Buffer {
    const { bytes, optional, directories, sectionTable, count, sections, word, coff } = image;
    const value = Buffer.from(destination);
    const fileAlignment = word(optional + FILE_ALIGNMENT_FIELD);
    const sectionAlignment = word(optional + SECTION_ALIGNMENT_FIELD);
    if (
        fileAlignment === 0 ||
        sectionAlignment === 0 ||
        word(directories + CERTIFICATE_DIRECTORY * DIRECTORY_ENTRY_SIZE) !== 0
    )
        return fail();
    const header = sectionTable + count * SECTION_SIZE;
    const firstRaw = Math.min(
        ...sections.map((section) => word(section + SECTION_RAW_POINTER_FIELD)).filter((offset) => offset !== 0),
    );
    if (header + SECTION_SIZE > firstRaw || header + SECTION_SIZE > word(optional + SIZE_OF_HEADERS_FIELD))
        return fail();
    const address =
        Math.ceil(
            Math.max(
                ...sections.map(
                    (section) =>
                        word(section + SECTION_VIRTUAL_ADDRESS_FIELD) +
                        Math.max(word(section + SECTION_VIRTUAL_SIZE_FIELD), word(section + SECTION_RAW_SIZE_FIELD)),
                ),
            ) / sectionAlignment,
        ) * sectionAlignment;
    const rawOffset = Math.ceil(bytes.length / fileAlignment) * fileAlignment;
    const rawSize = Math.ceil(value.length / fileAlignment) * fileAlignment;
    const result = Buffer.alloc(rawOffset + rawSize);
    bytes.copy(result);
    value.copy(result, rawOffset);
    result.fill(0, header, header + SECTION_SIZE);
    result.write('.gspath', header, 'ascii');
    result.writeUInt32LE(value.length, header + SECTION_VIRTUAL_SIZE_FIELD);
    result.writeUInt32LE(address, header + SECTION_VIRTUAL_ADDRESS_FIELD);
    result.writeUInt32LE(rawSize, header + SECTION_RAW_SIZE_FIELD);
    result.writeUInt32LE(rawOffset, header + SECTION_RAW_POINTER_FIELD);
    result.writeUInt32LE(READABLE_INITIALIZED_SECTION, header + SECTION_CHARACTERISTICS_FIELD);
    result.writeUInt16LE(count + 1, coff + SECTION_COUNT_FIELD);
    result.writeUInt32LE(word(optional + SIZE_OF_CODE_FIELD) + rawSize, optional + SIZE_OF_CODE_FIELD);
    result.writeUInt32LE(
        Math.ceil((address + value.length) / sectionAlignment) * sectionAlignment,
        optional + SIZE_OF_IMAGE_FIELD,
    );
    result.writeUInt32LE(0, optional + CHECKSUM_FIELD);
    result.writeUInt32LE(address, path.descriptor);
    result.writeUInt32LE(value.length, path.descriptor + RESOURCE_PAYLOAD_SIZE_FIELD);
    return result;
}

/**
 * Relocate uv interpreter metadata without changing its native code or embedded Python Zip archive.
 * @param bytes the launcher executable.
 * @param interpreters the interpreter path each installed path moves to.
 * @param hosts the installed directories the launcher may point into.
 * @returns the relocated launcher, or undefined when the bytes are not a Windows executable.
 */
export function relocateWindowsLauncher(
    bytes: Buffer,
    interpreters: ReadonlyMap<string, string>,
    hosts: ReadonlySet<string>,
): Buffer | undefined {
    const image = readImage(bytes);
    if (image === undefined) return undefined;
    const metadata = readResources(image);
    if (metadata === undefined) return undefined;
    const { isHost, path } = metadata;
    const source = win32.normalize(bytes.toString('utf8', path.offset, path.offset + path.size)).toLowerCase();
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: Both lookups compare a resolved candidate the same way; the closure carries the source path.
    const matches = (candidate: string, directory: string): boolean => {
        const resolved = win32.isAbsolute(source) ? source : win32.join(directory, source);
        return win32.normalize(candidate).toLowerCase() === resolved.toLowerCase();
    };
    const destination = isHost
        ? [...hosts].find((host) =>
              [...interpreters.keys()].some((candidate) => matches(host, win32.dirname(candidate))),
          )
        : [...interpreters].find(([candidate]) => matches(candidate, win32.dirname(candidate)))?.[1];
    if (destination === undefined) return fail();
    if (isHost && source === win32.normalize(destination).toLowerCase()) return undefined;
    return appendPath(image, path, destination);
}
