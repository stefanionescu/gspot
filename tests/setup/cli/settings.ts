import { GspotError } from '#cli/system/errors.ts';
import { stringify } from '@decimalturn/toml-patch';
import { parseSettings } from '#cli/settings/parse.ts';
import type { Level, WrittenSettings } from '#cli/types/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { createTemporaryFolder } from '#cli/system/files/temporary.ts';

export function buildSandboxSettings(
    configurations: readonly string[],
    options: {
        level?: Level;
        tables?: string;
        scopes?: ReadonlyArray<{ path: string; configurations?: readonly string[] }>;
        rules?: boolean;
        ignore?: { checks: readonly string[]; reason: string };
    } = {},
): string {
    const { level, tables = '', scopes, rules, ignore } = options;
    const offTables = (rules === true ? ['hooks'] : ['rule_files', 'hooks']).filter(
        (table) => !tables.includes(`[${table}]`),
    );
    const selection = stringify({
        ...(level !== undefined && { level }),
        configurations,
        ...(scopes !== undefined && { scope: scopes }),
    });
    const closing = stringify({
        ...(ignore !== undefined && { ignore: ignore.checks.map((check) => ({ check, reason: ignore.reason })) }),
        ...Object.fromEntries(offTables.map((table) => [table, { enabled: false }])),
    });
    return `${selection}${tables}\n${closing}`;
}

export function validateSettingsText(text: string, root?: string): string[] {
    using resources = new DisposableStack();
    try {
        parseSettings(text, root ?? resources.use(createTemporaryFolder()).path);
        return [];
    } catch (error) {
        if (error instanceof GspotError && error.code === 'settings') return error.message.split('\n').slice(0, -1);
        throw error;
    }
}

export function buildReportingCheck(
    options: Pick<NonNullable<WrittenSettings['command_check']>[number], 'id' | 'paths' | 'stage'>,
): NonNullable<WrittenSettings['command_check']>[number] {
    return {
        id: options.id,
        command: buildProgramCommand('fakes/tool', '--line', '{file}', '--exit', '1'),
        paths: options.paths,
        stage: options.stage,
        output: { format: 'regex', pattern: '(?<message>.+)' },
    };
}
