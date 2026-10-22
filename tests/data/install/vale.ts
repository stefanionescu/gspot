// Only the row that tests the time limit gets a short one; a slow start under load must not fail the other row.

export const VALE_INSTALL_FAILURES = [
    {
        name: 'timeout',
        script: 'setInterval(() => {}, 1000);',
        message: 'ran longer than tool_timeout_seconds (1s).',
        settings: 'tool_timeout_seconds = 1\n',
    },
    {
        name: 'its error',
        script: 'console.error("Registry request failed: https://alex:synthetic-password@example.com/styles.zip"); process.exitCode = 7;',
        message: 'Registry request failed: https://[redacted]@example.com/styles.zip',
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

/** The authored files beside the Vale packages, which install keeps. */
export const AUTHORED_VALE_FILES = {
    check: '',
    files: {
        'authored.txt': 'keep\n',
        '.gspot/configurations/general/prose/styles/Google/legacy.yml': 'authored legacy bytes\n',
    },
} as const;
export const GOOGLE_TERMS_PATH = '.gspot/vale/Google/terms.yml';
