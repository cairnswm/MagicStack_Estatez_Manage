# Structure

This is a nodejs and express api template

All routes should be in their won route file.

Do not install new libraries unless expressly asked to do so by the user

All code should be in typescript

# Code Style

Use camelCase for variable and function names.

Files should not exceed 300 lines long. if file exceed this length suggest to the user that the file needs refactoring.


## Utility helpers added

The repository includes a few small utility modules to standardize tenant handling, database access, and JWT extraction/validation. Add or use these helpers in routes and middleware where appropriate.

- `src/utils/tenant.ts`: Tenant helpers
	- `getTenantId(req: Request): string` — returns the tenant id from `x-tenant-id` header (case-insensitive) or `req.query.tenantId`.
	- `requireTenant(req, res, next)` — express middleware that returns `400` when tenant id is missing; stores tenant id on `res.locals.tenantId` for downstream handlers.
	- `getTenantOrRespond(req, res): string | null` — returns tenant id or responds with `400`.

- `src/utils/db.ts`: Database access pattern
	- `withConnection(fn)` — acquires a connection from the pool, runs `fn(conn)`, and always releases the connection in `finally`.
	- `query(sql, params)` — convenience wrapper that runs a query using the `withConnection` pattern and returns rows.

- `src/utils/authClient.ts`: JWT helpers
	- `getUserJwt(req: Request): string | undefined` — extracts the `Authorization` header and ensures a `Bearer ` prefix (returns undefined when no header present).
	- `validateToken(bearerToken: string)` — existing function that calls the configured auth API to validate tokens.

Use these helpers to keep routes small and to prevent connection leaks and inconsistent tenant checks.

- `src/utils/formatters.ts`: Formatting helpers
	- `parseJsonFields(row: any): any` — inspects an object's string fields and attempts to JSON.parse them; when a field contains JSON it replaces the string with the parsed object. Useful for rows returned from the DB where JSON is stored as text.
	- `successResponse(data: any): { data: any }` — standard success envelope for API responses.
	- `errorResponse(message: string): { error: { message: string } }` — standard error envelope for API responses.

Use `parseJsonFields` to normalize DB rows before returning them, and use `successResponse` / `errorResponse` to keep API responses consistent.

Tenant middleware:
- Use the `requireTenant` middleware from `src/middleware/tenantMiddleware.ts` to enforce a tenant on routes. It returns a `400` when no tenant is provided and sets the tenant id on `res.locals.tenantId` for handlers. For optional checks, use `getTenantId(req)` from `src/utils/tenant.ts` directly.

## Conventions enforced by code review

- **Never redefine `getTenantId` locally in a route file.** Always import it from `src/utils/tenant.ts`. Route-local variants (e.g. checking `req.params.id` or `req.params.tenantId`) are dead code — those params are never set by the existing route definitions.
- **Never call `pool.getConnection()` directly in route handlers.** Always use `withConnection(fn)` from `src/utils/db.ts`; it guarantees the connection is released in `finally` and prevents pool exhaustion.
- **Never construct `{ error: { message } }` or `{ data: ... }` inline.** Use `errorResponse(message)` and `successResponse(data)` from `src/utils/formatters.ts` so all API responses stay consistent.
- **Do not make network calls inside `tenantUtils.getProperty` / `tenantUtils.getSetting`.** These helpers should read from the already-cached `tenantUtils.properties` / `tenantUtils.settings` populated during middleware init. Only `tenantUtils.refresh()` should call `fetchTenant` again.
- **Do not duplicate the global fetch guard.** `src/utils/authClient.ts` exposes a `getFetch()` helper; use it rather than re-checking `globalThis.fetch` in every function.

