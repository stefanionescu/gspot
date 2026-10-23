export const VALE_INSTALL_FAILURES = [
    {
        name: 'timeout',
        script: 'setInterval(() => {}, 1000);',
        message:
            'sync ran longer than tool_timeout_seconds (1s). Raise it with gspot set tool_timeout_seconds <seconds>.',
        settings: 'tool_timeout_seconds = 1\n',
    },
    {
        name: 'its error',
        script: 'console.error("Registry request failed: https://alex:synthetic-password@example.com/styles.zip"); process.exitCode = 7;',
        message: 'Vale sync failed (exit 7):\nRegistry request failed: https://[redacted]@example.com/styles.zip',
        settings: '',
    },
] as const;

export const CORRECTED_VALE_INSTALL_SCRIPT = String.raw`
if (process.env.NO_COLOR !== '1' || process.env.FORCE_COLOR !== '0') process.exit(9);
const { mkdirSync, writeFileSync } = await import('node:fs');
for (const name of ["Google", "write-good", "proselint", "alex", "Harper", "config/dictionaries"]) {
    mkdirSync('../../../vale/' + name, { recursive: true });
    writeFileSync('../../../vale/' + name + '/terms.yml', 'package bytes\\n');
}
writeFileSync('../../../vale/Google/terms.yml', 'corrected bytes\n');
`;

export const VALE_PACKAGES_INI = `StylesPath = ../../../vale\nPackages = Google, write-good, proselint, alex, Harper\n`;
