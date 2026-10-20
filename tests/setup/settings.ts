// Writes test settings and reads settings errors.
import { GspotError } from '#cli/system/errors.ts';
import { parseSettings } from '#cli/settings/read.ts';
import type { Level } from '#cli/types/configurations.ts';
import { REPORT_PROGRAM } from '#tests/data/test-setup.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { WrittenSettings } from '#cli/types/settings/file.ts';

/**
 * Build the gspot.toml text of a sandbox, with rules off unless the options turn them on.
 *
 * @param configurations what the sandbox turns on.
 * @param options extra settings to write.
 * @param options.level `recommended` or `all`.
 * @param options.tables more TOML to append.
 * @param options.rules whether to write the agent instructions.
 * @param options.ignore checks to leave out.
 * @param options.ignore.checks their check IDs.
 * @param options.ignore.reason why to leave them out.
 * @returns the gspot.toml text.
 */
export function buildSettingsText(
    configurations: readonly string[],
    options: {
        level?: Level;
        tables?: string;
        rules?: boolean;
        ignore?: { checks: readonly string[]; reason: string };
    } = {},
): string {
    const selected = configurations.map((configuration) => JSON.stringify(configuration)).join(', ');
    const chosen = options.level === undefined ? '' : `level = "${options.level}"\n`;
    const ignore = options.ignore;
    const ignored =
        ignore === undefined
            ? ''
            : ignore.checks
                  .map(
                      (check) =>
                          `[[ignore]]\ncheck = ${JSON.stringify(check)}\nreason = ${JSON.stringify(ignore.reason)}\n`,
                  )
                  .join('');
    const tables = options.tables ?? '';
    const rules = options.rules === true || tables.includes('[rules]') ? '' : '\n[rules]\nenabled = false\n';
    return `${chosen}configurations = [${selected}]\n${tables}${ignored}${rules}`;
}

/**
 * Parses settings text and returns its errors, or none when it parses.
 *
 * @param text gspot.toml content to parse.
 * @param repositoryRoot folder the settings describe, for errors that depend on its files.
 * @returns the error messages.
 */
export function validateSettingsText(text: string, repositoryRoot?: string): string[] {
    try {
        parseSettings(text, repositoryRoot, createReadCache(process.cwd()));
        return [];
    } catch (error) {
        if (error instanceof GspotError && error.code === 'settings') return error.message.split('\n');
        throw error;
    }
}

/**
 * Build a command check that prints each path it gets and fails.
 *
 * @param options which files and stage the check covers.
 * @returns the command check record.
 */
export function buildReportingCheck(
    options: Pick<NonNullable<WrittenSettings['command_check']>[number], 'paths' | 'stage'> & { name?: string },
): NonNullable<WrittenSettings['command_check']>[number] {
    return {
        name: options.name ?? 'sandbox/report',
        command: [process.execPath, '-e', REPORT_PROGRAM, '{files}'],
        ...options,
        output: { format: 'lines' },
    };
}
