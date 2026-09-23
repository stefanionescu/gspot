import type { SettingSpec } from '#cli/presets/types.ts';

/** Strict source coverage applies independently of selected presets and run filters. */
export const COVERAGE_STRICT = {
    name: 'coverage.strict',
    kind: 'boolean',
    direction: 'tightening',
    default: false,
    summary:
        'Fail checks when a supported source file has no enabled configured check. Message hooks do not enforce source coverage.',
} as const satisfies SettingSpec;

/** The execution deadline applies independently of selected language presets. */
export const TOOL_DEADLINE = {
    name: 'limits.tool_seconds',
    kind: 'number',
    direction: 'ceiling',
    default: 600,
    summary: 'The longest one tool run can take, in seconds. gspot stops a longer run and reports an error.',
} as const satisfies SettingSpec;
