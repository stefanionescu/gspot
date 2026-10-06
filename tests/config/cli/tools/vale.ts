export const VALE_ACQUISITION_FAILURES = [
    [
        'deadline',
        'setInterval(() => {}, 1000);',
        'Vale package sync exceeded its tool deadline.',
        'tool_timeout_seconds = 1\n',
    ],
    [
        'cancellation',
        'await Bun.write("sync-started", "unexpected");',
        'Vale package sync was canceled.',
        'tool_timeout_seconds = 1\n',
    ],
    [
        'native error',
        'console.error("Registry request failed: https://alex:synthetic-password@example.com/styles.zip"); process.exitCode = 7;',
        'Registry request failed: https://[redacted]@example.com/styles.zip',
        'tool_timeout_seconds = 1\n',
    ],
    [
        'a reasoned deadline',
        'setInterval(() => {}, 1000);',
        'Vale package sync exceeded its tool deadline.',
        'tool_timeout_seconds = { value = 1, reason = "Keep local style acquisition bounded." }\n',
    ],
] as const;

export const CORRECTED_VALE_ACQUISITION = String.raw`
if (process.env.NO_COLOR !== '1' || process.env.FORCE_COLOR !== '0') process.exit(9);
const { mkdirSync, writeFileSync } = await import('node:fs');
mkdirSync('.gspot/config/vale/styles/LocalStyle', { recursive: true });
writeFileSync('.gspot/config/vale/styles/LocalStyle/terms.yml', 'corrected bytes\n');
`;

export const CONFIG = 'StylesPath = vale/styles\nPackages = LocalStyle\n';

export const VALE_DETECTION_LINKS = [
    ['configuration', 'Lifecycle destination is not a private regular file: .gspot/config/vale.ini'],
    ['package', 'Unsafe lifecycle destination: .gspot/config/vale/styles/LocalStyle'],
] as const;

export const VALE_REMOVAL_LINKS = [
    ['package', 'Unsafe lifecycle destination: .gspot/config/vale/styles/LocalStyle'],
    ['nested directory', 'Unsafe lifecycle destination: .gspot/config/vale/styles/LocalStyle/nested'],
] as const;
