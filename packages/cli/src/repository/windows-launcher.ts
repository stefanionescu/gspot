import { win32 } from 'node:path';
import { SelectionError } from '#cli/configurations/select.ts';

import {
    CERTIFICATE_DIRECTORY,
    CHECKSUM_FIELD,
    COFF_HEADER_SIZE,
    DIRECTORY_ENTRY_SIZE,
    DIRECTORY_FLAG,
    DOS_HEADER_SIZE,
    FILE_ALIGNMENT_FIELD,
    OFFSET_MASK,
    OPTIONAL_HEADER_SIZE_FIELD,
    PE32_DATA_DIRECTORIES,
    PE32_MAGIC,
    PE32_PLUS_DATA_DIRECTORIES,
    PE32_PLUS_MAGIC,
    PE_OFFSET_FIELD,
    PE_SIGNATURE_SIZE,
    RCDATA_TYPE,
    READABLE_INITIALIZED_DATA,
    RESOURCE_DATA_SIZE_FIELD,
    RESOURCE_DIRECTORY,
    RESOURCE_ENTRY_SIZE,
    RESOURCE_ENTRY_TARGET_FIELD,
    RESOURCE_ID_COUNT_FIELD,
    RESOURCE_NAMED_COUNT_FIELD,
    RESOURCE_TABLE_HEADER_SIZE,
    SECTION_ALIGNMENT_FIELD,
    SECTION_CHARACTERISTICS_FIELD,
    SECTION_COUNT_FIELD,
    SECTION_RAW_POINTER_FIELD,
    SECTION_RAW_SIZE_FIELD,
    SECTION_SIZE,
    SECTION_VIRTUAL_ADDRESS_FIELD,
    SECTION_VIRTUAL_SIZE_FIELD,
    SIZE_OF_CODE_FIELD,
    SIZE_OF_HEADERS_FIELD,
    SIZE_OF_IMAGE_FIELD,
    WORD_SIZE,
} from '#cli/constants/repository/repository.ts';

function fail(): never {
    throw new SelectionError([
        'Cannot relocate installed Windows Python launcher metadata. Reinstall dependencies for the selected revision.',
    ]);
}

/**
 * Relocate uv interpreter metadata without changing its native code or embedded Python ZIP.
 * @param bytes the launcher executable
 * @param interpreters the interpreter path each installed path moves to
 * @param hosts the installed directories the launcher may point into
 * @returns the relocated launcher, or undefined when the bytes are not a Windows executable
 */
export function relocateWindowsLauncher(
    bytes: Buffer,
    interpreters: ReadonlyMap<string, string>,
    hosts: ReadonlySet<string>,
): Buffer | undefined {
    if (bytes.length < DOS_HEADER_SIZE || bytes.toString('ascii', 0, 2) !== 'MZ') return undefined;
    const pe = bytes.readUInt32LE(PE_OFFSET_FIELD);
    const coff = pe + PE_SIGNATURE_SIZE;
    const optional = coff + COFF_HEADER_SIZE;
    if (optional > bytes.length || bytes.toString('ascii', pe, coff) !== 'PE\0\0') return undefined;
    const range = (offset: number, length: number): number => {
        if (offset < 0 || length < 0 || offset + length > bytes.length) fail();
        return offset;
    };
    const short = (offset: number): number => bytes.readUInt16LE(range(offset, 2));
    const word = (offset: number): number => bytes.readUInt32LE(range(offset, WORD_SIZE));
    const count = short(coff + SECTION_COUNT_FIELD);
    const magic = short(optional);
    if (magic !== PE32_MAGIC && magic !== PE32_PLUS_MAGIC) return undefined;
    const directories = optional + (magic === PE32_PLUS_MAGIC ? PE32_PLUS_DATA_DIRECTORIES : PE32_DATA_DIRECTORIES);
    const sectionTable = optional + short(coff + OPTIONAL_HEADER_SIZE_FIELD);
    range(sectionTable, count * SECTION_SIZE);
    const sections = Array.from({ length: count }, (_, index) => sectionTable + index * SECTION_SIZE);
    const location = (rva: number, size: number): number => {
        for (const section of sections) {
            const address = word(section + SECTION_VIRTUAL_ADDRESS_FIELD);
            const rawSize = word(section + SECTION_RAW_SIZE_FIELD);
            if (rva >= address && rva + size <= address + rawSize)
                return range(word(section + SECTION_RAW_POINTER_FIELD) + rva - address, size);
        }
        return fail();
    };
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
                const size = short(start) * 2;
                range(start + 2, size);
                name = bytes.toString('utf16le', start + 2, start + 2 + size);
            }
            return { name, target: target & OFFSET_MASK, directory: (target & DIRECTORY_FLAG) !== 0 };
        });
    };
    const data = entries(0).find((entry) => entry.name === RCDATA_TYPE && entry.directory);
    if (data === undefined) return undefined;
    const named = entries(data.target);
    const resource = (name: string): { descriptor: number; offset: number; size: number } | undefined => {
        const entry = named.find((entry) => entry.name === name && entry.directory);
        if (entry === undefined) return undefined;
        const languages = entries(entry.target);
        if (languages.length !== 1 || languages[0]?.directory !== false) return fail();
        const descriptor = resources + languages[0].target;
        const size = word(descriptor + RESOURCE_DATA_SIZE_FIELD);
        return { descriptor, offset: location(word(descriptor), size), size };
    };
    const kind = resource('UV_TRAMPOLINE_KIND');
    if (kind === undefined) return undefined;
    if (kind.size !== 1) return fail();
    const isHost = bytes[kind.offset] === 2;
    if (!isHost && bytes[kind.offset] !== 1) return fail();
    const path = resource('UV_PYTHON_PATH');
    if (path === undefined) return fail();
    const source = win32.normalize(bytes.toString('utf8', path.offset, path.offset + path.size)).toLowerCase();
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
    const value = Buffer.from(destination);
    const fileAlignment = word(optional + FILE_ALIGNMENT_FIELD);
    const sectionAlignment = word(optional + SECTION_ALIGNMENT_FIELD);
    if (
        fileAlignment === 0 ||
        sectionAlignment === 0 ||
        word(directories + CERTIFICATE_DIRECTORY * DIRECTORY_ENTRY_SIZE) !== 0
    )
        return fail();
    const align = (value: number, alignment: number): number => Math.ceil(value / alignment) * alignment;
    const header = sectionTable + count * SECTION_SIZE;
    const firstRaw = Math.min(
        ...sections.map((section) => word(section + SECTION_RAW_POINTER_FIELD)).filter((offset) => offset !== 0),
    );
    if (header + SECTION_SIZE > firstRaw || header + SECTION_SIZE > word(optional + SIZE_OF_HEADERS_FIELD))
        return fail();
    const address = align(
        Math.max(
            ...sections.map(
                (section) =>
                    word(section + SECTION_VIRTUAL_ADDRESS_FIELD) +
                    Math.max(word(section + SECTION_VIRTUAL_SIZE_FIELD), word(section + SECTION_RAW_SIZE_FIELD)),
            ),
        ),
        sectionAlignment,
    );
    const rawOffset = align(bytes.length, fileAlignment);
    const rawSize = align(value.length, fileAlignment);
    const result = Buffer.alloc(rawOffset + rawSize);
    bytes.copy(result);
    value.copy(result, rawOffset);
    result.fill(0, header, header + SECTION_SIZE);
    result.write('.gspath', header, 'ascii');
    result.writeUInt32LE(value.length, header + SECTION_VIRTUAL_SIZE_FIELD);
    result.writeUInt32LE(address, header + SECTION_VIRTUAL_ADDRESS_FIELD);
    result.writeUInt32LE(rawSize, header + SECTION_RAW_SIZE_FIELD);
    result.writeUInt32LE(rawOffset, header + SECTION_RAW_POINTER_FIELD);
    result.writeUInt32LE(READABLE_INITIALIZED_DATA, header + SECTION_CHARACTERISTICS_FIELD);
    result.writeUInt16LE(count + 1, coff + SECTION_COUNT_FIELD);
    result.writeUInt32LE(word(optional + SIZE_OF_CODE_FIELD) + rawSize, optional + SIZE_OF_CODE_FIELD);
    result.writeUInt32LE(align(address + value.length, sectionAlignment), optional + SIZE_OF_IMAGE_FIELD);
    result.writeUInt32LE(0, optional + CHECKSUM_FIELD);
    result.writeUInt32LE(address, path.descriptor);
    result.writeUInt32LE(value.length, path.descriptor + RESOURCE_DATA_SIZE_FIELD);
    return result;
}
