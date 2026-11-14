import { LEADING_NEWLINE } from '#cli/config/parsers/formats.ts';
import { EMPTY_JSON_TEXT, TOML_BARE_KEY, TRAILING_BLANK_LINE } from '#cli/config/repository/files.ts';
import { TOML_EXTENSION } from '#cli/config/repository/setup.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/system.ts';
import { openJsonFile } from '#cli/parsers/formats/json.ts';
import { findBlockSpan, replaceBlock } from '#cli/parsers/formats/managed-blocks.ts';
import { openTomlFile } from '#cli/parsers/formats/toml/edit.ts';
import { isGspotOwned } from '#cli/repository/files/ownership.ts';
import { readGspotGeneratedPatterns } from '#cli/repository/git/attributes.ts';
import { GspotError } from '#cli/system/errors.ts';
import { isSameContents } from '#cli/system/files/bounded.ts';
import { deleteEmptyFolders } from '#cli/system/files/open.ts';
import { decodeUtf8File } from '#cli/system/files/reads.ts';
import type { EditableFile } from '#cli/types/parsers.ts';
import type { ManagedKeys, ReplacementRequest, WritePlan } from '#cli/types/repository.ts';
import type { FileContents, Files } from '#cli/types/system.ts';

function openManagedKeysFile(path: string, onDisk: FileContents | undefined, keys: ManagedKeys['keys']): EditableFile {
    const text = onDisk === undefined ? undefined : decodeUtf8File(path, onDisk.bytes);
    if (path.endsWith(TOML_EXTENSION)) {
        const headers = new Set(
            keys
                .filter(({ key, value }) => value !== undefined && key.length > 1)
                .map(({ key }) =>
                    key
                        .slice(0, -1)
                        .map((name) =>
                            typeof name === 'string' && TOML_BARE_KEY.test(name) ? name : JSON.stringify(name),
                        )
                        .join('.'),
                ),
        );
        const contents = text ?? [...headers].map((header) => `[${header}]\n`).join('\n');
        return openTomlFile(path, contents);
    }
    return openJsonFile(path, text ?? EMPTY_JSON_TEXT);
}

function removeBlock(path: string, onDisk: FileContents): FileContents | undefined {
    const text = decodeUtf8File(path, onDisk.bytes);
    const span = findBlockSpan(text, path);
    if (span === undefined) return onDisk;
    const before = text.slice(0, span.start).replace(TRAILING_BLANK_LINE, '$1');
    const after = text.slice(span.end);
    const next = before === '' ? after.replace(LEADING_NEWLINE, '') : before + after;
    return next === '' ? undefined : { bytes: Buffer.from(next), mode: onDisk.mode };
}

function writeBatch(writer: Files, plans: WritePlan[]): void {
    for (const { path, after } of plans) {
        if (after === undefined) {
            writer.deleteFile(path);
            deleteEmptyFolders(writer, path);
        } else writer.write(path, after);
    }
}

export function planManagedKeys(writer: Files, path: string, keys: ManagedKeys['keys']): WritePlan {
    const onDisk = writer.read(path);
    const document = openManagedKeysFile(path, onDisk, keys);
    const before = onDisk === undefined ? '' : document.getText();
    for (const field of keys) document.set(field.key, field.value);
    const updated = document.getText();
    const text = path.endsWith(TOML_EXTENSION) && !updated.endsWith('\n') ? `${updated}\n` : updated;
    return {
        path,
        after: { bytes: Buffer.from(text), mode: onDisk?.mode ?? OWNER_WRITABLE_FILE },
        status: text === before ? 'unchanged' : 'changed',
    };
}

export function planReplacements(writer: Files, requests: ReplacementRequest[]): WritePlan[] {
    const generatedPatterns = readGspotGeneratedPatterns(writer);
    const ownablePaths = new Set(requests.map(({ path }) => path));
    return requests.map(({ path, next, previous }): WritePlan => {
        const onDisk = writer.read(path);
        const hasLaterEdit = previous !== undefined && !isSameContents(onDisk, previous);
        const hasUnreviewedContents = onDisk !== undefined && previous === undefined && !isSameContents(onDisk, next);
        if (!isGspotOwned(path, writer, generatedPatterns, ownablePaths) && (hasLaterEdit || hasUnreviewedContents))
            return { path, after: next, status: 'refused' };
        return {
            path,
            after: next,
            status: isSameContents(onDisk, next) ? 'unchanged' : 'changed',
        };
    });
}

export function planBlock(writer: Files, path: string, body: string): WritePlan {
    const onDisk = writer.read(path);
    const text = onDisk === undefined ? '' : decodeUtf8File(path, onDisk.bytes);
    const nextText = replaceBlock(text, body, path);
    const next = {
        bytes: Buffer.from(nextText),
        mode: onDisk?.mode ?? OWNER_WRITABLE_FILE,
    };
    return { path, after: next, status: isSameContents(onDisk, next) ? 'unchanged' : 'changed' };
}

export function planRemovals(writer: Files, paths: string[]): WritePlan[] {
    const generatedPatterns = readGspotGeneratedPatterns(writer);
    const ownablePaths = new Set(paths);
    return paths.map((path): WritePlan => {
        const onDisk = writer.readKeepingLinks(path);
        if (onDisk === undefined) return { path, status: 'unchanged' };
        if (isGspotOwned(path, writer, generatedPatterns, ownablePaths)) return { path, status: 'changed' };
        const next = removeBlock(path, onDisk);
        return {
            path,
            ...(next !== undefined && { after: next }),
            status: isSameContents(onDisk, next) ? 'unchanged' : 'changed',
        };
    });
}

export function writePlans(writer: Files, plans: WritePlan[]): void {
    const conflicts = plans.filter((plan) => plan.status === 'refused').map((plan) => plan.path);
    if (conflicts.length > 0)
        throw new GspotError(
            'writing',
            `gspot did not overwrite these files: ${conflicts.join(', ')}. Move them aside, then run the command again.`,
        );
    writeBatch(
        writer,
        plans.filter((plan) => plan.status === 'changed'),
    );
}
