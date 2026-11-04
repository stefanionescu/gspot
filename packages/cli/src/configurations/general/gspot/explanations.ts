import type { RuleExplanation, RuleExplanations } from '#cli/types/tools.ts';

import {
    GSPOT_RULES,
    WEAKENING_FIXES,
    WEAKENING_RULES,
    GENERATED_FILE_FINDINGS,
} from '#cli/config/configurations/structure.ts';

export const WEAKENING_EXPLANATIONS = {
    [WEAKENING_RULES.baseline]: {
        description: '`gspot.baseline.json` counts more findings than at the base revision.',
        why: 'A count that grows accepts new findings as old ones.',
        fix: 'Fix the new findings, and run `gspot baseline --prune`.',
        example: 'A count that rises from one to two in `src/app.ts` reports `baseline`.',
    },
    [WEAKENING_RULES.configuration]: {
        description: 'A selected configuration goes away against the base revision.',
        why: 'The checks of the configuration stop running.',
        fix: WEAKENING_FIXES[WEAKENING_RULES.configuration],
        example: 'Deleting `"python"` from `configurations` reports `configuration`.',
    },
    [WEAKENING_RULES.hooks]: {
        description: '`hooks.enabled` turns off against the base revision.',
        why: 'Without the hooks, the checks run only when someone asks for them.',
        fix: 'Set `hooks.enabled` back to true.',
        example: '`enabled = false` under `[hooks]` reports `hooks`.',
    },
    [WEAKENING_RULES.level]: {
        description: '`level` drops against the base revision.',
        why: 'A lower level turns off every check that runs only at the higher one.',
        fix: 'Set `level` back.',
        example: '`level = "basic"` where the base has `level = "all"` reports `level`.',
    },
    [WEAKENING_RULES.ruleFiles]: {
        description: '`rule_files` turns off the rule files, or leaves more of them out, against the base revision.',
        why: 'An agent follows only the rules it can read.',
        fix: 'Set `rule_files.enabled` back to true, or remove the entry from `rule_files.exclude`.',
        example: '`enabled = false` under `[rule_files]` reports `rule-files`.',
    },
    [WEAKENING_RULES.setting]: {
        description: 'A setting moves to a weaker value against the base revision, such as a higher limit.',
        why: 'A weaker value lets findings through that the base revision reports.',
        fix: WEAKENING_FIXES[WEAKENING_RULES.setting],
        example: '`max_file_lines = 400` where the base has the default of 300 reports `setting`.',
    },
} as const satisfies RuleExplanations;

export const GENERATED_FILE_EXPLANATIONS = {
    changed: {
        description: 'Each generated file holds what the settings generate.',
        why: 'An edited file runs its tool with settings that `gspot.toml` does not hold.',
        fix: GENERATED_FILE_FINDINGS.changed.help,
        example: 'An `.editorconfig` edited by hand reports `changed`.',
    },
    absent: {
        description: 'Each file that the settings generate exists.',
        why: 'A tool without its generated config file runs with its own defaults.',
        fix: GENERATED_FILE_FINDINGS.absent.help,
        example: 'A deleted `.editorconfig` reports `absent`.',
    },
    stray: {
        description: 'Each file that gspot wrote belongs to a selected configuration.',
        why: 'A file of a configuration that is no longer selected still sets up its tool.',
        fix: GENERATED_FILE_FINDINGS.stray.help,
        example: 'A generated file of a configuration that `gspot remove` took out reports `stray`.',
    },
} as const satisfies Readonly<Record<keyof typeof GENERATED_FILE_FINDINGS, RuleExplanation>>;

export const CONFLICTING_CONFIG_EXPLANATIONS = {
    [GSPOT_RULES.conflictingConfig]: {
        description:
            'The repository holds no tool config of its own for a tool that gspot writes a generated config file for.',
        why: 'The tool reads only the settings that gspot writes, so the other file misleads readers.',
        fix: 'Carry each rule that you still need into `gspot.toml`, then delete the file or section.',
        example: '`.commitlintrc.json` while gspot runs commitlint reports `conflicting-config`.',
    },
    [GSPOT_RULES.lintCommand]: {
        description: 'No script, hook, CI step, or dependency of the repository runs a tool that gspot replaces.',
        why: 'That command runs the tool with other settings than `gspot check`, so the two can disagree.',
        fix: 'Run `gspot check` in its place, or delete the line.',
        example: 'A `lint` script in `package.json` that runs `eslint .` reports `lint-command`.',
    },
} as const satisfies RuleExplanations;
