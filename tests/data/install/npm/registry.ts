/** Two invalid .npmrc texts and the message of each. */
export const NPMRC_REFUSALS = [
    { source: 'registry=not-a-valid-url\n', message: 'Invalid registry URL in package manager configuration.' },
    { source: 'maxsockets=not-a-number\n', message: 'Invalid package manager configuration.' },
] as const;
