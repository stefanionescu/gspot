import { createHash } from 'node:crypto';
import { JSON_INDENT } from '#cli/config/text.ts';
import type { Session } from '#cli/types/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import type { ToolInstall } from '#cli/types/installers/install.ts';
import type { InstallRecord } from '#cli/types/installers/record.ts';
import { installRecordSchema } from '#cli/schemas/installers/record.ts';

/**
Hash the inputs that decide whether an install must run.

@param sources the manager, settings, and lockfile bytes.
@returns the SHA-256 key.
*/
export function buildInstallKey(sources: (string | Buffer)[]): string {
    const hash = createHash('sha256');
    for (const source of sources) hash.update(source);
    return hash.digest('hex');
}

/**
Read the successful installs. Return an empty record for an absent or invalid file.

@param session the repository that holds the record.
@returns the keys of completed installs.
*/
export function readInstallRecord(session: Session): InstallRecord {
    const files = openFiles(session.root);
    const saved = files.read(GSPOT_PATHS.installRecord);
    if (saved === undefined) return {};
    try {
        const value: unknown = JSON.parse(saved.bytes.toString('utf8'));
        const result = installRecordSchema.safeParse(value);
        return result.success ? result.data : {};
    } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        return {};
    }
}

/**
Record a successful install through the locked writer.

@param install the install context and locked writer.
@param project npm or Vale, which owns the key.
@param key the inputs of the successful install.
*/
export function recordInstalledProject(install: ToolInstall, project: keyof InstallRecord, key: string): void {
    const record = { ...install.record, [project]: key };
    install.writer.write(GSPOT_PATHS.installRecord, {
        bytes: Buffer.from(`${JSON.stringify(record, null, JSON_INDENT)}\n`),
        mode: OWNER_WRITABLE_FILE,
    });
    install.record[project] = key;
}
