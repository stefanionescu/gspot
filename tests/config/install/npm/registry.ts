export const NPMRC_REFUSALS = [
    {
        source: 'registry=https://alex:100%@registry.example.com/\n',
        message: 'A registry URL in the .npmrc files is not valid.',
    },
    { source: 'registry=not-a-valid-url\n', message: 'A registry URL in the .npmrc files is not valid.' },
    { source: 'maxsockets=not-a-number\n', message: 'The .npmrc settings are not valid.' },
] as const;
