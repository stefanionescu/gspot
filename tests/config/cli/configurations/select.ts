/** Nearest manual configuration choices apply to descendants, with sibling isolation. */
export const PROJECT_CHOICES = {
    configurations: ['nextjs', 'javascript'],
    removed_configurations: [],
    scope: {
        app: { configurations: [], removed_configurations: ['nextjs'] },
        'app/worker': { configurations: ['nextjs'], removed_configurations: [] },
        required: { configurations: [], removed_configurations: ['javascript'] },
    },
};

/** Root inheritance, removal, deeper restoration, sibling independence, and required dependencies. */
export const PROJECT_SELECTIONS = [
    ['', 'nextjs', true],
    ['app', 'nextjs', false],
    ['app/child', 'nextjs', false],
    ['app/worker', 'nextjs', true],
    ['sibling', 'nextjs', true],
    ['required', 'javascript', true],
] as const;

/** Framework language prerequisites remain required; document checks remain a manual choice. */
export const OPENAPI_FRAMEWORKS = [
    ['express', 'javascript'],
    ['fastapi', 'python'],
] as const;
