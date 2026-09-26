import { z } from 'zod';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import type { stylelintRequest } from '#cli/evaluation/protocol.ts';

const reportSchema = z.object({
    results: z
        .array(
            z.object({
                invalidOptionWarnings: z.array(z.object({ text: z.string() })),
                parseErrors: z.array(z.unknown()),
                warnings: z.array(z.object({ text: z.string() })),
            }),
        )
        .min(1),
});

/**
 * Validate carried rule names and options with the repository's installed Stylelint before retirement.
 * @param request the repository root and the rules to validate
 * @returns true once every rule is accepted
 */
export async function evaluateStylelint(request: z.infer<typeof stylelintRequest>): Promise<true> {
    const require = createRequire(join(request.root, 'package.json'));
    const installed = z.object({ version: z.string() }).parse(require('stylelint/package.json'));
    if (installed.version !== request.version)
        throw new Error(
            `Stylelint adoption requires the configuration version ${request.version}; the installed version is ${installed.version}.`,
        );
    const loaded = await import(pathToFileURL(require.resolve('stylelint')).href);
    const stylelint = loaded.default as {
        lint: (options: { code: string; config: { rules: Record<string, unknown> } }) => Promise<unknown>;
    };
    const report = reportSchema.parse(
        await stylelint.lint({
            code: 'a { color: red; }',
            config: { rules: request.rules },
        }),
    );
    const invalid = report.results.flatMap((result) => [
        ...result.invalidOptionWarnings.map((warning) => warning.text),
        ...result.warnings.filter((warning) => warning.text.startsWith('Unknown rule ')).map((warning) => warning.text),
    ]);
    if (invalid.length > 0 || report.results.some((result) => result.parseErrors.length > 0))
        throw new Error(`Stylelint configuration cannot be adopted: ${invalid.join('; ')}`);
    return true;
}
