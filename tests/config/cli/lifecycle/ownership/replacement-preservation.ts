/** Both task restorations retain the original tasks; an authored environment edit also survives. */
export const TASK_RESTORATION_CASES = [
    { name: 'no subsequent edits', appended: '', environment: undefined, isOriginal: true },
    {
        name: 'an authored environment edit',
        appended: '\n[env]\nAPP_MODE = "authored"\n',
        environment: { APP_MODE: 'authored' },
        isOriginal: false,
    },
];
