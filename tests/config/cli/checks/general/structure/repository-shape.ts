/** Explicit architecture and inventory choices for repository-integrity scenarios. */
export const REPOSITORY_SHAPE_POLICY = {
    configurations: ['typescript', 'docs'],
    ignore: [
        { check: 'x/y', paths: ['gone/**'], reason: 'A test reason.' },
        { check: 'structure/lone-files', paths: ['src'], reason: 'A test reason.' },
        { check: 'docs/stale-paths', paths: ['docs/**'], reason: 'A test reason.' },
    ],
    generated: [{ paths: ['data/**'], reason: 'The fixture owns generated output.' }],
    architecture: { roles: { config: 'config' } },
};
