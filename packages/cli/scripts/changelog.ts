// Prints the material for the CHANGELOG.md section of one CLI version. `mise run changelog <version>` runs it on Bun.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

type Commit = { hash: string; subject: string; body: string };

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/u;
const CHANGE_SUBJECT = /^(?:feat|fix|perf)(?:\((?<scope>[^)]*)\))?!?: /u;
const BREAKING_SUBJECT = /^\w+(?:\([^)]*\))?!: /u;
const BREAKING_PARAGRAPH = /^BREAKING CHANGE:.*(?:\n(?!\n).*)*/mu;
const FIELD_SEPARATOR = '\0';
const RECORD_SEPARATOR = '\u{1E}';
const COMMIT_FORMAT = `%h%x00%s%x00%b%x1E`;
const COMPARE_URL = 'https://github.com/stefanionescu/gspot/compare';
const NO_SCOPE = 'no scope';

const run = promisify(execFile);
// The changelog task runs this script from the root of the repository.
const root = process.cwd();

async function runGit(gitArguments: string[]): Promise<string | undefined> {
    try {
        const { stdout } = await run('git', gitArguments, { cwd: root, maxBuffer: Infinity });
        return stdout.trim();
    } catch (error) {
        if (error instanceof Error && 'code' in error && typeof error.code === 'number') return undefined;
        throw error;
    }
}

function parseCommits(log: string): Commit[] {
    return log
        .split(RECORD_SEPARATOR)
        .map((record) => record.trim())
        .filter((record) => record !== '')
        .map((record) => {
            const [hash = '', subject = '', body = ''] = record.split(FIELD_SEPARATOR);
            return { hash, subject, body };
        });
}

function formatBreaking(commits: Commit[]): string[] {
    const breaking = commits.filter(
        ({ subject, body }) => BREAKING_SUBJECT.test(subject) || BREAKING_PARAGRAPH.test(body),
    );
    return breaking.flatMap(({ hash, subject, body }) => {
        const paragraph = BREAKING_PARAGRAPH.exec(body)?.[0];
        return [`- ${hash} ${subject}`, ...(paragraph === undefined ? [] : [`  ${paragraph.replaceAll('\n', ' ')}`])];
    });
}

function formatChanges(commits: Commit[]): string[] {
    const changes = commits.filter(({ subject }) => CHANGE_SUBJECT.test(subject));
    const scopes = Map.groupBy(changes, ({ subject }) => CHANGE_SUBJECT.exec(subject)?.groups?.['scope'] ?? NO_SCOPE);
    return [...scopes].flatMap(([scope, listed]) => [
        `### ${scope}`,
        '',
        ...listed.map(({ hash, subject }) => `- ${hash} ${subject}`),
        '',
    ]);
}

async function buildMaterial(version: string): Promise<string> {
    if (!VERSION_PATTERN.test(version)) throw new Error(`Give the version as MAJOR.MINOR.PATCH, not "${version}".`);
    const tag = `v${version}`;
    const end = (await runGit(['rev-parse', '-q', '--verify', `refs/tags/${tag}`])) === undefined ? 'HEAD' : tag;
    const previous = await runGit(['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', '--exclude', tag, end]);
    const range = previous === undefined ? end : `${previous}..${end}`;
    const log = await runGit(['log', '--no-merges', `--format=${COMMIT_FORMAT}`, range]);
    if (log === undefined) throw new Error(`Git could not list the commits up to ${end}.`);
    const commits = parseCommits(log);
    return [
        `Material for the ${version} section of CHANGELOG.md. A commit subject is raw material, not an entry.`,
        '',
        ...(previous === undefined ? [] : [`${COMPARE_URL}/${previous}...${tag}`, '']),
        '## Breaking commits',
        '',
        ...formatBreaking(commits),
        '',
        '## Features, fixes, and performance, by scope',
        '',
        ...formatChanges(commits),
    ].join('\n');
}

process.stdout.write(`${await buildMaterial(process.argv[2] ?? '')}\n`);
