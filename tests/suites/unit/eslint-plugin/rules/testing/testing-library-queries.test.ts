import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { testingLibraryQueries } from '#eslint-plugin/rules/testing/testing-library-queries.ts';

buildRuleTester().run('testing-library-queries', testingLibraryQueries, {
    valid: [
        'import { screen } from "@testing-library/react";\nexpect(screen.getByText("Saved")).toBeInTheDocument();',
        'import { screen } from "@testing-library/react";\nexpect(screen.queryByText("Saved")).not.toBeInTheDocument();',
        'import { screen } from "./screen";\nexpect(screen.getByText("Saved")).toBeNull();',
        'import { screen, waitFor } from "@testing-library/react";\nawait waitFor(() => { expect(screen.getByText("Saved")).toBeNull(); });',
        'import { screen, waitForElementToBeRemoved } from "@testing-library/react";\nawait waitForElementToBeRemoved(() => screen.queryByText("Saving"));',
        'import { screen, waitForElementToBeRemoved } from "@testing-library/react";\nawait waitForElementToBeRemoved(screen.getByText("Saving"));',
        'import { screen } from "@testing-library/react";\nexpect(element).toBeTruthy();',
        'import { screen } from "@testing-library/react";\nexpect(load()[0]).toBeTruthy();',
        'import { screen } from "@testing-library/react";\nwrapper(element).toBeTruthy();',
    ],
    invalid: [
        ...['@testing-library/react', '@testing-library/react/pure'].map((module) => ({
            code: `import { screen } from "${module}";\nexpect(screen.getByText("Saved")).not.toBeInTheDocument();`,
            output: `import { screen } from "${module}";\nexpect(screen.queryByText("Saved")).not.toBeInTheDocument();`,
            errors: [{ messageId: 'absence' as const, line: 2 }],
        })),
        ...['[0]', '.length'].map((access) => ({
            code: `import { screen } from "@testing-library/vue";\nexpect(screen.queryAllByRole("row")${access}).toBeTruthy();`,
            output: `import { screen } from "@testing-library/vue";\nexpect(screen.getAllByRole("row")${access}).toBeTruthy();`,
            errors: [{ messageId: 'presence' as const, line: 2 }],
        })),
        {
            code: 'import { screen, waitForElementToBeRemoved } from "@testing-library/react";\nawait waitForElementToBeRemoved(() => screen.getByText("Saving"));',
            output: 'import { screen, waitForElementToBeRemoved } from "@testing-library/react";\nawait waitForElementToBeRemoved(() => screen.queryByText("Saving"));',
            errors: [{ messageId: 'throwingQuery', line: 2 }],
        },
        {
            code: 'import * as library from "@testing-library/react";\nawait library.waitForElementToBeRemoved(library.screen.findByText("Saving"));',
            errors: [{ messageId: 'asyncQuery', line: 2 }],
        },
    ],
});
