import { TOOL_PLAN_CHANGES, MANAGED_PLAN_CHANGES } from '#tests/config/commands/init/plan.ts';

export const CSS_MANAGED_PLAN_CHANGES = [
    ...MANAGED_PLAN_CHANGES,
    ...TOOL_PLAN_CHANGES,
    {
        path: 'package.json',
        note: 'managed stylelint fields; other content stays',
    },
] as const;

export const GENERATED_WRITE_MESSAGE = 'Generated write denied';

export const STOPPED_ERROR_MESSAGE =
    'gspot stopped because of an internal error: Generated write denied. Report it at https://github.com/stefanionescu/gspot/issues with the command you ran.\n';
