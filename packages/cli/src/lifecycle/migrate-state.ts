import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { runBlocking } from '#cli/platform/spawn.ts';
import { STATE_DIRECTORY } from '#cli/platform/layout.ts';
import { ownershipSchema } from '#cli/schemas/ownership.ts';
import type { OwnershipState } from '#cli/types/ownership.ts';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { ConfinedRoot, FileSnapshot } from '#cli/types/filesystem.ts';

/**
 * Translate only validated journal fields; filenames alone never establish ownership.
 * @param record
 * @param prefix
 * @param stateDirectory
 */
export function legacyOwnership(
    record: FileSnapshot,
    prefix: string,
    stateDirectory = STATE_DIRECTORY,
): OwnershipState {
    const RECOVERY_DIRECTORY = `${stateDirectory}/recovery`;
    const parsed: unknown = JSON.parse(record.bytes.toString('utf8'), (key, value: unknown) => {
        if (key !== 'backup' || typeof value !== 'string') return value;
        if (!/^\.gspot\/recovery\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.original$/u.test(value))
            throw new Error('Invalid legacy recovery reference. Preserve the journal and recovery files.');
        return value.replace('.gspot/recovery', RECOVERY_DIRECTORY);
    });
    const state = ownershipSchema.parse(parsed);
    if (prefix !== '') {
        for (const entry of state.files) entry.path = `${prefix}/${entry.path}`;
        for (const pending of state.pending ?? []) {
            pending.path = `${prefix}/${pending.path}`;
            if (pending.entry !== undefined) pending.entry.path = `${prefix}/${pending.entry.path}`;
        }
    }
    return ownershipSchema.parse(state);
}

/**
 * Merge a resumed conversion only when duplicated records agree exactly.
 * @param current
 * @param legacy
 */
export function mergeOwnership(current: OwnershipState, legacy: OwnershipState): OwnershipState {
    const files = new Map(current.files.map((entry) => [entry.path, entry]));
    for (const entry of legacy.files) {
        const existing = files.get(entry.path);
        if (existing !== undefined && !isDeepStrictEqual(existing, entry))
            throw new Error(`Ownership conversion conflicts with ${entry.path}. Preserve both journals.`);
        files.set(entry.path, entry);
    }
    const pending = new Map((current.pending ?? []).map((entry) => [entry.path, entry]));
    for (const entry of legacy.pending ?? []) {
        const existing = pending.get(entry.path);
        if (existing !== undefined && !isDeepStrictEqual(existing, entry))
            throw new Error(`Interrupted ownership conversion conflicts with ${entry.path}.`);
        pending.set(entry.path, entry);
    }
    const installations = [...new Set([...(current.installations ?? []), ...(legacy.installations ?? [])])];
    return ownershipSchema.parse({
        version: 1,
        files: [...files.values()],
        ...(pending.size === 0 ? {} : { pending: [...pending.values()] }),
        ...(installations.length === 0 ? {} : { installations }),
    });
}

/**
 * Convert repository and formerly nested hook journals under both old and new writer locks.
 * @param files
 * @param root
 * @param stateDirectory
 */
export function migrateState(files: ConfinedRoot, root: string, stateDirectory = STATE_DIRECTORY): string[] {
    const converted: string[] = [];
    const OWNERSHIP_FILE = `${stateDirectory}/ownership.json`;
    const RECOVERY_DIRECTORY = `${stateDirectory}/recovery`;
    for (const prefix of legacyPrefixes(root)) {
        const directory = prefix === '' ? '.gspot' : `${prefix}/.gspot`;
        const path = `${directory}/ownership.json`;
        const initial = files.read(path);
        if (initial === undefined) continue;
        files.lock(`${directory}/writer.lock`);
        const record = files.read(path)!;
        const legacy = legacyOwnership(record, prefix, stateDirectory);
        const recorded = files.read(OWNERSHIP_FILE);
        const current =
            recorded === undefined
                ? { version: 1 as const, files: [] }
                : ownershipSchema.parse(JSON.parse(recorded.bytes.toString('utf8')));
        const state = mergeOwnership(current, legacy);
        const recovery = `${directory}/recovery`;
        const copies: { path: string; snapshot: FileSnapshot }[] = [];
        const directories: string[] = [];
        const visit = (source: string): void => {
            if (files.stat(source) === undefined) return;
            directories.push(source);
            files.mkdir(`${RECOVERY_DIRECTORY}${source.slice(recovery.length)}`, files.stat(source)!.mode & 0o7777);
            for (const name of files.list(source)) {
                const path = `${source}/${name}`;
                if (files.stat(path)?.isDirectory()) {
                    visit(path);
                    continue;
                }
                const snapshot = files.read(path)!;
                let converted = snapshot;
                if (path.endsWith('.original.json')) {
                    const details = JSON.parse(snapshot.bytes.toString('utf8')) as { path: string; backup: string };
                    const next = {
                        ...details,
                        path: prefix === '' ? details.path : `${prefix}/${details.path}`,
                        backup: details.backup.replace('.gspot/recovery', RECOVERY_DIRECTORY),
                    };
                    converted = { ...snapshot, bytes: Buffer.from(`${JSON.stringify(next)}\n`) };
                }
                const destination = `${RECOVERY_DIRECTORY}${path.slice(recovery.length)}`;
                const existing = files.read(destination);
                if (existing !== undefined && !isDeepStrictEqual(existing, converted))
                    throw new Error(`Recovery conversion conflicts with ${destination}. Preserve both copies.`);
                if (existing === undefined) files.write(destination, converted, undefined);
                copies.push({ path, snapshot });
            }
        };
        visit(recovery);
        const originals = [
            ...legacy.files.flatMap((entry) => (entry.original === undefined ? [] : [entry.original])),
            ...(legacy.pending ?? []).flatMap((pending) =>
                [pending.beforeBackup, pending.entry?.original].filter((entry) => entry !== undefined),
            ),
        ];
        for (const original of originals) {
            const backup = files.read(original.backup);
            if (backup === undefined || createHash('sha256').update(backup.bytes).digest('hex') !== original.hash)
                throw new Error(`Recovery conversion found a missing or edited backup: ${original.backup}`);
        }
        files.write(
            OWNERSHIP_FILE,
            { bytes: Buffer.from(`${JSON.stringify(state, null, 2)}\n`), mode: 0o600 },
            recorded,
        );
        for (const copy of copies) files.remove(copy.path, copy.snapshot);
        for (const directory of directories.reverse()) files.rmdir(directory);
        files.remove(path, record);
        if (prefix !== '') converted.push(directory);
    }
    return converted;
}

/**
 * Resolve the old hook writer boundary from Git instead of searching for journal filenames.
 * @param root
 */
export function legacyPrefixes(root: string): string[] {
    const prefixes = new Set(['', '.gspot']);
    const repository = runBlocking(['git', 'rev-parse', '--show-toplevel'], { cwd: root });
    if (repository.code === 0) {
        const top = resolve(root, repository.stdout.trimEnd());
        const hooks = runBlocking(['git', 'rev-parse', '--git-path', 'hooks'], { cwd: top });
        if (hooks.code !== 0) throw new Error(`Cannot resolve legacy hook state: ${hooks.stderr.trim()}`);
        const prefix = relative(root, dirname(resolve(top, hooks.stdout.trimEnd()))).replaceAll('\\', '/');
        if (
            prefix !== '..' &&
            !prefix.startsWith('../') &&
            !isAbsolute(prefix) &&
            prefix !== '.git' &&
            !prefix.startsWith('.git/')
        )
            prefixes.add(prefix);
    }
    return [...prefixes];
}
