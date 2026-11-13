export const ALLOWED_PACKAGE_CASES = [
    {
        name: 'with a version range covers a package',
        record: 'name = "strict"\nversion = "^1.0.0"\n',
        lockedName: 'strict',
        ecosystem: 'npm',
        findings: [],
    },
    {
        name: 'with a name glob covers each platform build',
        record: 'name = "@img/sharp-*"\nversion = "*"\n',
        lockedName: '@img/sharp-linux',
        ecosystem: 'npm',
        findings: [],
    },
    {
        name: 'normalizes a Python name',
        record: 'name = "Licensed._Example"\nversion = "1.0.0"\n',
        lockedName: 'licensed-example',
        ecosystem: 'PyPI',
        findings: [],
    },
    {
        name: 'for another version covers nothing and is unused',
        record: 'name = "strict"\nversion = "2.0.0"\n',
        lockedName: 'strict',
        ecosystem: 'npm',
        findings: ['disallowed-license', 'unused-record'],
    },
] as const;
export const GPL_PACKAGE = {
    name: 'strict',
    version: '1.0.0',
    ecosystem: 'npm',
    licenses: ['GPL-3.0-only'],
} as const;
export const LICENSE_TABLES = '[licenses]\nallowed = ["MIT", "Apache-2.0"]\n';
export const MIT_PACKAGE = { name: 'ready', version: '1.0.0', ecosystem: 'npm', licenses: [] } as const;
