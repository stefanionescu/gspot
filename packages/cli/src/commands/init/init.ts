import { print } from '#cli/system/terminal.ts';
import { LEVELS } from '#cli/config/manifests.ts';
import { GspotError } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import type { CommandResult } from '#cli/types/system.ts';
import type { InitOptions } from '#cli/types/generation.ts';
import { readTemplate } from '#cli/commands/init/template.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { formatDetection } from '#cli/commands/init/detection.ts';
import { InvalidArgumentError } from '@commander-js/extra-typings';
import { formatInitPlan } from '#cli/generation/setup/file-plan.ts';
import { assertFilesCommitted } from '#cli/generation/setup/conflicts.ts';
import { planInit, writeInitFiles } from '#cli/generation/setup/planner.ts';
import type { InitJson, InitFlags, CommandDefinition } from '#cli/types/commands/edits.ts';

import {
    FROM_OPTION,
    LEVEL_OPTION,
    NEXT_PIN_MESSAGE,
    WROTE_PLAN_MESSAGE,
    NEXT_INSTALL_MESSAGE,
    FROM_CONFLICT_MESSAGE,
    CONFIGURATIONS_OPTION,
    SETTINGS_EXIST_MESSAGE,
    NO_CONFIGURATIONS_FLAG,
    CONFIGURATION_LIST_SEPARATOR,
} from '#cli/config/commands/edits.ts';

const CONFIGURATIONS_CONFLICT_MESSAGE =
    '--configurations cannot run with --no-configurations. Give the names, or select none.';

async function runInitCommand(root: string, options: InitOptions): Promise<CommandResult<InitJson>> {
    if (findText(root, SETTINGS_FILE) !== undefined) throw new GspotError('arguments', SETTINGS_EXIST_MESSAGE);
    const initPlan = await planInit(root, options);
    const { plan, settingsText, pinPath, session } = initPlan;
    await assertFilesCommitted(root, initPlan.replaced);
    print(formatDetection(initPlan.detection));
    print(formatInitPlan(plan, settingsText));
    const json: InitJson = {
        root,
        plan,
        settingsText,
        written: [],
        unchanged: [],
        removed: [],
        updated: [],
        notes: [],
    };
    const applied = await writeInitFiles(root, initPlan);
    const { notes } = applied;
    const next =
        pinPath === undefined
            ? NEXT_INSTALL_MESSAGE
            : NEXT_PIN_MESSAGE.replace('{runner}', () => session.startRunner.name).replace('{file}', () => pinPath);
    return {
        text: [WROTE_PLAN_MESSAGE, ...notes, '', next].join('\n'),
        json: { ...json, ...applied, notes: [...notes, next] },
        exitCode: 0,
    };
}

function parseConfigurationNames(value: string, previous: InitFlags['configurations']): string[] {
    if (previous === false) throw new GspotError('arguments', CONFIGURATIONS_CONFLICT_MESSAGE);
    const names = value
        .split(CONFIGURATION_LIST_SEPARATOR)
        .map((name) => name.trim())
        .filter((name) => name !== '');
    if (names.length === 0) throw new InvalidArgumentError('Name at least one configuration.');
    return [...(Array.isArray(previous) ? previous : []), ...names];
}

function assertTemplateFlags(from: string | undefined, configurations: InitFlags['configurations']): void {
    if (from === undefined || configurations === undefined) return;
    const flag = configurations === false ? '--no-configurations' : '--configurations';
    throw new GspotError(
        'arguments',
        FROM_CONFLICT_MESSAGE.replace('{flag}', () => flag),
    );
}

export const INIT_COMMAND: CommandDefinition<[], InitFlags> = {
    name: 'init',
    options: [
        { flags: FROM_OPTION },
        { flags: CONFIGURATIONS_OPTION, parse: parseConfigurationNames },
        {
            flags: NO_CONFIGURATIONS_FLAG,
            // Commander passes a negated flag through its parser with no value, so the parser sees earlier names.
            parse: (_value: string | undefined, previous: InitFlags['configurations']): false => {
                if (Array.isArray(previous)) throw new GspotError('arguments', CONFIGURATIONS_CONFLICT_MESSAGE);
                return false;
            },
        },
        { flags: LEVEL_OPTION, choices: LEVELS },
    ],
    run: async (_arguments, { from, configurations, level }, { root, cwd }) => {
        assertTemplateFlags(from, configurations);
        const template = from === undefined ? undefined : readTemplate(from, cwd);
        return await runInitCommand(root, {
            cwd,
            level,
            template,
            configurations: configurations === false ? [] : configurations,
        });
    },
};
