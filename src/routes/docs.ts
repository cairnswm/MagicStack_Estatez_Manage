import { Router, Request, Response } from 'express';

const router = Router();
const basePath = (process.env.BASE_PATH || '').replace(/\/$/, '');
const docsPath = `${basePath}/docs`;

function withBasePath(path: string) {
  return `${basePath}${path}` || path;
}

function renderPage(title: string, body: string) {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <link rel="icon" type="image/svg+xml" href="${basePath}/logo.svg" />
        <link rel="stylesheet" href="https://cdn.runeworkz.com/styles.css" />
      </head>
      <body class="app-shell">
        ${body}
      </body>
    </html>
  `;
}

router.get('/', (_req: Request, res: Response) => {
  const page = renderPage('MagicStack API Help', `
    <header class="site-header">
      <img src="${basePath}/logo.svg" alt="MagicStack logo" class="site-logo" />
      <span class="base-url">${basePath || '/'}</span>
      <h1>MagicStack API</h1>
      <p>Node.js and Express API template with tenant-aware routes, health checks, and payment integration.</p>
    </header>

    <nav class="site-nav">
      <a href="${docsPath}/payments">Payments docs</a>
    </nav>

    <main class="content-shell">

      <section class="doc-card">
        <div class="doc-card-header">
          <span class="http-method GET">GET</span>
          <div>
            <div class="endpoint-path">${docsPath}/</div>
            <div class="doc-card-title">Help docs</div>
          </div>
        </div>
        <div class="doc-card-body">
          <p class="doc-card-description">This page. Lists all available routes, environment variables, and links to detailed docs for each area.</p>

          <div class="two-column">
            <section class="surface">
              <h3>Core routes</h3>
              <ul>
                <li><code>GET /health</code></li>
                <li><code>GET /db/health</code></li>
                <li><code>GET /tenant/*</code></li>
              </ul>
            </section>
            <section class="surface">
              <h3>Payment routes</h3>
              <ul>
                <li><code>POST /payment</code></li>
                <li><code>POST /payment/webhook</code></li>
                <li><code>GET ${docsPath}/payments</code></li>
              </ul>
            </section>
          </div>
        </div>
      </section>

      <section class="doc-card">
        <div class="doc-card-header">
          <span class="http-method GET">GET</span>
          <div>
            <div class="endpoint-path">/health</div>
            <div class="doc-card-title">Service health</div>
          </div>
        </div>
        <div class="doc-card-body">
          <p class="doc-card-description">Returns the service status and deployment timestamp. No authentication required.</p>

          <div class="two-column">
            <section class="surface">
              <h3>Request</h3>
              <p class="muted">Nothing required. No headers, body, or query parameters.</p>
            </section>
            <section class="surface">
              <h3>Response</h3>
              <pre class="code-block">${JSON.stringify({ service: 'sample', status: 'ok', deployed_at: 'unknown' }, null, 2)}</pre>
            </section>
          </div>
        </div>
      </section>

      <section class="doc-card">
        <div class="doc-card-header">
          <span class="http-method GET">GET</span>
          <div>
            <div class="endpoint-path">/db/health</div>
            <div class="doc-card-title">Database health</div>
          </div>
        </div>
        <div class="doc-card-body">
          <p class="doc-card-description">Verifies the API can acquire a connection from the MySQL pool and execute a query. Returns <code>503</code> if the connection fails.</p>

          <div class="two-column">
            <section class="surface">
              <h3>Request</h3>
              <p class="muted">Nothing required. No headers, body, or query parameters.</p>
            </section>
            <section class="surface">
              <h3>Response</h3>
              <pre class="code-block">${JSON.stringify({ service: 'sample', status: 'ok', deployed_at: null, message: 'Database connection successful', database: 'your_db' }, null, 2)}</pre>
              <p class="muted">Returns <code>503</code> with <code>"status": "error"</code> when the connection fails.</p>
            </section>
          </div>
        </div>
      </section>

    </main>
  `);

  res.type('html').send(page);
});

router.get('/payments', (_req: Request, res: Response) => {
  const page = renderPage('Payments Docs', `
    <header class="site-header">
      <img src="${basePath}/logo.svg" alt="MagicStack logo" class="site-logo" />
      <span class="base-url">${docsPath}</span>
      <h1>Payments docs</h1>
      <p>This endpoint creates a payment and stores the initial order state. The webhook later updates the same order row to <strong>succeeded</strong> or <strong>failed</strong>.</p>
    </header>

    <nav class="site-nav">
      <a href="${docsPath}/">Home</a>
      <a href="${docsPath}/health">Health</a>
      <a href="${docsPath}/payments">Payments docs</a>
    </nav>

    <main class="content-shell">
      <section class="doc-card">
        <div class="doc-card-header">
          <span class="http-method POST">POST</span>
          <div>
            <div class="endpoint-path">/payment</div>
            <div class="doc-card-title">Create a payment</div>
          </div>
        </div>
        <div class="doc-card-body">
          <p class="doc-card-description">Send your payment creation payload here. Include an order identifier, user id, and customer email so the row can be matched later by the webhook.</p>

          <section class="surface">
            <h3>Expected request fields</h3>
            <table class="data-table">
              <thead>
                <tr><th>Field</th><th>Notes</th></tr>
              </thead>
              <tbody>
                <tr><td><code>orderId</code></td><td>Required. Used as <code>orders.order_id</code>.</td></tr>
                <tr><td><code>amount</code></td><td>Required. Sent to the payment service.</td></tr>
                <tr><td><code>currency</code></td><td>Required. Example: <code>ZAR</code>.</td></tr>
                <tr><td><code>customer.email</code></td><td>Required. Passed through to the payment service.</td></tr>
                <tr><td><code>userId</code></td><td>Required. Stored in payment metadata.</td></tr>
              </tbody>
            </table>
          </section>

          <section class="surface">
            <h3>Flow</h3>
            <ol>
              <li>The API forwards the request to the configured payments service.</li>
              <li>The API stores a pending order row in the <code>orders</code> table.</li>
              <li>The webhook updates the row when payment status changes.</li>
            </ol>
          </section>

          <section class="surface">
            <h3>Webhook</h3>
            <p class="muted">Register this URL in the payment provider dashboard:</p>
            <pre class="code-block">${withBasePath('/payment/webhook')}</pre>
          </section>

          <section class="surface">
            <h3>Webhook payload shape</h3>
            <pre class="code-block">{
  "event": "charge.success",
  "data": {
    "id": 6181112847,
    "status": "success",
    "reference": "pay-...-ORDER-94-87",
    "currency": "ZAR",
    "metadata": {
      "tenantId": "tenant-uuid",
      "orderId": "ORDER-94",
      "paymentId": "87",
      "userId": "41",
      "customerEmail": "cairnswm@gmail.com"
    }
  }
}</pre>
          </section>

          <section class="surface">
            <h3>Database schema</h3>
            <p class="muted">The <code>orders</code> and <code>payment_webhook</code> tables must be created before using the payment routes. See <code>scripts/orders.sql</code> and <code>scripts/payment_webhook.sql</code>.</p>
          </section>
        </div>
      </section>
    </main>
  `);

  res.type('html').send(page);
});

router.get('/health', (_req: Request, res: Response) => {
  const page = renderPage('Health Docs', `
    <header class="site-header">
      <img src="${basePath}/logo.svg" alt="MagicStack logo" class="site-logo" />
      <span class="base-url">${docsPath}</span>
      <h1>Health check</h1>
      <p>Returns the service status and deployment timestamp.</p>
    </header>

    <nav class="site-nav">
      <a href="${docsPath}/">Home</a>
      <a href="${docsPath}/db-health">Database</a>
      <a href="${docsPath}/payments">Payments docs</a>
    </nav>

    <main class="content-shell">
      <section class="doc-card">
        <div class="doc-card-header">
          <span class="http-method GET">GET</span>
          <div>
            <div class="endpoint-path">/health</div>
            <div class="doc-card-title">Service health</div>
          </div>
        </div>
        <div class="doc-card-body">
          <p class="doc-card-description">No authentication required. Returns service status and the deployment timestamp from the <code>DEPLOYED_AT</code> environment variable.</p>

          <section class="surface">
            <h3>Example response</h3>
            <pre class="code-block">${JSON.stringify({ service: 'sample', status: 'ok', deployed_at: 'unknown' }, null, 2)}</pre>
          </section>
        </div>
      </section>
    </main>
  `);

  res.type('html').send(page);
});

router.get('/db-health', (_req: Request, res: Response) => {
  const page = renderPage('Database Health Docs', `
    <header class="site-header">
      <img src="${basePath}/logo.svg" alt="MagicStack logo" class="site-logo" />
      <span class="base-url">${docsPath}</span>
      <h1>Database health check</h1>
      <p>Verifies that the API can acquire a connection from the MySQL pool and execute a query.</p>
    </header>

    <nav class="site-nav">
      <a href="${docsPath}/">Home</a>
      <a href="${docsPath}/health">Health</a>
      <a href="${docsPath}/payments">Payments docs</a>
    </nav>

    <main class="content-shell">
      <section class="doc-card">
        <div class="doc-card-header">
          <span class="http-method GET">GET</span>
          <div>
            <div class="endpoint-path">/db/health</div>
            <div class="doc-card-title">Database health</div>
          </div>
        </div>
        <div class="doc-card-body">
          <p class="doc-card-description">No authentication required. Runs <code>SELECT 1</code> against the configured database and returns the result. Returns <code>503</code> if the connection fails.</p>

          <section class="surface">
            <h3>Success response</h3>
            <pre class="code-block">${JSON.stringify({ service: 'sample', status: 'ok', deployed_at: null, message: 'Database connection successful', database: 'your_db' }, null, 2)}</pre>
          </section>

          <section class="surface">
            <h3>Failure response <span class="muted">(503)</span></h3>
            <pre class="code-block">${JSON.stringify({ service: 'sample', status: 'error', message: 'Database connection failed', error: 'reason' }, null, 2)}</pre>
          </section>
        </div>
      </section>
    </main>
  `);

  res.type('html').send(page);
});

export default router;
