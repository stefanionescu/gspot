import { TOOL_PLAN_CHANGES, MANAGED_PLAN_CHANGES } from '#tests/config/commands/init/plan.ts';

export const CSS_MANAGED_PLAN_CHANGES = [
    ...MANAGED_PLAN_CHANGES,
    {
        path: '.gspot/package.json',
        note: '5 pinned npm tools; matching lockfile',
    },
    ...TOOL_PLAN_CHANGES,
    {
        path: 'package.json',
        note: 'managed stylelint fields; other content stays',
    },
] as const;
