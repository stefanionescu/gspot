---
layer: framework
preset: express
title: Express
---

# Express

## HTTP Handler Rules

Routes adapt HTTP to domain calls. They do not own validation policy, database
access, provider mechanics, prompts, caching, or business decisions.

```ts
// Bad: route owns validation, database access, provider behavior, and response policy.
router.post('/orders', async (req, res) => {
    const { accountId, itemIds } = req.body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
        res.status(400).json({ error: 'Bad items' });
        return;
    }

    const account = await database.from('accounts').select('*').eq('id', accountId);
    const providerResponse = await fetch(env.PAYMENT_PROVIDER_URL, {
        method: 'POST',
        body: JSON.stringify({ account, itemIds }),
    });

    res.json(await providerResponse.json());
});
```

```ts
// Good: route is an HTTP adapter.
router.post(
    '/',
    validateRequest(submitOrderContract.request),
    asyncRoute(async (req, res) => {
        const request = req as AuthenticatedRequest;
        res.setHeader('Cache-Control', NO_STORE_CACHE_HEADER);

        const authenticated = requireAuthenticatedRequest(request, res);
        if (!authenticated) return;

        const validated = getValidatedRequest(authenticated.request);
        const trace = extractRequestTrace(authenticated.request, 'orders.submit');

        const result = await submitOrder(authenticated.userId, validated.body, trace);

        if (!result.success) {
            sendError(res, result.error.status, result.error.code, result.error.message, result.error.details);
            return;
        }

        sendOk(res, result.response);
    }),
);
```

Middleware rules:

- Middleware can validate, authenticate, rate-limit, attach context, and enforce ownership. `enforced-by: security/semgrep`
- Middleware cannot make feature decisions. `enforced-by: security/semgrep`
- Middleware cannot call the database for product behavior except through auth or ownership helpers designed for that boundary. `enforced-by: security/semgrep`
- Business permission checks belong in a module or ownership middleware, depending on whether the rule is transport-level or domain-level. `enforced-by: security/semgrep`
- Every async route or middleware must use `asyncRoute()` or explicitly catch
  and pass errors to `next(error)`. `enforced-by: typescript/eslint @typescript-eslint/no-floating-promises`
- Do not rely on framework promise auto-forwarding unless the API standard is
  deliberately migrated to that behavior. `enforced-by: typescript/eslint @typescript-eslint/no-floating-promises`

HTTP edge rules:

- Reject unsupported content types for body-bearing endpoints that only accept JSON. `enforced-by: security/semgrep`
- Keep JSON body limits route-specific when payload sizes differ by feature. `enforced-by: security/semgrep`
- Match large payload limits with reverse-proxy and provider limits. `enforced-by: security/semgrep`
- Remember that body parsing itself is work. Do not parse large JSON bodies on routes that do not need them. `enforced-by: security/semgrep`
- Put broad rate limits at nginx or the load balancer when available. `enforced-by: security/semgrep`
- Put app-specific rate limits in Express middleware. `enforced-by: security/semgrep`
- Put route-specific limits next to route assembly in the app factory or the endpoint owner. `unenforced`
- Enable `trust proxy` only when the deployment topology is known and load-balancer forwarding headers are trusted. `enforced-by: security/semgrep`
- Choose one compression owner. Prefer reverse-proxy compression for high-traffic production; avoid accidental double compression. `enforced-by: security/semgrep`
- Do not hide authorization backdoors behind headers, query params, or test-only middleware. `enforced-by: security/semgrep`

```ts
// Bad: every endpoint silently inherits an oversized JSON parser.
app.use(express.json({ limit: '50mb' }));

// Good: small default, with larger limits only where the endpoint owner needs them.
app.use(API_ROUTE_IMPORT_FILE, express.json({ limit: FILE_IMPORT_JSON_BODY_LIMIT }), importFileRouter);
app.use(express.json({ limit: DEFAULT_JSON_BODY_LIMIT }));
```

## Function Shape and Parameters

API functions expose domain inputs and API/module result contracts, not
transport or provider mechanics.

Rules:

- Use domain types for IDs where available. `enforced-by: typescript/eslint boundaries/element-types`
- Do not pass raw request/response, provider, or database objects across
  layers. `enforced-by: typescript/eslint boundaries/element-types`
- Return types must reflect the module or API result contract. `enforced-by: typescript/eslint zod/require-strict`

```ts
// Bad.
export async function submitOrder(req: AuthenticatedRequest) {}

// Good.
export async function submitOrder(request: SubmitOrderRequest, trace: RequestTrace): Promise<SubmitOrderResult> {}
```
