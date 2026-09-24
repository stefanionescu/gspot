import { win32 } from 'node:path';
import { SelectionError } from '#cli/configurations/select.ts';

const DIRECTORY_FLAG = 0x80000000;
const OFFSET_MASK = 0x7fffffff;
const SECTION_SIZE = 40;

/** Relocate uv interpreter metadata without changing its native code or embedded Python ZIP. */
export function relocateWindowsLauncher(
    bytes: Buffer,
    interpreters: ReadonlyMap<string, string>,
    hosts: ReadonlySet<string>,
): Buffer | undefined {
    if (bytes.length < 64 || bytes.toString('ascii', 0, 2) !== 'MZ') return undefined;
    const pe = bytes.readUInt32LE(60);
    if (pe + 24 > bytes.length || bytes.toString('ascii', pe, pe + 4) !== 'PE\0\0') return undefined;
    const fail = (): never => {
        throw new SelectionError([
            'Cannot relocate installed Windows Python launcher metadata. Reinstall dependencies for the selected revision.',
        ]);
    };
    const range = (offset: number, length: number): number => {
        if (offset < 0 || length < 0 || offset + length > bytes.length) fail();
        return offset;
    };
    const short = (offset: number): number => bytes.readUInt16LE(range(offset, 2));
    const word = (offset: number): number => bytes.readUInt32LE(range(offset, 4));
    const count = short(pe + 6);
    const optional = pe + 24;
    const magic = short(optional);
    if (magic !== 0x10b && magic !== 0x20b) return undefined;
    const directories = optional + (magic === 0x20b ? 112 : 96);
    const sectionTable = optional + short(pe + 20);
    range(sectionTable, count * SECTION_SIZE);
    const sections = Array.from({ length: count }, (_, index) => sectionTable + index * SECTION_SIZE);
    const location = (rva: number, size: number): number => {
        for (const section of sections) {
            const address = word(section + 12);
            const rawSize = word(section + 16);
            if (rva >= address && rva + size <= address + rawSize)
                return range(word(section + 20) + rva - address, size);
        }
        return fail();
    };
    const resourceRva = word(directories + 16);
    if (resourceRva === 0) return undefined;
    const resources = location(resourceRva, 16);
    const entries = (offset: number): { name: string | number; target: number; directory: boolean }[] => {
        const table = resources + offset;
        const length = short(table + 12) + short(table + 14);
        range(table + 16, length * 8);
        return Array.from({ length }, (_, index) => {
            const entry = table + 16 + index * 8;
            const key = word(entry);
            const target = word(entry + 4);
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
    const data = entries(0).find((entry) => entry.name === 10 && entry.directory);
    if (data === undefined) return undefined;
    const named = entries(data.target);
    const resource = (name: string): { descriptor: number; offset: number; size: number } | undefined => {
        const entry = named.find((entry) => entry.name === name && entry.directory);
        if (entry === undefined) return undefined;
        const languages = entries(entry.target);
        if (languages.length !== 1 || languages[0]?.directory !== false) return fail();
        const descriptor = resources + languages[0].target;
        const size = word(descriptor + 4);
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
    const fileAlignment = word(optional + 36);
    const sectionAlignment = word(optional + 32);
    if (fileAlignment === 0 || sectionAlignment === 0 || word(directories + 32) !== 0) return fail();
    const align = (value: number, alignment: number): number => Math.ceil(value / alignment) * alignment;
    const header = sectionTable + count * SECTION_SIZE;
    const firstRaw = Math.min(...sections.map((section) => word(section + 20)).filter((offset) => offset !== 0));
    if (header + SECTION_SIZE > firstRaw || header + SECTION_SIZE > word(optional + 60)) return fail();
    const address = align(
        Math.max(...sections.map((section) => word(section + 12) + Math.max(word(section + 8), word(section + 16)))),
        sectionAlignment,
    );
    const rawOffset = align(bytes.length, fileAlignment);
    const rawSize = align(value.length, fileAlignment);
    const result = Buffer.alloc(rawOffset + rawSize);
    bytes.copy(result);
    value.copy(result, rawOffset);
    result.fill(0, header, header + SECTION_SIZE);
    result.write('.gspath', header, 'ascii');
    result.writeUInt32LE(value.length, header + 8);
    result.writeUInt32LE(address, header + 12);
    result.writeUInt32LE(rawSize, header + 16);
    result.writeUInt32LE(rawOffset, header + 20);
    result.writeUInt32LE(0x40000040, header + 36);
    result.writeUInt16LE(count + 1, pe + 6);
    result.writeUInt32LE(word(optional + 8) + rawSize, optional + 8);
    result.writeUInt32LE(align(address + value.length, sectionAlignment), optional + 56);
    result.writeUInt32LE(0, optional + 64);
    result.writeUInt32LE(address, path.descriptor);
    result.writeUInt32LE(value.length, path.descriptor + 4);
    return result;
}
