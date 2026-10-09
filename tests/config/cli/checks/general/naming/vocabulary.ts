export const GROUP_SOURCE =
    'export const oldValue = 1;\nexport const fallback = 1;\nexport const plusValue = 1;\n' +
    'export const enhancedValue = 1;\nexport const ensureValue = 1;\n' +
    'export const custom = 1;\nexport const combined = 1;\n';

export const NUMBERED_FILES = {
    '.mise/tasks/01-build.sh': 'echo example\n',
    'scripts/steps/01-build.sh': 'echo example\n',
};

export const ORDINARY_WORDS = ['data', 'message', 'values', 'id'];

export const RESERVED_FILES = {
    'entry.ts': 'export const record = 1;\nexport type Row = { record: string };\n',
    'app/entry.ts': 'export function readRecord() { return 1; }\nexport type Row = { record: string };\n',
    'sibling/entry.ts': 'export const record = 1;\nexport type Row = { record: string };\n',
};

export const RESTORED_TERMS = [
    'taxonomy',
    'snapshot',
    'snapshots',
    'actual',
    'custom',
    'final',
    'latest',
    'old',
    'new',
    'legacy',
    'plus',
    'combined',
    'should',
    'transient',
    'fallback',
];

export const RESERVED_POLICY =
    '[naming]\nreserved = {record = ["properties"]}\n' +
    '[scope."app"]\n[scope."app".naming]\nreserved = {record = ["functions"]}\n' +
    '[scope."sibling"]\n';

export const PREFIX_EXCEPTION =
    '[[naming.overrides]]\npaths = [".mise/tasks/*.sh", "scripts/steps/*.sh"]\n' +
    'categories = ["files"]\nignored_prefix = \'^\\d{2}-\'\nreason = "The project orders its tasks by this prefix."\n';

export const REPEATED_EXCEPTION =
    '[[naming.overrides]]\npaths = ["entry.ts"]\nnames = ["userUser"]\nallow_repeated_words = true\n' +
    'reason = "The generated interface fixes this exact repeated name."\n';
