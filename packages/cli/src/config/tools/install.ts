export const SETUP = 'Run: gspot apply, then gspot install';

export const VERSION_TIMEOUT_MS = 15_000;

export const HOST_HINTS: Record<string, string> = {
    tsc: 'Run: npm install --save-dev typescript',
    'drizzle-kit': 'Run: npm install --save-dev drizzle-kit',
    wrangler: 'Run: npm install --save-dev wrangler',
    vitest: 'Run: npm install --save-dev vitest',
    pytest: 'Run: python -m pip install pytest',
    xcodebuild: 'install Xcode from the App Store',
    plutil: 'install Xcode from the App Store',
    xcstringstool: 'install Xcode from the App Store',
    docker: 'install Docker Desktop or the docker engine',
    bash: 'install Bash 4.4 or newer, such as with brew install bash on macOS',
};

export const TOOL_ENV = { NO_COLOR: '1', FORCE_COLOR: '0' };

/** Maximum characters retained after installation diagnostics have been redacted. */
export const INSTALL_OUTPUT_LIMIT = 4000;

export const SECRET_ENVIRONMENT_KEY = /(?:token|password|secret|credential|private[_-]?key|(?:^|[:_])(?:auth|key))$/iu;

export const URL_CREDENTIALS = /(https?:\/\/)[^\s/@]+@/giu;

export const CREDENTIAL_ASSIGNMENT =
    /((?:_authToken|_auth|_password|password|token|secret|credential)\s*[=:]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/giu;

export const AUTHORIZATION_HEADER = /(authorization\s*:\s*)(?:bearer|basic)\s+[^\s]+/giu;
