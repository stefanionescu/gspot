// The literal values checks/tool/docker reads: names, patterns, limits, and tables.

export const DOCKERIGNORE_ENTRIES = ['.git', 'node_modules', '.env'];
/** The exit Trivy gives for findings, which its commands set with --exit-code. */
export const TRIVY_EXIT = 10;
export const SHOWN_FINDINGS = 20;
export const COMPOSE_FILES = [
    '**/docker-compose*.yml',
    '**/docker-compose*.yaml',
    '**/compose*.yml',
    '**/compose*.yaml',
];
