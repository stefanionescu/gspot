# Next.js

## Next.js application rules

Use App Router. Update affected routes and callers together; do not maintain a parallel Pages
Router implementation or compatibility routes.

An **owner** is the module or component responsible for a behavior or state value. A **contract**
defines the inputs, outputs, and behavior that callers rely on. A **boundary** is a point where code
or data passes between those responsibilities, such as from server code to browser code. Name the
responsible module and the required behavior when designing or reviewing such a boundary.

### Before writing code

- Check the package manifest and lockfile for the installed Next.js and React versions. Identify the
  router, runtime, deployment adapter, and cache model before changing rendering. Check the
  TypeScript, ESLint, styling, data, and internationalization setup. Use the installed APIs.
- Find the existing components, schemas, queries, actions, design tokens, and state that support the
  feature. Reuse them when they fit. Keep helpers local until several callers need the same
  behavior. Add folders when they clarify a responsibility in the application.
- Keep application and tool dependencies compatible. Use one package manager and committed lockfile
  per installation boundary. Align `eslint-config-next` with the application's Next release. Never
  copy old Tailwind, tRPC, Virtua, or authentication configuration without checking its API.

### Structure and routing

- Put routing in `src/app`, domain behavior in `src/features`, shared UI in `src/components`,
  integrations in `src/lib` or `src/server`, and framework configuration at the application root.
  Keep an existing root `app` layout consistent. Use feature folders and `_components` where they
  clarify ownership.
- Use route files for routing and assembling the page. Keep a small page in `page.tsx` when that is
  clear. Extract a component or module when it has its own UI, data, or domain responsibility.
- Follow Next.js special filenames and exports. A `page` exposes UI; a `route` exposes an HTTP
  endpoint. Put them in different route segments.
- Use `(group)` folders to organize routes without adding URL segments. Use `_private` folders to
  exclude their contents from routing. Check whether different groups resolve to the same URL.
  Preserve framework default exports and route folder names containing brackets, parentheses, or
  `@`.
- Keep dependency direction clear: routes compose features; features consume shared infrastructure
  and UI; shared modules do not import feature or route implementations. Cross-feature dependencies
  must have a clear public contract and no cycle. Separate browser-safe schemas/types from server
  implementations. Avoid barrels that mix server and client runtime exports.
- Root layouts provide document elements. `error.tsx` is a Client Component; an error boundary does
  not catch its own segment's layout failure. Use a parent boundary or `global-error` when
  appropriate. Global error UI must be able to replace the document and work without the normal
  providers.
- Use parallel or intercepted routes only for an actual navigation requirement. Verify direct load,
  soft navigation, Back/Forward, refresh, and default slot behavior. Interception changes how the
  destination is presented; it does not mean the URL never changes. Multiple root layouts cause full
  page navigation between them.

### Assigning files to an owner

Before adding a file, decide which route, feature, shared control, or platform integration is
responsible for it. Choose a directory that makes that responsibility clear. Move misplaced code
when changing it, and update its callers. Avoid collecting unrelated behavior in a `utils` folder.

- Keep route-specific composition beside its route. Private `_components` and `_lib` folders are
  useful when they make that locality explicit.
- Keep domain operations with their feature when both UI and server behavior represent that feature.
  A feature may contain server modules, UI, validation, and local hooks without exporting all of
  them through a barrel.
- Move a component into shared UI when multiple real consumers use the same presentation/interaction
  contract. Shared components receive domain-neutral values and callbacks; they do not fetch
  arbitrary domain entities internally.
- Keep an integration's credentials, transport setup, and runtime selection at its integration
  owner. Domain code should not construct another database or provider client to work around an
  inconvenient existing API.
- Colocate a schema with the contract it validates. A browser-safe input schema must not import the
  privileged implementation of the operation it describes.
- Keep ordinary local props and helper types next to their implementation. Generated database types
  and shared external contracts have distinct owners.
- Import the narrow module that owns a symbol. Do not depend on a root barrel whose exports span
  database access, React hooks, UI, and runtime configuration.
- When a move is required, update all callers, import aliases, and framework references.
  Update affected tests only when the user explicitly requests test changes; otherwise report the
  needed follow-up. Delete superseded code instead of keeping a second path.

When one feature depends on another, define the public API it uses and the direction of the import.
If both features need each other's internal code, extract the shared operation or reorganize the
modules until the cycle is gone. Keep one implementation of the shared behavior.

### Compose feature screens

Build feature screens in a consistent order: the route renders the feature layout; the layout
arranges sections; each section renders feature components and shared controls. Use this structure
when the application has several interactive features.

A feature layout owns the arrangement of the screen: its header, main content, side panels,
scrolling regions, and persistent input areas. A section owns a recognizable part of the task, such
as a search results area, conversation history, editor input, or navigation strip. Components
implement the controls and content inside that section.

- Keep route files focused on framework input, metadata, server composition, and the feature entry.
  Do not put the whole interactive screen into `page.tsx`.
- Use layouts to arrange sections and control screen geometry. Put queries, editor callbacks, and
  row rendering in the sections or components that use them.
- Keep a section's data loading, pending state, and error handling together. Keep unrelated sections
  usable while that section loads or recovers from a failure.
- Keep domain components inside their feature. A conversation message, product result, or account
  picker is not a generic shared primitive just because it is reused in two places within that
  feature.
- Put buttons, inputs, dialogs, popovers, tooltips, and other domain-neutral primitives in shared
  UI. Their props express their interaction contract rather than importing the feature that happens
  to use them first.
- Import downward through the hierarchy. A component does not import its section, and a section does
  not import its containing layout. Share a smaller operation or component when siblings need the
  same behavior.
- Create a section because it owns a meaningful responsibility. Do not add empty layout/section
  wrappers solely to reproduce every folder in the convention.
- When a screen outgrows a component, refactor its responsibilities into this hierarchy and update
  its callers. Do not preserve a monolithic component by adding more flags, callbacks, and unrelated
  state to it.

Use `features/<feature>/ui/layouts`, `ui/sections`, and `ui/components` as the normal layout for
feature UI. Small features can keep local files together until these owners exist. App Router's
reserved `layout.tsx` remains the framework entry; a feature layout is an ordinary component with
its own descriptive name.

### Keep sections usable during loading and failure

Place loading and error handling around the section doing the work. Keep the page layout,
navigation, and independent sections available while that section loads. During a slow history
fetch, keep an editor usable unless editing depends on the missing history.

- Place the Suspense/query loading boundary around the section that waits. Do not await its work
  above the intended boundary and then expect the boundary to display a fallback for that
  already-awaited work.
- Keep section skeletons alongside their section or feature. Match the important geometry: header
  height, row/media space, and the scroll viewport's constraints.
- Distinguish the first load from background refresh and next-page loading. Keep usable content
  mounted during refresh and page-fetch failure.
- Scope retry to the failed operation. Retrying a sidebar request should not reset a draft in an
  unrelated editor or discard a history scroll anchor.
- Give each failure a recovery action that can resolve it. Preserve the original error in safe
  server diagnostics and show a translated error message in the UI.
- Keep route-level error boundaries for failures that escape section recovery. Verify root/global
  error UI separately because its usual providers may be absent.
- When switching resources, reset the section's identity and pending state deliberately. Do not
  allow an old request to populate a newly selected section.

### Stream independent sections

Use streaming to reveal useful content while independent work completes. On an initial App Router
load, HTML and the embedded React Server Component payload arrive progressively. Client navigation
uses the component payload to update the existing tree. Verify both paths.

- Use `loading.tsx` for the segment's page and descendants. Its boundary sits inside the segment's
  layout, so it does not cover work awaited by that layout. Place a boundary around the actual
  consumer when the layout contains an independently loading section.
- Use sibling `<Suspense>` boundaries for sections that can become useful independently. Use nested
  boundaries when detail should appear after its containing section. Choose boundaries by the user's
  task rather than wrapping every component.
- Move request-dependent reads into the component that needs them. Pass `params`, `searchParams`, or
  a server-created data promise down where supported, and resolve it under the intended boundary.
  Start independent work early without moving protected reads ahead of authorization.
- With Cache Components, inspect which work can enter the prerendered shell. An async function is
  not automatically request-specific, and `<Suspense>` alone does not make synchronous work dynamic.
  Handle uncached reads, runtime inputs, and nondeterministic output according to the active model.
- Use supported Suspense data sources. Fetching in an effect or event handler does not make its
  pending state activate a surrounding boundary automatically.
- Keep promise identity stable across client rerenders. A Server Component can pass a promise whose
  resolved value is safe to serialize; a Client Component can read it with React `use()` under
  Suspense. Share that promise through a narrowly placed client provider when several consumers need
  it. Keep request-specific promises out of process-global state.
- Handle rejected promises through the appropriate error boundary or an explicit result value. Keep
  `use()` out of `try`/`catch`. Suspense provides loading UI; it does not replace error handling.
- Keep important headings and likely largest-content elements in early content when their data is
  available. Preloading an image can start its download earlier, but the image still waits to be
  revealed if its boundary has not resolved.
- Reserve realistic space for resolved content and keep fallbacks localized and accessible. Measure
  layout shifts and interaction responsiveness as well as time to the first response byte.
- Let React manage streamed DOM replacement and hydration. Keep application code independent of
  private payload markers, inline swap scripts, and generated boundary IDs.

See [Next.js streaming](https://nextjs.org/docs/app/guides/streaming),
[React Suspense](https://react.dev/reference/react/Suspense), and
[reading promises with React use](https://react.dev/reference/react/use).

### Preserve status codes and metadata while streaming

Choose the response status, headers, and cookies before the response is committed. After streaming
begins, a late error cannot change an already-sent success status.

- When an actual HTTP redirect, not-found status, or other rejection is required, complete that
  decision before any enclosing boundary can send a fallback. Calling `notFound()` before the first
  boundary written in a page does not guarantee this: an ancestor `loading.tsx` or Suspense boundary
  may already have started the response. Verify the complete route's HTTP behavior.
- Account for streamed not-found and redirect behavior. A late not-found result can retain the
  original status while adding indexing metadata; a late redirect can use streamed client behavior.
  Check status, rendered outcome, and indexing metadata separately.
- Place error recovery at the intended section or route boundary. A route-level `error.tsx` can
  replace more than one section. Verify the failure scope instead of assuming a failed component
  alone disappears.
- Keep authorization at the protected operation even when an early proxy redirect helps navigation.
  Do not send private content while waiting to decide whether the caller may receive it.
- Verify metadata for ordinary browsers, DOM-capable crawlers, and HTML-limited crawlers relevant to
  the application. Check `htmlLimitedBots` and streaming metadata behavior for the installed
  release. Avoid assuming every crawler receives one fully buffered document.
- Keep shell dependencies available when the route renders at request time. Check crawler requests
  and cold renders when normal visitors usually receive a prerendered shell.

See
[loading behavior and status codes](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
and
[Next.js streaming HTTP behavior](https://nextjs.org/docs/app/guides/streaming#the-http-contract).

### Special file responsibilities

Use each framework file for its defined purpose. Next.js chooses when to render or call these files
based on their names and exports.

| File or convention | Responsibility                                      | What to check                                                           |
| ------------------ | --------------------------------------------------- | ----------------------------------------------------------------------- |
| `page`             | Public UI at a route                                | Parse route inputs; compose the feature; preserve metadata support      |
| `layout`           | Shared UI across descendant navigation              | Do not use persistence as a substitute for fresh authorization          |
| `template`         | A subtree that remounts with its framework identity | Use only when remount semantics are required                            |
| `loading`          | Segment-level pending UI                            | Its placement controls which content is replaced while waiting          |
| `error`            | Recoverable render failure below its boundary       | Client entry; useful reset/recovery; safe error presentation            |
| `global-error`     | Root failure replacement                            | Supply document elements and avoid dependence on failed providers       |
| `not-found`        | Missing or intentionally undisclosed resource       | Keep resource absence distinct from a generic crash                     |
| `route`            | HTTP endpoint using Request/Response                | No page at that segment; own method, validation, and response contract  |
| `default`          | Parallel slot fallback                              | Verify refresh/direct navigation when a slot has no active match        |
| Route group        | Organization without adding a path segment          | Two groups can still collide at the same public URL                     |
| Private folder     | Excluded route subtree                              | Ordinary colocation is safe too; underscore is an organizational choice |

Keep the surrounding page usable while a section loads. Loading another table page should replace
that table's loading area, not the entire application. Put an error boundary outside the section
that can fail, and provide local recovery for an isolated request failure.

For modal interception and parallel routes, write down what direct navigation renders and what a
soft transition renders. Test refresh and Back from both states. A modal route that works only when
entered through one particular click path is incomplete. Do not create a hidden second page with
duplicated loading/data logic just to avoid understanding the router's composition contract.

### Server and client boundaries

React Server Components (RSC) run their component code on the server. Server-side rendering (SSR)
produces initial HTML; it can include both Server and Client Components. Keep this distinction clear
when deciding which code ships to the browser.

- Pages/layouts stay Server Components by default in App Router. Place `'use client'` at an
  interactive entry that needs browser state, effects, or browser APIs. Imported modules join that
  client graph even without their own directive. A Client Component can also render on the server
  during initial load.
- Keep credentials, database access, authorization, and privileged integrations in server modules.
  Add `import 'server-only'` to their runtime owners. A file named `server.ts` is not automatically
  protected. Public env prefixes, TypeScript types, and hiding controls are not security boundaries.
- Pass only necessary React-serializable data across RSC boundaries. Do not serialize full database
  rows or secrets. Plain event callbacks cannot cross; Server Functions cross as references. React
  serialization is not the same as JSON or a tRPC transformer's serialization contract.
- React supports values including `Date`, `Map`, and `Set` across Server Component boundaries.
  Do not add SuperJSON solely to pass these values as supported React props. Use it where an
  actual JSON transport needs richer types. Do not add the Babel or SWC SuperJSON plugins from
  Pages Router data-hook examples to this App Router setup. See
  [React's serializable types](https://react.dev/reference/rsc/use-client#serializable-types-returned-by-server-components).
- Compose server-rendered children into interactive wrappers from a Server Component. Do not import
  a server implementation into a client module to achieve that composition. Place providers at their
  lowest useful common ancestor. Providers may accept server-rendered children without turning those
  children's implementations into client code.
- Browser access and initial rendered output must be hydration safe. Do not read localStorage or
  viewport dimensions during server render, generate random keys, or format dates with different
  server/browser assumptions. Use effects for browser synchronization; keep a deterministic initial
  render. `suppressHydrationWarning` requires a narrow, explained exception.

### Designing a client boundary

Choose a client boundary by identifying which code needs to run in the browser and what data it
needs. The client module graph contains the client entry and the modules it imports. Server-rendered
Client Components still ship their JavaScript to the browser.

Use this sequence when splitting a screen:

1. Read data in the responsible server module. Select the fields the user is allowed to see and the
   browser needs. This selected response is the data transfer object (DTO).
2. Identify the behavior that needs event handlers, browser APIs, or state.
3. Keep the surrounding server-rendered layout outside that interactive entry.
4. Pass the minimum necessary values, rendered children, or supported server references into the
   entry.
5. Trace its imports, including shared helpers and re-exports. Browser reachability can grow through
   a helper even when the page itself remains a Server Component.
6. Verify direct load, hydration, and client navigation. Each path should display the expected
   content and support the same interactions.

Use `'use server'` for Server Functions. Follow the framework's rules for their callable exports,
including input validation and authorization. Use `server-only` for modules that contain privileged
implementation code. A client entry can import a supported Server Action reference; keep the
database module called by that action on the server.

A third-party widget with browser-only behavior gets a small client wrapper when needed. Disable SSR
only for a documented browser-only dependency through the supported client-side dynamic import path,
with an intentional loading state. Do not make the whole page client-only to fix one widget or a
hydration mismatch.

Providers must be scoped by their actual consumers. A translation, query, theme, or store provider
belongs above the client consumers that need it; it does not need to surround every document
element. Keep request-derived provider state isolated from other requests. Do not initialize a
singleton store with the first request's user or locale and then reuse it on the server.

### Hydration and browser synchronization

Hydration attaches React behavior to the server-rendered HTML. Give the server and the first browser
render matching output. Browser storage, viewport dimensions, generated IDs, time zones, current
time, and random values can make them differ. Define when each value becomes available and how the
UI updates after hydration. Fix the mismatch instead of hiding warnings globally.

- Use deterministic initial props for server-rendered content. Read browser-only state after
  hydration or through a supported external-store pattern.
- Use stable entity identifiers for data identity and React's supported ID mechanism for
  relationships between controls and labels.
- Give date/time formatting the same initial locale, time zone, and reference time where relative
  output would otherwise differ.
- Do not branch rendered markup on `typeof window` as a routine hydration fix. Server and first
  browser output should agree on the visible tree.
- Theme initialization may need the theme library's documented early script and a narrow hydration
  exception. Keep that exception local to the affected node.
- Do not mutate React-owned DOM to coordinate application state. Controlled state, refs, and
  third-party imperative APIs have explicit ownership boundaries.
- Treat a hydration warning as a bug until its source and acceptable exception are identified. A
  development-only warning can reveal a production race.

### Rendering and navigation

- Fetch initial data near its server owner. Do not add a Route Handler just for a Server Component
  to HTTP-fetch its own application. Start independent reads together; keep permission-dependent
  work behind authorization. Use Suspense around the part that waits, with a meaningful, stable
  fallback.
- Select caching explicitly using [Data rules](#data-access-writes-and-caching). RSC,
  server-rendered HTML, request memoization, persistent caching, React Query, and browser/CDN caches
  solve different problems.
- Use version-appropriate request APIs. Next 15 introduced async request APIs; Next 16 requires
  async access to `cookies`, `headers`, route `params`, and page `searchParams`. Do not transplant
  sync Next 14 examples into modern code. Use generated route helpers where supported; generate
  their types before standalone typechecking.
- Use `next/link` for internal navigation, the App Router navigation APIs in App Router, and
  locale-aware wrappers when locale routing is enabled. Keep shareable filters, sort order, and
  pagination in validated URL state. Never pass an untrusted arbitrary URL into a navigation or
  redirect API.
- Model pending, empty, error, and success states. Missing resources use the framework's not-found
  behavior. Handle expected form failures as data; unexpected render failures use error boundaries.
  Do not swallow framework redirect/not-found control flow in broad catches.
- Metadata, canonical URLs, social previews, robots, sitemap, and public content availability match
  the product's indexing policy. Authenticated UI is not protected by robots rules. Use the Metadata
  API rather than competing ad hoc head managers in App Router.

### React effects and state

- Keep renders pure. Effects synchronize external systems; handlers own user-triggered work. Derive
  ordinary values during render rather than synchronizing duplicate state with effects. Clean up
  timers, observers, subscriptions, animation frames, and requests.
- Include every required hook dependency. Fix callbacks that retain outdated values in the component
  or hook that creates them. Memoize when measurements show expensive work or a consumer needs a
  stable reference. Use refs for mutable controller values and state for values displayed in the UI.
- Give each state value one owner: URL for navigation, query cache for server snapshots, form/local
  state for editing, and client store for truly shared client state. Streaming/normalized stores
  need explicit reconciliation. Reset private state across identity and tenant changes; server
  stores are request-scoped.
- Handle every promise by awaiting, returning, or explicitly catching failure. A `void` expression
  alone does not handle rejection. Retries need a retry-safe operation and bounded policy.
  Cancellation must not look like confirmed success.

### Following the rules and verifying changes

- Change the code needed for the requested outcome. Refactor only where the implementation requires
  it; report unrelated violations instead of expanding the task into general cleanup.
- Run lint, typechecks, builds, tests, or browser checks only when explicitly requested. Keep any
  requested verification focused on the change. Do not disable existing checks to hide failures.
- Choose runtime and deployment features for the application. Do not introduce Edge, PWA,
  analytics, or third-party providers without a concrete requirement.

## Data access, writes, and caching

### Share server read operations

- Choose one server data owner per domain. Pages, tRPC, Route Handlers, and Server Actions call the
  same authorized data/service operations where they share behavior. Do not duplicate business rules
  in each transport.
- Read initial route data on the server when it is available there. Avoid mount-effect waterfalls
  and internal HTTP calls to the same app. Parallelize independent reads; authorization precedes
  protected reads.
- Limit queries for growing collections and use a stable sort order. Validate and cap page size on
  the server. Select the fields needed for the first screen. Avoid reading every field or page, and
  avoid making one extra query per returned record (the N+1 query pattern).
- Define response shapes and errors. Check upstream status and validate external data before using
  it. Keep private fields out of DTOs and query dehydration. Do not hide errors as empty successful
  results.

### Validate writes and update cached data

- Validate input, identify the caller, and check authorization before every server write. Recheck
  resource ownership even when a parent page checked it earlier. Use transactions and database
  constraints to keep related changes consistent. For retryable writes, use an idempotency key or
  equivalent mechanism so repeating a request does not repeat its saved effects.
- Identify every cache affected by a write. Merge optimistic UI changes with the server's confirmed
  result. Invalidate the related detail, list, and summary views so they can refresh. Preserve newer
  confirmed changes when cancelling, rolling back, retrying, or merging concurrent edits.
- Pending UI prevents accidental duplicate submissions and communicates progress. Validation errors
  preserve user input and are associated with fields. Unexpected failures have a safe retry path.
  Writes must not occur during rendering, GET requests, or route prefetching.

### Choose a cache policy

For each cached resource, record who can read it, what identifies its cache entry, how long it can
stay fresh, which changes invalidate it, and where it is stored. Keep this information beside the
data operation or in the existing design note.

| Layer                      | Scope and responsibility                                               |
| -------------------------- | ---------------------------------------------------------------------- |
| React request memoization  | Reuse within a server render/request; not a durable shared cache       |
| Next data/UI cache         | Reuse across requests according to the configured model                |
| Prerendered route or shell | HTML/RSC availability and regeneration                                 |
| Router cache               | Client navigation reuse; refreshing is not universal data invalidation |
| TanStack Query             | Browser server-state freshness and mutation reconciliation             |
| HTTP/CDN/service worker    | Response/storage policy outside the component tree                     |

- Determine whether Cache Components is enabled before selecting APIs. Do not mix recipes from
  incompatible models. Do not rely on defaults from Next 14: fetch and GET Route Handler defaults
  changed in Next 15.
- For the previous model, choose appropriate explicit `fetch` cache/revalidation and supported route
  options for the installed release. `React.cache` alone does not make a query persist across
  requests.
- With supported Cache Components enabled, cache only deliberately reusable data/UI with
  `use cache`; assign its lifetime and tags. Put uncached or request-dependent work behind suitable
  Suspense boundaries. Read request values outside shared cached functions and pass validated
  arguments. Do not paste `dynamic = 'force-static'`, `revalidate`, or Edge assumptions into this
  model.
- Keep private data private across every cache layer. Include all relevant identity, tenant, locale,
  filter, and permission dimensions where data is cached. Authorization must remain valid on a cache
  hit; caching a decision must not retain revoked access. Default to uncached sensitive data until a
  concrete isolation and invalidation design exists. Do not use raw session tokens as convenient
  cache keys or tags.
- Match invalidation APIs to their installed contracts. Current Next supports stale-while-revalidate
  through `revalidateTag(tag, 'max')` and immediate read-your-writes through `updateTag` in Server
  Actions. Revalidation of a Next cache does not invalidate a browser query cache automatically.
  Decide whether stale content is acceptable before choosing an API.
- Do not assume process memory persists across serverless requests or is shared across instances.
  Enable remote/private cache variants when the application's caching requirements and deployment
  support call for them.
- Clear private browser caches on logout or identity changes. Service workers must not cache
  authenticated API responses by default. Verify freshness after mutation, refresh, Back navigation,
  and a new session.

Review and exercise cache isolation with at least two users or tenants, including repeated reads,
mutations, logout, and revoked access.

### Set cache lifetimes and storage

With Cache Components enabled, give each `use cache` scope a deliberate `cacheLife` profile. Check
the installed profile values and project overrides instead of assuming a profile name guarantees a
fixed duration across versions.

| Property     | Meaning                                                              |
| ------------ | -------------------------------------------------------------------- |
| `stale`      | How long the client may reuse the result without checking the server |
| `revalidate` | When a later server request can trigger a background refresh         |
| `expire`     | When a later request must wait for a fresh result                    |

- Use supported custom values when named profiles do not match the feature. Check their ordering
  constraints and units. Keep one effective `cacheLife` call per cached function invocation.
- Revalidation is demand-driven; a duration is not a scheduled background job. Check behavior after
  inactivity as well as under frequent requests.
- Check how short lifetimes affect prerendering and prefetch eligibility in the installed release. A
  cache directive does not guarantee that its content joins the static shell.

See [cacheLife](https://nextjs.org/docs/app/api-reference/functions/cacheLife).

Choose a data-level cache for a reusable read and a UI-level cache for reusable rendered output.
Review every export before placing `use cache` at file scope. Keep writes and unrelated operations
outside that scope.

- Account for arguments and captured values in cache identity. Keep request reads outside ordinary
  shared cache scopes and pass validated, nonsecret inputs to reusable reads.
- For per-request random output or time-dependent synchronous reads, use supported request-time APIs
  such as `connection()` at the consuming boundary. Cache such output only when reuse is the
  intended behavior. Synchronous database or filesystem access is not necessarily immutable data.
- Use `use cache: remote` only with a supported handler and a measured need for shared storage.
  Define instance coordination, expiration, and failure behavior. Keep expectations about cache
  survival aligned with deployment and build identity.
- Use `use cache: private` only when the installed release supports the required behavior. Review
  its browser storage, lifetime, and identity changes. A private cache variant does not establish
  authorization or make sensitive serialized data safe automatically.
- Review metadata and viewport functions under the same caching model as the page. Keep their
  runtime reads and freshness requirements consistent with the content they describe.

See [Cache Components](https://nextjs.org/docs/app/getting-started/caching).

### Choose the revalidation operation

Choose revalidation from the required freshness and the server entry point performing the write.
Keep invalidation after a successful commit and before a terminating redirect.

| Required outcome                                                              | Operation                                                                   |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Serve stale content while tagged data refreshes                               | `revalidateTag(tag, 'max')` in a supported server function or Route Handler |
| Let the action's next read wait for its newly written data                    | `updateTag(tag)` in a Server Action                                         |
| Expire tagged data from a webhook or handler where stale data is unacceptable | Supported `revalidateTag(tag, { expire: 0 })` behavior                      |
| Invalidate a route's page or layout output                                    | `revalidatePath(path, type)` with the intended scope                        |

- Attach `cacheTag` inside the cache scope that produces the reusable result. A tag groups entries
  for invalidation; it does not substitute for a complete cache key or an access check.
- Treat `revalidateTag` as marking entries for subsequent reads, not eagerly rebuilding every
  matching page. Use an explicit supported second argument; the one-argument expiration form is
  deprecated. [revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag).
- Keep `updateTag` in Server Actions. A tRPC mutation or API handler does not become a Server Action
  merely because it runs on the server. Match its invalidation path to its real entry point.
  [updateTag](https://nextjs.org/docs/app/api-reference/functions/updateTag).
- Scope `revalidatePath` deliberately. A dynamic route pattern needs the appropriate `page` or
  `layout` type. A layout invalidation covers its descendants. In a Route Handler, revalidation
  occurs on a later visit; it does not push fresh UI into all open browsers.
- Invalidate shared data tags when other routes depend on the same changed resource. Invalidating
  one path does not make every other consumer of its tagged data fresh. Coordinate path and tag
  invalidation when both are needed.
  [revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath).
- Authenticate revalidation webhooks, validate their payloads, and derive allowed tags or paths from
  the verified event. Keep arbitrary caller-supplied invalidation targets out of the endpoint.
- Reconcile TanStack Query, Drizzle caches, and other stored copies separately where applicable.
  Refreshing a browser route alone can reuse unchanged server data.

### Verify cached navigation and prefetching

Check direct visits, client transitions, refresh, and Back/Forward separately. A working initial
shell does not prove the next route's loading and cache behavior is correct.

- Verify known and unknown dynamic parameters. Use `generateStaticParams` for intended prerendered
  values, and check the installed model's behavior for other values and missing resources.
- Inspect the actual prefetched content before forcing `prefetch={true}`. With supported Partial
  Prefetching enabled, URL-dependent cached content can require additional per-link server work.
  Keep prefetch cost bounded on large lists and frequently changing search results.
- Keep prefetching read-only and authorized. Prefetched private data is already browser-accessible;
  hiding the destination's UI does not protect it.
- Verify which fallback appears before a navigation completes, including with a cold cache or a
  disabled prefetch. Do not promise that every explicit Suspense boundary is always prefetched or
  always omitted from prefetching.
- Exercise changed permissions, locale, query parameters, and session identity against prefetched
  results. Confirm invalidation reaches the stored copy used by the next navigation.

See
[Partial Prefetching configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/partialPrefetching).

### Designing cache keys and invalidation

Include every input that changes the result in the cache key. For a public list, these inputs can
include locale, filters, sort order, and cursor. For private data, also separate entries by the
user, tenant, and permissions that affect access. If an input is missing from the key, a later
request can reuse a result intended for a different request.

Review a cached read with these questions:

- Can two users with different permissions request the same apparent resource ID?
- Can the same ID exist under different tenants or projects?
- Does the returned shape or text vary by locale or user preference?
- Can a role change, permission revoke, or deletion make the cached result unsafe?
- Which writes change this value, and which aggregate/list/detail views depend on it?
- Where is each cached copy stored and how is it invalidated on every instance?
- What happens immediately after the initiating user saves a change?

Make these choices visible in the cached function's inputs and invalidation code. Use tags to mark
entries for invalidation, and check authorization separately. Include tenant identity in a tag when
invalidation needs to affect one tenant. Add tags for dependent views so they refresh together.
Build keys from nonsecret IDs taken from verified request context. Keep access checks current and
keep session tokens out of cache keys.

When a mutation updates several related entities, invalidate after the transaction commits. An
invalidation fired before a transaction commits can repopulate the cache with old values. If the
write commits but invalidation fails, report that the write succeeded and handle the refresh failure
separately. Retry invalidation or tell the user how to refresh, as the product requires. Do not
retry the entire write and risk creating a duplicate operation.

Optimistic UI displays a change before the server confirms it. Define how overlapping updates are
merged and how a failed update is undone. A rollback must preserve newer confirmed data. Use entity
versions, mutation IDs, or the query library's update and invalidation flow to distinguish updates.
Test two overlapping edits as well as one isolated request.

### Distinguishing read outcomes

Do not collapse all read states into `data ? content : spinner`. That condition cannot distinguish a
successful empty collection from a fetch that never started.

| State                            | Behavior                                                                    |
| -------------------------------- | --------------------------------------------------------------------------- |
| Initial request pending          | Render a meaningful loading fallback with stable geometry                   |
| Successful empty collection      | Explain absence and offer the appropriate next action                       |
| Initial request fails            | Present safe error/retry UI; do not pretend the collection is empty         |
| Background refresh               | Keep the last usable result visible and show unobtrusive progress if useful |
| Next page pending                | Keep all existing rows and indicate progress at the paging boundary         |
| Next page fails                  | Keep existing rows and cursor state; expose an explicit retry               |
| Resource no longer accessible    | Remove private stale data and follow the authorization/not-found contract   |
| Request superseded by navigation | Cancel or ignore completion; do not overwrite the new resource              |

Represent these states in both server-rendered screens and client query screens. Use Suspense while
rendering waits for data. Represent validation failures and empty results as expected outcomes, with
their own UI, rather than throwing them as infrastructure errors.

### Choosing an operation transport

Choose the transport from the consumer and behavior, not from a desire to use every Next.js API. A
Server Component can call an authorized server read directly. A browser interaction can use the
app's existing tRPC mutation or a Server Action. An external caller or webhook needs an HTTP
contract. These entry points can share the domain operation without sharing their transport-specific
response shape.

Keep Route Handlers focused on five steps: extract input, validate it, establish request context,
call the domain operation, and format the response. Apply the same separation to Server Actions,
using their framework serialization, error, and redirect behavior. Let server code call shared
server operations directly instead of making an HTTP request to its own application.

## References

Use documentation matching the installed release and enabled features.

| Topic                                      | Primary source                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Route organization and reserved files      | [Next.js project structure](https://nextjs.org/docs/app/getting-started/project-structure)               |
| RSC imports, props, providers, server-only | [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) |
| Server/client execution model              | [Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary)              |
| Async APIs and migration compatibility     | [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)                      |
| HTTP handler contracts                     | [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)                             |
| Cache Components enabled                   | [Caching](https://nextjs.org/docs/app/getting-started/caching)                                           |
| Cache Components disabled                  | [Previous caching model](https://nextjs.org/docs/app/guides/caching-without-cache-components)            |
| Cache invalidation                         | [Revalidating](https://nextjs.org/docs/app/getting-started/revalidating)                                 |

## Next.js security and runtime boundaries

Authentication identifies the caller. Authorization checks whether that caller can perform the
requested operation. In a multitenant application, a tenant is the account or organization whose
data and permissions the operation uses.

- Treat every Server Action, Route Handler, tRPC procedure, and externally callable operation as an
  independent boundary. Authenticate and authorize at the data/action owner. A protected layout,
  hidden button, request proxy, or client-side redirect alone does not protect an endpoint.
- Derive identity from a verified server session. Restrict reads and writes to resources and tenants
  that the caller can access. Test signed-out callers, another user's resource, another tenant, and
  revoked access. Check permissions on the server instead of trusting a browser-provided role or
  user ID. Database row-level security (RLS) adds access checks; keep admin clients restricted to
  operations that need their authority.
- Validate and bound all external input: bodies, query strings, path parameters, cookies, file
  uploads, cursors, and provider responses. Enforce size and resource limits. Validate file
  type/content and storage access where uploads exist. Raw strings do not become safe because
  TypeScript calls them IDs.
- Keep secrets in server configuration, validate required values, and fail clearly when absent.
  `NEXT_PUBLIC_*` values are public and generally substituted at build time. Avoid exporting server
  configuration through a shared barrel. Server-only markers and build checks enforce module
  boundaries; client environment lint is a limited additional check.
- Expose only safe DTO fields and stable error codes. Logs must not contain session tokens,
  authorization headers, passwords, private messages, full sensitive request bodies, or provider
  credentials. Record enough safe context to diagnose a failure, including correlation IDs where
  useful.
- Use the framework's supported Server Action and origin checks. Protect custom cookie-authenticated
  writes against cross-site request forgery (CSRF). Keep writes out of GET requests. Cross-Origin
  Resource Sharing (CORS) controls browser access to responses; authenticate callers separately.
  Allow credentialed cross-origin requests only from the required origins.
- Route Handlers use the correct method/status/content type and parse failures safely. Verify
  webhook signatures against the required raw body before processing, and handle replay/idempotency.
  Rate-limit costly public operations using deployment-appropriate shared state.
- Allow only approved redirect destinations and external fetch targets when users can influence
  them. Prevent server-side request forgery (SSRF) by checking internal address targets and each
  redirect in a chain. Validate untrusted input and use safe APIs before passing it to SQL, shell
  commands, HTML rendering, or browser navigation.
- Render user content as text or through a reviewed sanitizer. Rich Markdown/HTML links, embedded
  media, and translated rich text need explicit safe protocols/content rules. Do not use
  `dangerouslySetInnerHTML` for unsanitized user or provider output. Configure Content Security
  Policy (CSP) and other security headers for the application. Verify them with its rendering and
  scripts.
- Propagate cancellation and deadlines to streaming/provider work where supported. A disconnected
  browser must not leave avoidable expensive work running indefinitely. Handle partial stream
  failure separately from completion. Avoid unrestricted retries or unbounded request fan-out.
- Keep request state isolated across deployment instances and define which data each cache stores.
  Store sessions, uploads, and jobs in storage that survives instance restarts. Check Node, Edge,
  static export, and deployment adapter support before selecting runtime features. Use shared
  storage when a file or rate limit needs to be visible to several instances.
- Maintain dependency and secret scanning with the repository's tools and hooks. Investigate scanner
  findings and scope each suppression to a reviewed finding with a documented reason.
- Verify authorization and data isolation with negative integration cases and focused boundary
  review. Exercise the deployed application's access controls and runtime configuration.

### Keep configuration out of browser bundles

Keep private environment values out of `next.config.*`'s `env` option. That option makes configured
values available to client bundles regardless of whether their names start with `NEXT_PUBLIC_`. Read
secrets only from server runtime configuration. Expose a browser value through an explicit public
variable or a reviewed public DTO. Do not spread the process environment into build options, webpack
definitions, generated JavaScript, or HTML. See
[Next.js configuration environment variables](https://nextjs.org/docs/app/api-reference/config/next-config-js/env).

- Inspect the composed configuration, including wrappers, imported fragments, and deployment
  substitutions. A browser-only environment lint rule cannot inspect build-time injection by itself.
- Verify the browser output of a production build with harmless marker values when changing secret
  boundaries. Do not use real credentials as test fixtures. If a credential was bundled into a
  delivered asset, removing the source reference alone does not revoke that credential.
- Keep type and lint failures visible. Do not enable `ignoreBuildErrors` or a version-specific
  `ignoreDuringBuilds` escape hatch to make delivery pass.
- Align Next, its ESLint configuration, React, the deployment adapter, and bundler plugins with the
  installed major versions. An older application's working configuration is not evidence that the
  same APIs or adapter work with a newer Next release.

### Check authorization where data is accessed

A redirect in a layout or proxy can improve navigation, but it cannot be the only place an operation
checks access. The operation may be called directly, invoked from a different route, or reached
after a session changes. Recheck access where protected data is read or changed.

Use verified identity consistently across data clients. A server admin/service-role client can
bypass database policy; keep it restricted to operations that explicitly need that authority.
Ordinary user operations should retain the intended user and tenant context. Do not expose such a
client through a shared provider or browser configuration module.

For Supabase, use the supported `@supabase/ssr` integration consistently; do not combine its cookie
ownership with legacy Auth Helpers in the same authentication flow. Keep browser and request-scoped
server clients distinct, and use verified server identity for authorization. A client-side
`getSession()` read may supply a transport token but is not server authorization evidence. See
[Supabase's SSR migration guide](https://supabase.com/docs/guides/auth/server-side/migrating-to-ssr-from-auth-helpers).

When session refresh requires response cookie updates, use the authentication library's supported
integration for the installed Next/runtime release. Keep that behavior out of read-only RSC context
creation. Handle expired and revoked sessions as real transitions, including clearing browser caches
and preventing stale private views from reappearing through Back navigation.

### Render Markdown and rich editors safely

Markdown parsing is not HTML sanitization. `marked` explicitly leaves sanitization to its caller.
Render user and provider messages through one reviewed content boundary: either a renderer that
rejects raw HTML or parsed HTML passed through a maintained sanitizer with a defined allowlist.
Sanitize the final HTML after transformations and before any HTML sink. See
[Marked's sanitization guidance](https://marked.js.org/).

- Cover links, image sources, inline event attributes, embedded frames, SVG, and dangerous URL
  schemes. Do not rely on regex replacements, TypeScript assertions, or trusted-looking model output
  to make markup safe.
- Restrict `dangerouslySetInnerHTML` to a reviewed rendering adapter. The shared preset's
  `react/no-danger` rule requires an explicit local suppression there, with a description naming the
  sanitizer or the exact trusted static source. Keep sanitization tests beside that adapter.
- Apply the same policy to streaming partial messages and final persisted messages. If parsing is
  asynchronous, prevent an older parse from overwriting the latest text or a different message.
- Initialize Tiptap in a Client Component with the installed version's supported SSR behavior,
  including `immediatelyRender: false` where required. Keep extension versions compatible. See
  [Tiptap's Next.js integration](https://tiptap.dev/docs/editor/getting-started/install/nextjs).
- Keep editor updates as editor transactions. Avoid serializing the full document, rewriting HTML,
  and calling `setContent` on every transaction; that can disturb selection, history, and input
  composition. Use supported decorations, marks, or targeted transactions for visual annotations.
- Do not submit while an IME composition is active. Test Enter, Shift+Enter, mobile keyboards,
  multiline paste at the current selection, undo/redo, and the empty-to-nonempty transition.
- Define the saved representation and its size limits. Editor JSON, HTML, and plain text have
  different contracts; an editor extension schema does not make arbitrary saved HTML trusted.

### Scope service workers and private media

Treat the browser's service-worker cache as an additional cache owner. HTTP headers and query-cache
invalidation do not automatically remove a response that a worker explicitly stored.

- Cache only the intended public assets. Exclude authenticated API responses, chat content,
  personalized RSC payloads, signed media URLs, and private media unless a deliberate private
  offline feature defines storage, expiry, logout, and account-switch behavior.
- Match worker routes against actual request URLs, methods, origins, and paths. A broad image-file
  suffix match can include authenticated media; a pathname regex may not match an absolute URL.
- Define cache versioning and worker activation behavior. Test an existing controlled tab during an
  update, offline reload, logout, account switching, and Back navigation. A new worker must not
  discard an unsaved draft or serve another account's content.
- For Supabase Storage, authorize the bucket and object path, not just the existence of a signed-in
  session. Test another user's object and each preview, blurred, watermarked, or transformed
  variant. Enforce resource access in database and storage policies.
- Treat signed URLs as bearer access with an expiry. Keep them out of telemetry and persistent
  shared caches. Bound refresh on expiry and clear account-scoped media/query state at logout.
- Prefer an authorized media delivery mechanism appropriate to the runtime over repeatedly moving
  large base64 media payloads through query caches. Test range requests, expiry during playback,
  interrupted loads, and memory use with several visible videos.
- Clean up image/video listeners, preload work, and object URLs. When `src` changes, ensure a late
  load event cannot mark the new source as loaded or keep a failed preview from blocking recovery.

### Separate telemetry and provider results

Use one initialization owner for browser analytics. Avoid loading both an inline bootstrap and an
SDK provider for the same tracker unless that integration explicitly requires both. Server routes
must use server-compatible telemetry, not import a module that initializes a browser SDK.

- Define allowed event properties. Mask or exclude chat transcripts, editor content, auth inputs,
  tokens, signed URLs, and private identifiers from autocapture and session replay. Verify the
  actual captured payloads, including custom controls and contenteditable elements.
- Reset analytics identity on logout and account switch. Keep anonymous-to-authenticated identity
  changes explicit; a module's prior identity must not label a different user's events.
- Telemetry failure must not replace an operation's intended response, and diagnostic code must not
  throw again while handling the original failure. Bound awaited logging and use the runtime's
  supported lifecycle for deferred work.
- Check an SDK's returned error field as well as caught exceptions. For example,
  `resend.emails.send` can return `{ data, error }`; an awaited call is not by itself proof of
  acceptance. Return success only after confirming the provider result, and distinguish acceptance
  from delivery. See [Resend's Next.js example](https://resend.com/docs/send-with-nextjs).
- Restrict email recipients and sender identity on the server, validate reply-to input, and apply
  abuse controls to public feedback or OTP operations. Keep provider errors out of public responses.

### Endpoint and streaming lifecycle

For each Route Handler, define the allowed body size, content types, HTTP methods, validation,
authorization, error responses, and caching behavior. Check incoming data before processing it.

For each stream, define the signal that confirms completion. Distinguish that signal from an open
connection or partial data. Let the client represent partial output, completion, cancellation,
timeout, and failure after output has started. Define when to save the result and merge it with
existing data for each outcome.

- Propagate an abort signal to upstream work when the provider/runtime supports it.
- Bound total work, token/media size, concurrency, and request lifetime according to the endpoint's
  contract.
- Release readers, timers, subscriptions, and provider resources on completion, cancellation,
  failure, and client disconnect.
- Do not keep producing expensive output after cancellation because a detached promise lost access
  to the request lifecycle.
- Preserve the relationship between temporary browser output and persisted server entities. A retry
  must not silently duplicate the durable operation.
- Sanitize rendered provider/user output through the same content policy as other untrusted input. A
  generated answer is not trusted HTML.
- Keep error details out of a public stream while retaining safe diagnostic context on the server.
  Do not serialize raw upstream exception objects into chunks.

For a raw streaming Route Handler, use the Web Streams API and a defined wire format. Set content
type, cache policy, and other response headers before returning the stream.

- Respect backpressure: pace production when the consumer cannot keep up. Keep queues bounded and
  use supported piping or pull-based production for large output.
- Parse the application format independently of network chunks. A read can contain half a UTF-8
  character, part of a JSON record, or several events. Use incremental decoding and retain an
  incomplete record until it is complete. Define framing for Server-Sent Events or newline-delimited
  JSON rather than assuming one `enqueue` equals one client read.
- Close or cancel file handles and upstream readers according to the runtime's stream ownership
  rules. Stream large files incrementally instead of loading them fully into memory.
- Once headers are committed, report late failures through the defined stream protocol or close the
  failed stream. Do not try to append a second HTTP response or silently mark partial output as
  completed. Follow the existing cancellation and persistence rules above.

For SSE, use an established protocol parser when available. Decode UTF-8 incrementally, preserve
incomplete frames across reads, and dispatch an event only when its separator is complete. Support
the protocol's line endings, comments, and multiline `data:` fields. Do not parse every received
line as a complete event. Validate the parsed event payload instead of asserting its type.

Flush the decoder at end of input and apply the protocol's rule for incomplete trailing data. A
closed socket alone must not invoke a successful completion callback when the provider requires a
terminal event. Bound buffered bytes and accumulated output. Test split multibyte characters, split
JSON, multiple frames in one read, missing terminal events, malformed frames, and cancellation while
blocked in a read. See
[SSE framing](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events).
