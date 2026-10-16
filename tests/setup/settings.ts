// Writes test settings and reads settings errors.
import { GspotError } from '#cli/system/errors.ts';
import { parseSettings } from '#cli/settings/read.ts';
import type { Level } from '#cli/types/configurations.ts';
import { REPORT_PROGRAM } from '#tests/config/execution.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { WrittenSettings } from '#cli/types/settings/file.ts';

/**
 * Write settings with explicit configuration choices and TOML tables.
 * @param configurations the configurations selected by the sandbox.
 * @param options the level, tables, and selection of the shipped rule files.
 * @param options.level the selected check detail.
 * @param options.tables the additional TOML tables.
 * @param options.rules whether to emit the agent rules.
 * @param options.ignore the ignored checks and their reason.
 * @param options.ignore.checks the check identifiers to ignore.
 * @param options.ignore.reason why to ignore these checks.
 * @returns the sandbox's gspot.toml bytes.
 */
export function settingsText(
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
 * @param text the gspot.toml text.
 * @param root the repository the settings describe, when a problem depends on the tree.
 * @returns the problem messages.
 */
export function settingsErrors(text: string, root?: string): string[] {
    try {
        parseSettings(text, root, createReadCache(process.cwd()));
        return [];
    } catch (error) {
        if (error instanceof GspotError && error.code === 'settings') return error.message.split('\n');
        throw error;
    }
}

/**
 * Build a check that reports each selected path and fails.
 * @param options the selected paths and check stage.
 * @returns the command and its line output.
 */
export function reportingCheck(
    options: Pick<NonNullable<WrittenSettings['command_check']>[number], 'paths' | 'stage'> & { name?: string },
): NonNullable<WrittenSettings['command_check']>[number] {
    return {
        name: options.name ?? 'sandbox/report',
        command: [process.execPath, '-e', REPORT_PROGRAM, '{files}'],
        ...options,
        output: { format: 'lines' },
    };
}
