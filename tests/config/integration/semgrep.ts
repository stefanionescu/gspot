import { BASE_INSTALLED_FILES } from '#tests/config/integration/commands.ts';

export const FASTAPI_PROJECT = `[project]
name = "example"
version = "1.0.0"
dependencies = ["fastapi"]
`;

export const SEMGREP_CHECK_ID = 'security/semgrep';

export const SEMGREP_CHECK = ['check', '--only', SEMGREP_CHECK_ID, '--json'] as const;

export const SEMGREP_SANDBOX = {
    configurations: ['typescript', 'python', 'bash', 'security', 'fastapi'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;

export const FASTAPI_SCOPE_SETTINGS = `[[scope]]
path = "app"
configurations = ["fastapi"]

[[scope]]
path = "app/child"

[[scope]]
path = "sibling"
`;

export const FASTAPI_SOURCE = `from fastapi import HTTPException

def lookup():
    try:
        return load_user()
    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
`;

export const FASTAPI_CONFIGURATION_CASES = [
    {
        rule: 'cors-wildcard-with-credentials',
        source: 'app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True)\n',
        fixed: 'app.add_middleware(CORSMiddleware, allow_origins=["https://example.test"], allow_credentials=True)\n',
    },
    { rule: 'debug-enabled', source: 'app = FastAPI(debug=True)\n', fixed: 'app = FastAPI(debug=False)\n' },
] as const;

export const REPOSITORY_RULE = `rules:
    - id: test-no-double
      pattern: double(...)
      message: The test rule of the repository fires here.
      languages: [typescript]
      severity: ERROR
`;

export const REPOSITORY_BASH_RULE = `rules:
    - id: test-no-eval
      pattern: eval ...
      message: The test rule of the repository fires here.
      languages: [bash]
      severity: ERROR
`;

export const MALFORMED_SEMGREP_RESULTS = [
    {
        check: 'security/semgrep',
        status: 'failed',
        findings: [{ file: 'scripts/café build.sh', line: 1, column: 1, rule: 'parse-error' }],
    },
] as const;
