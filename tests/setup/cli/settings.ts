import { stringify } from '@decimalturn/toml-patch';
import { createFileTree } from 'testdirs';

import { readConfigurations } from '#cli/manifests/read.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { readSettings } from '#cli/settings/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import type { WrittenSettings } from '#cli/types/configurations/language.ts';
import type { Level } from '#cli/types/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

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
        readSettings(text, root ?? resources.use(createTemporaryFolder()).path);
        return [];
    } catch (error) {
        if (error instanceof GspotError && error.code === 'settings')
            return error.message
                .split('\n')
                .slice(0, -1)
                .map((line) => line.split(': ', 2).join(': '));
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

export async function prepareParameterProject(
    root: string,
    scenario: { language: string; file: string; source: string },
    supplied: 'default' | number,
): Promise<{ maximum: unknown; defaultMaximum: unknown }> {
    const { value: defaultMaximum } = buildAvailableSettings(
        [readConfigurations().get('structure')!],
        'all',
    ).defaults.get('limits.max_function_parameters')!;
    const maximum = supplied === 'default' ? defaultMaximum : supplied;
    const limits =
        maximum === defaultMaximum
            ? ''
            : `[limits.${scenario.language}]\nmax_function_parameters = { value = ${String(maximum)}, reason = "The project API declares eight required parameters." }\n`;
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings([scenario.language], { tables: limits, level: 'all' }),
        [scenario.file]: scenario.source,
    });
    await applyGeneratedFiles(root);
    return { maximum, defaultMaximum };
}
