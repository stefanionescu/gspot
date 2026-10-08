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
        'incomplete native output',
        "const { mkdirSync } = await import('node:fs'); mkdirSync('.gspot/vale/Google', { recursive: true });",
        'Vale setup output is missing: .gspot/vale/write-good',
        'tool_timeout_seconds = 1\n',
    ],
    [
        'missing Harper dictionaries',
        `const { mkdirSync } = await import('node:fs'); for (const name of ["Google", "write-good", "proselint", "alex", "Harper"]) mkdirSync('.gspot/vale/' + name, { recursive: true });`,
        'Vale setup output is missing: .gspot/vale/config/dictionaries',
        'tool_timeout_seconds = 1\n',
    ],
] as const;

export const CORRECTED_VALE_ACQUISITION = String.raw`
if (process.env.NO_COLOR !== '1' || process.env.FORCE_COLOR !== '0') process.exit(9);
const { mkdirSync, writeFileSync } = await import('node:fs');
for (const name of ["Google", "write-good", "proselint", "alex", "Harper", "config/dictionaries"]) {
    mkdirSync('.gspot/vale/' + name, { recursive: true });
    writeFileSync('.gspot/vale/' + name + '/terms.yml', 'package bytes\\n');
}
writeFileSync('.gspot/vale/Google/terms.yml', 'corrected bytes\n');
`;

export const CONFIG = `StylesPath = ../vale\nPackages = Google, write-good, proselint, alex, Harper\n`;

export const VALE_DETECTION_LINKS = [
    ['configuration', 'Lifecycle destination is not a private regular file: .gspot/config/vale.ini'],
    ['package', 'Unsafe lifecycle destination: .gspot/vale/Google'],
] as const;

export const VALE_REMOVAL_LINKS = [
    ['package', 'Unsafe lifecycle destination: .gspot/vale/Google'],
    ['nested directory', 'Unsafe lifecycle destination: .gspot/vale/Google/nested'],
] as const;
