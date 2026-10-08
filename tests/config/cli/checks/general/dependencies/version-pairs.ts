export const VERSION_PAIR_CASES = [
    {
        name: 'different ranges with equal installed versions pass',
        left: '^19.0.0',
        right: '~19.1.1',
        installedLeft: '19.1.1',
        installedRight: '19.1.1',
        findings: 0 as const,
    },
    {
        name: 'equal ranges with different installed versions report the pair',
        left: '^19.0.0',
        right: '^19.0.0',
        installedLeft: '19.1.1',
        installedRight: '19.1.0',
        findings: 1 as const,
    },
    {
        name: 'an uninstalled pair has no version to compare',
        left: '^19.0.0',
        right: '^19.0.0',
        installedLeft: undefined,
        installedRight: undefined,
        findings: 0 as const,
    },
    {
        name: 'one uninstalled package has no paired version to compare',
        left: '^19.0.0',
        right: '^19.0.0',
        installedLeft: '19.1.1',
        installedRight: undefined,
        findings: 0 as const,
    },
];
