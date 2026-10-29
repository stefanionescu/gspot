export const EXTERNAL_COMMAND_GUIDE = `Run commands from the repository root.

\`\`\`shell
gspot init --from ../api/gspot.toml --dry-run
curl -fsSL -o ../team.toml https://raw.githubusercontent.com/acme/policies/<commit>/gspot.toml
gh api "repos/acme/policies/contents/gspot.toml?ref=<commit>" -H "Accept: application/vnd.github.raw" > ../team.toml
gspot init --from ../team.toml
cat ./src/here.ts ./src/missing.ts
\`\`\`

An Accept: application/vnd.github.raw header does not hide src/absent.ts.
See \`../src/missing.ts\` beside \`../src/here.ts\`.
`;

export const EXTERNAL_COMMAND_FINDINGS = [
    { line: 8, message: './src/missing.ts names no tracked file or folder.' },
    { line: 11, message: 'src/absent.ts names no tracked file or folder.' },
    { line: 12, message: '../src/missing.ts names no tracked file or folder.' },
] as const;
