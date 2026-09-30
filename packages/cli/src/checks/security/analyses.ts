// The security analyses, by the name a manifest check gives them.
import type { Engine } from '#cli/types/checks.ts';
import { codeql } from '#cli/checks/security/codeql.ts';
import { envFiles } from '#cli/checks/security/env/files.ts';
import { envExample } from '#cli/checks/security/env/example.ts';
import { gitleaksBaseline } from '#cli/checks/security/gitleaks-baseline.ts';

export const SECURITY_ANALYSES: Record<string, Engine> = {
    'env-example': envExample,
    'env-files': envFiles,
    codeql,
    'gitleaks-baseline': gitleaksBaseline,
};
