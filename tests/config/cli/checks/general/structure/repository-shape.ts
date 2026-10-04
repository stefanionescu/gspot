/** Explicit architecture and inventory choices for repository-integrity scenarios. */
export const REPOSITORY_SHAPE_POLICY = {
    configurations: ['typescript', 'docs'],
    ignore: [{ check: 'x/y', paths: ['gone/**'], reason: 'A test reason.' }],
    generated: [{ paths: ['data/**'], reason: 'The fixture owns generated output.' }],
    structure: { lone_files_allowed: [{ paths: ['src'], reason: 'A test reason.' }] },
    docs: { exclude: [{ paths: ['docs/**'], reason: 'A test reason.' }] },
    architecture: { roles: { config: 'config' } },
};
