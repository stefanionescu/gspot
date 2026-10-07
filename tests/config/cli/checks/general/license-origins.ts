/** The same reviewed exception is authored at the origin under test. */
export const EXCEPTION_ENTRY =
    'package = "Absent_Package@2.0.0"\nlicense = "MIT"\nreason = "Reviewed the installed project."\n';

/** Authored exception origins are audited over actual selected installed projects. */
export const EXCEPTION_MEMBERSHIP = [
    {
        name: 'root exception absent from every inherited project',
        origin: '',
        scopes: ['docs', 'cli'],
        reports: { docs: 'present@1.0.0', cli: 'present@1.0.0' },
        stale: true,
    },
    {
        name: 'root exception used only by documentation without a root manifest',
        origin: '',
        scopes: ['docs', 'cli'],
        reports: { docs: 'Absent.Package@2.0.0', cli: 'present@1.0.0' },
        stale: false,
    },
    {
        name: 'scoped exception excludes a sibling installed package',
        origin: 'app',
        scopes: ['app', 'sibling'],
        reports: { app: 'present@1.0.0', sibling: 'Absent.Package@2.0.0' },
        stale: true,
    },
    {
        name: 'scoped exception accepts its installed normalized identity',
        origin: 'app',
        scopes: ['app', 'sibling'],
        reports: { app: 'Absent.Package@2.0.0', sibling: 'present@1.0.0' },
        stale: false,
    },
    {
        name: 'scoped exception accepts its selected descendant',
        origin: 'app',
        scopes: ['app', 'app/child', 'sibling'],
        reports: { app: 'present@1.0.0', 'app/child': 'Absent.Package@2.0.0', sibling: 'present@1.0.0' },
        stale: false,
    },
    {
        name: 'nested exception excludes its parent inventory',
        origin: 'app/child',
        scopes: ['app', 'app/child'],
        reports: { app: 'Absent.Package@2.0.0', 'app/child': 'present@1.0.0' },
        stale: true,
    },
    {
        name: 'tooling and lockfile membership cannot justify an exception',
        origin: '',
        scopes: ['app'],
        reports: { app: 'present@1.0.0' },
        stale: true,
    },
    {
        name: 'ignored descendant does not prove a root exception stale',
        origin: '',
        scopes: ['docs', 'app'],
        reports: { docs: 'present@1.0.0', app: 'Absent.Package@2.0.0' },
        ignore: 'app',
        stale: false,
    },
    {
        name: 'local changed license fails even when another project accepts the same package',
        origin: '',
        scopes: ['docs', 'cli'],
        reports: { docs: 'Absent.Package@2.0.0', cli: 'Absent.Package@2.0.0' },
        licenses: { docs: 'GPL-3.0-only' },
        disallowed: ['docs/pyproject.toml'],
        stale: false,
    },
];
