/** Version command output, with the state, the version found, and the note of the inspection. */
export const VERSION_OUTPUTS = [
    {
        name: 'a version with an undeclared exit code',
        script: 'console.log("3.8.1"); process.exitCode = 7;',
        state: 'error',
        found: undefined,
        note: 'version-teller version inspection exited 7: 3.8.1',
    },
    {
        name: 'text without a version',
        script: 'console.log("unrecognized output");',
        state: 'error',
        found: undefined,
        note: 'version-teller did not report a valid version: unrecognized output',
    },
    { name: 'a version on stderr', script: 'console.error("3.8.1");', state: 'ok', found: '3.8.1', note: undefined },
    {
        name: 'a version between color codes',
        script: String.raw`console.log("version-teller \u001b[1;36m3.8.1\u001b[0m using more");`,
        state: 'ok',
        found: '3.8.1',
        note: undefined,
    },
] as const;
