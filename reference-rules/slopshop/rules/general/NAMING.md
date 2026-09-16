# Naming

Use this guide to name files, directories, and declarations in TypeScript,
JavaScript, and Bash. It explains how to choose a name; the automated quality checks
enforce the configured limits, banned terms, and exceptions.

A **local name** is a name this project controls. An **external name** is fixed by a
framework, library, generated file, or public interface. Preserve external names
when changing them would break that interface.

## Contents

- [Authority and enforcement](#authority-and-enforcement)
- [Names describe responsibilities](#names-describe-responsibilities)
- [Vocabulary and role words](#vocabulary-and-role-words)
- [Functions and retrieval](#functions-and-retrieval)
- [Booleans and predicates](#booleans-and-predicates)
- [Files and directories](#files-and-directories)
- [Next.js and React conventions](#nextjs-and-react-conventions)
- [TypeScript and JavaScript](#typescript-and-javascript)
- [Boundaries and external names](#boundaries-and-external-names)
- [Bash](#bash)
- [Tests](#tests)
- [Review checklist](#review-checklist)

## Authority and enforcement

Naming decisions must satisfy this guide and the quality checks.

Identifier restrictions do not require replacing familiar words in prose. Use
established terms such as "package manager" and "process control" when explaining
tools. Preserve literal commands, option names, and quoted error messages.

- Apply the naming checks for the affected application or tooling scope.
- If this guide and a configured check disagree, correct the guide or configuration
  responsible for the mismatch. Do not
  bypass a rule with an alias, quoted property, or renamed wrapper.
- Preserve exact platform, framework, SDK, and generated contract names.
- A required external name does not grant a broad exception to unrelated local names.
- Generated code can retain generator-owned names. Handwritten surrounding code
  follows the project policy.
- Do not change the naming policy to make an unrelated feature pass.

## Names describe responsibilities

Choose the shortest name that clearly communicates the domain concept at its use site.

- Name what a value means or does. Avoid names that only repeat its data type or how it is stored.
- Use the same vocabulary for the same concept across a feature.
- Use singular nouns for single values and plural nouns for collections.
- Name a keyed collection by its contents and key when useful: `usersById`.
- Avoid private abbreviations or shortening words by deleting letters.
- Let the enclosing type, module, or directory supply context. Add qualifiers only
  when two concepts would otherwise be ambiguous at the same use site.
- Avoid repeating a type in a value name, such as `nameString`, `roleArray`, or `userObject`.

```ts
type Profile = {
    displayName: string;
    avatarUrl: string;
};

const profiles = await getProfiles();
const profileCount = profiles.length;
```

Use `displayName` inside `Profile`, rather than `profileDisplayName`. Keep enough
context on a standalone export for its callers to understand it.

## Vocabulary and role words

Use a role word only when it describes a real responsibility. Do not add a class, interface, or another layer just to use a suffix.

| Role word     | Responsibility                                             |
| ------------- | ---------------------------------------------------------- |
| `Repository`  | Domain-facing access to persisted or remote domain values. |
| `Client`      | An external HTTP, SDK, storage, or platform boundary.      |
| `Coordinator` | A real navigation or workflow state owner.                 |
| `Router`      | Route selection or a framework-owned router.               |
| `Factory`     | Instance construction and dependency assembly.             |
| `Formatter`   | Conversion into display or wire text.                      |
| `Parser`      | Conversion from raw input into structured values.          |
| `Validator`   | Checking a value and reporting invalidity.                 |
| `Mapper`      | Conversion between explicitly different representations.   |
| `Store`       | Ownership of mutable state or persistence mechanics.       |
| `Provider`    | Supplying a capability or context value.                   |
| `Adapter`     | Bridging two different interfaces.                         |

Do not use `Manager`, `Service`, `Helper`, `Utils`, or inflated quality adjectives
to hide an unnamed responsibility. Follow exact exemptions in the quality policy.
A shared directory needs a clear purpose. Do not put unrelated operations there
solely because more than one file could use them.

Name React components for the UI they present, such as `ProfileHeader` or
`CheckoutForm`. Use the application's existing React structure rather than introducing a different
presentation architecture just to follow a naming pattern.

## Functions and retrieval

Function names describe an operation and the domain being acted on.

- Use `get` for application-owned retrieval from memory, files, caches, databases,
  storage, SDKs, and remote APIs.
- Use a singular or plural noun to express one value or a collection. Let the return
  type express optionality and asynchronous work.
- Do not switch between `read`, `find`, `fetch`, `load`, and `list` as synonyms for
  an application-owned retrieval operation. Preserve external APIs such as `fetch`
  and library methods exactly.
- Use `set` for directly assigning a supplied value.
- Use `insert`, `update`, and `delete` for the corresponding persistence operations.
- Use `add` and `remove` for in-memory collection membership.
- Use `create` for a new independent domain value, `make` for constructing dependencies,
  and `build` for assembling a value from existing values.
- Use `parse`, `decode`, `encode`, and `validate` when those are the actual operations.
- Use `assert` only when failure stops normal execution.
- Use a precise domain verb for a workflow, such as `submitOrder`, when it does more
  than one direct CRUD operation.
- Avoid generic operations such as `process`, `handle`, or `doWork` when the action
  can be named. Keep framework-owned callback names unchanged.
- If a name joins several operations, check whether the function does unrelated work.
  Split that work only when the resulting functions have useful responsibilities.

```ts
const session = await getSession(sessionId);
const sessions = await getPaginatedSessions(cursor);
const order = await insertOrder(orderInput);
```

Do not append `Row`, `Value`, or an owner already expressed by the parameters to
every retrieval function. Add a qualifier when it distinguishes real alternatives,
such as `getCachedSession` and `getActiveSession`.

## Booleans and predicates

- Use concise positive states for stored flags and direct domain mappings:
  `enabled`, `active`, or `retryable`.
- Use `is` for computed state, `has` for presence, and `can` for capability.
- Avoid negative names that create double negation at call sites.
- Do not introduce `should` in local names; preserve externally required names such
  as React Hook Form options through the configured external-name exception.
- Name a predicate, a function that answers a yes-or-no question, so callers can
  distinguish it from the value it checks.

```ts
const hasEmail = user.email !== null;
const isReady = status === 'ready';
const canSubmit = isReady && hasEmail;
```

## Files and directories

- Use kebab-case for locally owned JavaScript and TypeScript filenames and directories.
- Name a file for the related behavior it implements or its main export.
- Name a CSS module after the component it styles (`gallery.module.css` beside
  `gallery.tsx`) or after its folder when several components share it. Hook files
  are named after what they observe (`hooks/media-query.ts`); the function starts with `use`.
- Keep feature behavior within the feature. Move it to a shared module only when
  existing callers need the same behavior.
- Avoid generic type buckets and unrelated `utils` collections.
- Keep small features in one directory until subdirectories make related files easier to find.
- Avoid redundant filename prefixes when the enclosing directory already supplies
  that context, following the configured scope of the folder checks.
- Preserve ecosystem configuration filenames, generated paths, and framework route syntax.
- Retain existing file/function limits, barrel rules, and folder checks. Naming is
  not a reason to bypass those checks or create tiny files solely to fit a limit.

Do not create a monorepo project hierarchy for this application.

## Next.js and React conventions

- Use PascalCase for React components and camelCase for ordinary functions and values.
- Use the `use` prefix for actual React hooks, not ordinary functions.
- Preserve Next.js special filenames, default exports, HTTP method exports, and
  names such as `generateMetadata` and `generateStaticParams`.
- Preserve route groups, dynamic segments, private folders, and parallel route slots.
  Their brackets, parentheses, underscores, and `@` prefixes are framework syntax.
- Keep event prop contracts such as `onChange` and `onBlur` intact. Name the local
  operation by the behavior it performs when the framework does not require that name.
- Do not rename framework or library options just to make them resemble local names.

## TypeScript and JavaScript

| Declaration                                        | Convention       |
| -------------------------------------------------- | ---------------- |
| Types, classes, constructors, React components     | PascalCase       |
| Functions, parameters, values, local properties    | camelCase        |
| Module constants with a conventional fixed meaning | UPPER_SNAKE_CASE |
| Source filenames and directories                   | kebab-case       |

- Use descriptive generic parameter names when a single `T` does not make the role clear.
- Do not prefix interfaces with `I`. Express optional values in the type, not by
  adding words such as `Optional` to its name.
- Treat abbreviations as words in local names, such as `parseHttpUrl`; preserve
  external spellings such as `XMLHttpRequest`.
- Preserve named import spellings unless a collision requires an alias. An alias
  should explain the domain or source that distinguishes it.
- Namespace import aliases describe the imported module. Preserve conventional
  library namespace forms already used by the project.
- Prefer named exports, while preserving required ecosystem defaults.
- Keep a blank line after the import block. Naming changes must not remove it.
- Follow [TYPESCRIPT.md](TYPESCRIPT.md) for type modeling and declaration placement;
  this guide does not define a second language policy.

## Boundaries and external names

Preserve external field names in wire payloads, generated types, validation schemas,
and stored-data formats. When the application uses a different representation,
convert it explicitly at the point where it receives that data.

- Use `Request`, `Response`, `DTO`, or `Row` only when that suffix describes the shape.
- Do not carry storage suffixes into domain entities or UI state merely because a
  value originated in a database.
- Name conversion functions for their operation and domain concept; avoid repeating
  all parameter and return types in the name.
- Treat a public name change as a contract change, including route parameters,
  environment variables, and operational log fields.
- Keep environment names and protocol fields owned by providers exactly as specified.
- Keep log field names stable and specific. Do not use vague fields to conceal several meanings.

## Bash

- Use kebab-case for shell file stems unless a tool owns the filename.
- Keep Git hooks and mise file tasks extensionless in their existing locations.
  Standalone Bash scripts and sourced libraries may use `.sh`; do not rename the
  existing task entry points to impose a different convention.
- Use snake_case for functions and mutable local variables, and UPPER_SNAKE_CASE
  for constants and externally configured environment values.
- Preserve externally supplied names such as `MISE_PROJECT_ROOT`.
- Do not reuse shell-special names such as `HOME` or `PATH` for unrelated values.
- Name functions by their action, or by the value they deliberately print to stdout.
- Avoid collisions with shell builtins and common commands.
- Use `name() { ...; }`, without the `function` keyword.
- Name loop variables for their contents. Reserve temporary-path names for actual
  temporary files or directories.

Follow [BASH.md](BASH.md) for argument handling, execution, documentation, and verification.

## Tests

Name tests for their scenario and observable outcome, not private helper names.
Choose test values that explain the relevant condition.

- Prefer descriptions such as “rejects an expired session” over “works” or “test one”.
- Name setup functions by the state or behavior they create.
- Avoid a global collection of unexplained test values shared by unrelated scenarios.
- Preserve library-required fixture APIs and test file conventions; locally owned
  names still follow the configured policy.

## Review checklist

- Does the name describe a real role or domain concept?
- Does its owner already provide some of the words?
- Are singular/plural and predicate conventions clear at the use site?
- Does a role suffix describe an actual boundary rather than an invented layer?
- Are framework and external contract names preserved?
- Does the file belong with the feature or tooling responsibility it serves?
- Do the naming checks pass without exceptions that cover unrelated names?
