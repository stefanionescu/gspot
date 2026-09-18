---
layer: code
preset: naming
title: Naming Files
---

# Naming Files

Casing across languages, file and directory names, boundary and external names, and test names.
The vocabulary and function-name rules are in the Naming file.

## Casing across languages

Each language naming file states its own case table. These decisions hold across every language so `unenforced`
the same concept reads the same way at every boundary.

| Concern               | Rule                                                                                                                                                                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acronyms              | Follow the language: TypeScript, JavaScript treat them as words (`parseHttpUrl`, `userId`); Swift keeps uppercase initialisms (`avatarURL`, `userID`, `apiClient` at the start of a name); Python, SQL, Bash lowercase them inside snake_case (`http_url`, `user_id`). A platform name keeps its spelling (`XMLHttpRequest`). |
| Directories           | kebab-case for TypeScript, JavaScript, Bash, HTML, CSS, and static sites; snake_case for Python packages; PascalCase for Swift directories, which mirror type names.                                                                                                                                                          |
| Test files            | `<name>.test.ts` (never `.spec`); `test_<module>.py` mirroring the package path; `<Type>Tests.swift`; pgTAP files under `tests/`. The directory is `tests/`, never `__tests__`, `test/`, or `spec/`. Support code lives under `tests/support/`.                                                                               |
| Booleans              | TypeScript, JavaScript, Swift, Python: `is`, `has`, `can`, `did`, `will` prefix (`isEnabled`, `has_token`). SQL columns: the bare predicate (`enabled`, `retryable`), no `is_` prefix.                                                                                                                                        |
| Identifiers           | `userID` in Swift, `userId` in TypeScript and JSON, `user_id` in Python and SQL. The boundary that maps a row to a response translates the casing; domain code never sees both.                                                                                                                                               |
| On the wire           | JSON bodies and query parameters camelCase; headers `X-Kebab-Case`; URL path segments kebab-case plural nouns; environment variables `UPPER_SNAKE_CASE`; log event names `lower_snake_case`.                                                                                                                                  |
| Environment variables | `UPPER_SNAKE_CASE`, named by the external contract. No application prefix is required; platform-owned names are kept verbatim.                                                                                                                                                                                                |
| Constants             | Module-level constants bound to a literal or a frozen object are `UPPER_SNAKE_CASE` in TypeScript, JavaScript, Python, and Bash, and lowerCamelCase in Swift.                                                                                                                                                                 |

## Files and directories

Files and directories define ownership. Name them for the behavior or entity
they own, not for reuse intent.

Rules:

- File names follow the language-specific case rules below. `unenforced`
- A source file with one primary top-level type is named after that type when
  the language uses primary-type filenames. `unenforced`
- A module file is named after the cohesive capability it owns. `unenforced`
- Do not create catch-all files or directories for unrelated code. `unenforced`
- Do not move code into shared locations for a caller that does not exist yet. `unenforced`
- Promote shared code only when there is a repeated concept and a stable owner. `unenforced`
- A directory named by a broad layer is acceptable only when the project
  architecture explicitly owns that layer. `unenforced`
- Prefer feature ownership over top-level type buckets. `unenforced`
- No directory is named `common`, `core`, `helper`, `helpers`, `util`, `utils`, `support`,
  `misc`, `shared`, or after a language or runtime (`bash`, `javascript`, `python`, `node`,
  `js`). Name it for what it owns. `unenforced`
- A leaf directory holds more than one code file. One file in a folder is a file, not a folder. `unenforced`
- Sibling files do not share a leading name part: `asset-card.ts`, `asset-list.ts`, and
  `asset-row.ts` in one folder are an `asset/` directory with `card.ts`, `list.ts`, `row.ts`. `unenforced`
- A file stem never equals a sibling directory name: `orders.ts` beside `orders/` is a collision. `unenforced`
- A file name is a whole-part match against the same banned term list as identifiers. `unenforced`
- A generated artifact (a test result, a report, a build output) may carry a timestamp in its name;
  hand-written source never does. `unenforced`

Bad:

```text
Helpers.swift
Managers.swift
Data.swift
LoginStuff.swift
Extensions.swift
common-utils.ts
src/helpers/
src/models/
```

Good:

```text
LoginView.swift
LoginViewModel.swift
LoginViewState.swift
AccountRepository.swift
FileUploadClient.swift
UIViewController+ChildContainment.swift
email-address-validation.ts
session-token-verifier.ts
src/accounts/
src/accounts/avatar/
```

## Boundaries and external names

External systems often use names that do not match the domain language. Keep
those names at the boundary and translate them intentionally.

Rules:

- Preserve external field names in DTOs, SQL rows, generated types, wire
  payloads, and validation schemas when changing them misrepresents the contract. `unenforced`
- Translate provider names into domain names before passing values into domain
  or presentation layers. `unenforced`
- Do not leak provider, database, storage, or HTTP mechanics into ViewModels,
  domain entities, use cases, or API-facing response names. `unenforced`
- If a name is part of an external contract, treat renaming it as a contract
  change. `unenforced`
- Use explicit mapping names when crossing layers. `unenforced`

Bad:

```ts
type ProviderOutput = {
    providerOperationId: string;
    providerStatus: string;
};
```

Good:

```ts
type ProviderSubmitOrderResponse = {
    providerOperationId: string;
    providerStatus: string;
};

type SubmittedOrder = {
    providerOperationId: ProviderOperationId;
    status: OrderStatus;
};
```

Bad:

```swift
struct Message {
    let storage_object_path: String
}
```

Good:

```swift
struct MessageAttachmentDTO: Decodable {
    let storage_object_path: String
}

struct MessageAttachment {
    let attachmentPath: StoragePath
}
```

## Tests

Test names and test data names describe observable behavior, not private `unenforced`
implementation details.

Rules:

- Name tests for the behavior and expected outcome. `unenforced`
- Use descriptive unique values for names, emails, IDs, queue names, event IDs,
  resource IDs, and external references. `unenforced`
- Avoid names tied to private helper names. `unenforced`
- Avoid test data names that hide the scenario. `unenforced`
- Test helpers are named for the behavior they create. `unenforced`
- Test fixtures never become global mystery data. `unenforced`
- A test name is a sentence stating the scenario and the expected outcome. `edge cases`,
  `happy path`, `works`, `test1`, and `underTest` are banned. `unenforced`
- Support code lives under `tests/support/`; `fixtures/`, `mocks/`, `helpers/`, and `utils/`
  are banned directory names in test trees. `unenforced`
- Test file names follow the language table in "Casing Across Languages". `unenforced`

Bad:

```ts
describe('Calendar', () => {
    it('2/29/2020', () => {});
    it('throws', () => {});
});
```

Good:

```ts
describe('Calendar', () => {
    it('handles leap year dates', () => {});
    it('throws when the date format is invalid', () => {});
});
```

Bad:

```swift
func test1() throws { }
func testMessages() async throws { }
```

Good:

```swift
func testMessagesShowUnreadMessagesFirst() async throws { }
func testSubmitButtonTappedShowsValidationErrorWhenEmailIsInvalid() async throws { }
```

## Review checklist

Before `gspot check`, read the change against these questions:

- Does the name describe the role or domain concept instead of the type shape? `unenforced`
- Is the name clear at the call site? `unenforced`
- Is context supplied by the owner omitted from the local name? `unenforced`
- Does the name avoid vague role words unless the role is real? `unenforced`
- Does the name use the language-specific case rule? `unenforced`
- Does the file or directory name describe ownership? `unenforced`
- Does the function name name the action and domain item? `unenforced`
- Do application-owned retrieval operations consistently use `get`? `unenforced`
- Does each boolean read as a positive assertion? `unenforced`
- Are external names isolated to boundary types? `unenforced`
- Are SQL and API names treated as contracts? `unenforced`
- Does the name satisfy the automated naming checks for the affected scope? `unenforced`
- Does the name use the correct Python or Bash case rule? `unenforced`
- Are model, data, and result names treated as contracts? `unenforced`
- Does the name satisfy `pyproject.toml` and the local quality rules under `quality/`? `unenforced`
- Does the name identify the owner? `unenforced`
- Does the name match the repo boundary it lives in? `unenforced`
- Does the name avoid copied app-stack concepts that do not exist in this repo? `unenforced`
- Does the name avoid vague words and compatibility language? `unenforced`
- Does each route, page, content file, and asset path match the generated site contract? `unenforced`
- Does the name satisfy `quality/repository/naming` for the affected scope? `unenforced`
- Does the name describe a real role or domain concept? `unenforced`
- Does its owner already provide some of the words? `unenforced`
- Are singular/plural and predicate conventions clear at the use site? `unenforced`
- Does a role suffix describe an actual boundary rather than an invented layer? `unenforced`
- Are framework and external contract names preserved? `unenforced`
- Does the file belong with the feature or tooling responsibility it serves? `unenforced`
- Do the naming checks pass without exceptions that cover unrelated names? `unenforced`
