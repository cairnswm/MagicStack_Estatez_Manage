import { Router, Request, Response } from 'express';
import { withConnection } from '../utils/db';
import { errorResponse, successResponse } from '../utils/formatters';
import { getTenantOrRespond } from '../utils/tenant';
import { CreatePaymentPayload, CreatePaymentResponse, PaymentWebhookPayload } from '../types/payment';

const router = Router();

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStringFromValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getNumberFromValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getCallerHostname(req: Request): string {
  const referrer = req.headers['referer'] || req.headers['referrer'];
  const origin = req.headers['origin'];
  const raw = (typeof referrer === 'string' ? referrer : '') || (typeof origin === 'string' ? origin : '');

  if (!raw) return '';

  try {
    return new URL(raw).hostname;
  } catch {
    return raw;
  }
}

function getPaymentsApiBaseUrl(): string {
  return process.env.MAGICSTACK_PAYMENT_API || process.env.PAYMENT_API || process.env.PAYMENT_API_URL || '';
}

function getPaymentsApiKey(): string {
  return process.env.PAYMENT_APIKEY || process.env.PAYMENT_API_KEY || process.env.API_KEY || '';
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

function getOrderIdFromPayload(payload: JsonRecord): string | null {
  const candidates = [payload.orderId, payload.externalId, payload.reference, payload.referenceId, payload.order_id];
  for (const candidate of candidates) {
    const orderId = getStringFromValue(candidate);
    if (orderId) {
      return orderId;
    }
  }

  return null;
}

function normalizeCreatePaymentPayload(body: unknown): { valid: true; payload: CreatePaymentPayload } | { valid: false; message: string } {
  if (!isRecord(body)) {
    return { valid: false, message: 'Invalid payment payload' };
  }

  const orderId = getOrderIdFromPayload(body);
  const amount = getNumberFromValue(body.amount);
  const currency = getStringFromValue(body.currency) || 'ZAR';
  const userId = body.userId;
  const customer = isRecord(body.customer) ? body.customer : null;
  const email = customer ? getStringFromValue(customer.email) : null;

  if (!orderId) {
    return { valid: false, message: 'orderId is required to create a payment' };
  }

  if (amount === null) {
    return { valid: false, message: 'amount is required and must be a number' };
  }

  if (!currency) {
    return { valid: false, message: 'currency is required' };
  }

  if (!email) {
    return { valid: false, message: 'customer.email is required' };
  }

  const normalizedUserId = getNumberFromValue(userId) ?? getStringFromValue(userId) ?? undefined;

  return {
    valid: true,
    payload: {
      ...body,
      orderId,
      amount,
      currency,
      customer: {
        ...(customer || {}),
        email,
      },
      ...(normalizedUserId !== undefined ? { userId: normalizedUserId } : {}),
    } as CreatePaymentPayload,
  };
}

function unwrapPaymentResponse(responseData: unknown): unknown {
  if (isRecord(responseData) && 'data' in responseData && responseData.data !== null) {
    return responseData.data;
  }

  return responseData;
}

function getPaymentDetailsFromResponse(responseData: unknown): { paymentId: number | null; redirectUrl: string | null; provider: string | null } {
  const payload = unwrapPaymentResponse(responseData);

  if (!isRecord(payload)) {
    return { paymentId: null, redirectUrl: null, provider: null };
  }

  const nestedData = isRecord(payload.data) ? payload.data : null;
  const paymentRecord = isRecord(payload.payment) ? payload.payment : null;

  const paymentId =
    getNumberFromValue(payload.paymentId) ??
    getNumberFromValue(payload.id) ??
    getNumberFromValue(nestedData?.paymentId) ??
    getNumberFromValue(nestedData?.id) ??
    getNumberFromValue(paymentRecord?.paymentId) ??
    getNumberFromValue(paymentRecord?.id);

  const redirectUrl =
    getStringFromValue(payload.redirectUrl) ??
    getStringFromValue(nestedData?.redirectUrl) ??
    getStringFromValue(paymentRecord?.redirectUrl) ??
    getStringFromValue(paymentRecord?.checkoutUrl) ??
    getStringFromValue(paymentRecord?.checkoutId);

  const provider = getStringFromValue(payload.provider) ?? getStringFromValue(nestedData?.provider) ?? getStringFromValue(paymentRecord?.provider);

  return { paymentId, redirectUrl, provider };
}

function normalizeWebhookStatus(event: string, status: unknown): string {
  const normalizedEvent = event.trim().toLowerCase();
  const normalizedStatus = getStringFromValue(status)?.toLowerCase() || '';

  if (normalizedEvent === 'charge.success' || normalizedStatus === 'success' || normalizedStatus === 'paid' || normalizedStatus === 'succeeded') {
    return 'succeeded';
  }

  if (normalizedEvent === 'charge.failed' || normalizedStatus === 'failed' || normalizedStatus === 'declined') {
    return 'failed';
  }

  if (normalizedStatus) {
    return normalizedStatus;
  }

  return 'pending';
}

function getWebhookIdentifiers(payload: PaymentWebhookPayload): { tenantId: string | null; orderId: string | null; paymentId: number | null } {
  const metadata = payload.data.metadata && isRecord(payload.data.metadata) ? payload.data.metadata : null;

  return {
    tenantId: getStringFromValue(metadata?.tenantId),
    orderId: getStringFromValue(metadata?.orderId),
    paymentId: getNumberFromValue(metadata?.paymentId),
  };
}

function isPaidStatus(status: string | null | undefined): boolean {
  const normalizedStatus = (status || '').trim().toLowerCase();
  return normalizedStatus === 'paid' || normalizedStatus === 'succeeded';
}

async function getExistingOrderStatus(
  conn: { execute: (sql: string, params?: unknown[]) => Promise<unknown> },
  tenantId: string,
  orderId: string,
): Promise<string | null> {
  const [rows] = (await conn.execute(
    `
      SELECT status
      FROM orders
      WHERE tenant_id = ? AND order_id = ?
      LIMIT 1
    `,
    [tenantId, orderId],
  )) as [Array<{ status?: string }>];

  return rows.length > 0 ? rows[0].status || null : null;
}

async function markOrderPending(
  conn: { execute: (sql: string, params?: unknown[]) => Promise<unknown> },
  tenantId: string,
  orderId: string,
  requestPayload: JsonRecord,
): Promise<void> {
  await conn.execute(
    `
      INSERT INTO orders (
        tenant_id,
        order_id,
        payment_id,
        status,
        amount,
        currency,
        metadata
      ) VALUES (?, ?, NULL, 'pending', ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        payment_id = NULL,
        status = 'pending',
        amount = VALUES(amount),
        currency = VALUES(currency),
        metadata = VALUES(metadata)
    `,
    [
      tenantId,
      orderId,
      typeof requestPayload.amount === 'number' && Number.isFinite(requestPayload.amount) ? requestPayload.amount : 0,
      typeof requestPayload.currency === 'string' && requestPayload.currency.trim() ? requestPayload.currency.trim() : 'ZAR',
      JSON.stringify({
        request: requestPayload,
        state: 'pending',
      }),
    ],
  );
}

async function upsertOrderFromPayment(
  conn: { execute: (sql: string, params?: unknown[]) => Promise<unknown> },
  tenantId: string,
  orderId: string,
  paymentData: { paymentId: number | null; redirectUrl: string | null; provider: string | null },
  requestPayload: JsonRecord,
  responsePayload: unknown,
): Promise<void> {
  await conn.execute(
    `
      INSERT INTO orders (
        tenant_id,
        order_id,
        payment_id,
        status,
        amount,
        currency,
        metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        payment_id = VALUES(payment_id),
        status = VALUES(status),
        metadata = VALUES(metadata)
    `,
    [
      tenantId,
      orderId,
      paymentData.paymentId,
      'pending',
      typeof requestPayload.amount === 'number' && Number.isFinite(requestPayload.amount) ? requestPayload.amount : 0,
      typeof requestPayload.currency === 'string' && requestPayload.currency.trim() ? requestPayload.currency.trim() : 'ZAR',
      JSON.stringify({
        request: requestPayload,
        paymentId: paymentData.paymentId,
        redirectUrl: paymentData.redirectUrl,
        provider: paymentData.provider,
        response: responsePayload,
      }),
    ],
  );
}

function extractErrorMessage(data: unknown): string | null {
  if (!isRecord(data)) return typeof data === 'string' ? data : null;

  if (typeof data.message === 'string' && data.message.trim()) return data.message;
  if (typeof data.error === 'string' && data.error.trim()) return data.error;
  if (isRecord(data.error) && typeof data.error.message === 'string' && data.error.message.trim()) {
    return data.error.message;
  }

  return null;
}

async function readResponseBody(response: globalThis.Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function validateWebhookPayload(body: unknown): { valid: true; payload: PaymentWebhookPayload } | { valid: false; message: string } {
  if (!isRecord(body)) {
    return { valid: false, message: 'Invalid webhook payload' };
  }

  const { event, data } = body as {
    event?: unknown;
    data?: unknown;
  };

  if (typeof event !== 'string' || !event.trim()) {
    return { valid: false, message: 'event is required' };
  }

  if (!isRecord(data)) {
    return { valid: false, message: 'data is required' };
  }

  if (!Number.isFinite(getNumberFromValue(data.id) ?? NaN)) {
    return { valid: false, message: 'data.id must be a number' };
  }

  const metadata = isRecord(data.metadata) ? data.metadata : null;
  if (!metadata) {
    return { valid: false, message: 'data.metadata is required' };
  }

  if (!getStringFromValue(metadata.tenantId)) {
    return { valid: false, message: 'data.metadata.tenantId is required' };
  }

  if (!getStringFromValue(metadata.orderId)) {
    return { valid: false, message: 'data.metadata.orderId is required' };
  }

  if (getNumberFromValue(metadata.paymentId) === null) {
    return { valid: false, message: 'data.metadata.paymentId is required' };
  }

  return {
    valid: true,
    payload: {
      event,
      data: {
        ...(data as JsonRecord),
        id: getNumberFromValue(data.id) as number,
        metadata: {
          ...(metadata as JsonRecord),
          tenantId: getStringFromValue(metadata.tenantId) as string,
          orderId: getStringFromValue(metadata.orderId) as string,
          paymentId: getNumberFromValue(metadata.paymentId) as number,
          userId: getNumberFromValue(metadata.userId) ?? getStringFromValue(metadata.userId) ?? undefined,
        },
      },
    },
  };
}

// POST /payment - create payment and persist initial order details
router.post('/', async (req: Request, res: Response) => {
  const callerHostname = getCallerHostname(req);
  const tenantId = getTenantOrRespond(req, res);
  if (!tenantId) return;

  const apiBaseUrl = getPaymentsApiBaseUrl();
  const apiKey = getPaymentsApiKey();

  if (!apiBaseUrl || !apiKey) {
    return res.status(500).json(errorResponse('Payments API is not configured'));
  }

  const normalizedPayload = normalizeCreatePaymentPayload(req.body);
  if (!normalizedPayload.valid) {
    return res.status(400).json(errorResponse(normalizedPayload.message));
  }

  const requestPayload = normalizedPayload.payload as JsonRecord;
  const orderId = getOrderIdFromPayload(requestPayload);

  if (!orderId) {
    return res.status(400).json(errorResponse('orderId is required to create a payment'));
  }

  try {
    await withConnection(async (conn) => {
      const existingStatus = await getExistingOrderStatus(conn, tenantId, orderId);

      if (isPaidStatus(existingStatus)) {
        throw new Error('Order has already been paid');
      }

      await markOrderPending(conn, tenantId, orderId, requestPayload);
    });

    const paymentRequest: CreatePaymentPayload = {
      orderId,
      amount: normalizedPayload.payload.amount,
      currency: normalizedPayload.payload.currency,
      customer: normalizedPayload.payload.customer,
      userId: normalizedPayload.payload.userId,
    };

    const paymentRequestBody = JSON.stringify(paymentRequest);
    const paymentEndpoint = `${trimTrailingSlash(apiBaseUrl)}/payment`;

    const paymentHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantId,
      'X-APIKEY': apiKey,
    };

    if (callerHostname) {
      paymentHeaders['X-Hostname'] = callerHostname;
    }

    let response = await fetch(paymentEndpoint, {
      method: 'POST',
      headers: paymentHeaders,
      body: paymentRequestBody,
    });

    let data = await readResponseBody(response);

    if (!response.ok) {
      const errorMessage = extractErrorMessage(data) || 'Failed to create payment';
      const isDuplicateOrder = /duplicate entry/i.test(errorMessage) || /uniq_tenant_external/i.test(errorMessage);

      if (!isDuplicateOrder) {
        throw new Error(errorMessage);
      }

      const retryStatus = await withConnection(async (conn) => getExistingOrderStatus(conn, tenantId, orderId));
      if (isPaidStatus(retryStatus)) {
        throw new Error('Order has already been paid');
      }

      await withConnection(async (conn) => {
        await markOrderPending(conn, tenantId, orderId, requestPayload);
      });

      response = await fetch(paymentEndpoint, {
        method: 'POST',
        headers: paymentHeaders,
        body: paymentRequestBody,
      });

      data = await readResponseBody(response);

      if (!response.ok) {
        throw new Error(extractErrorMessage(data) || 'Failed to create payment');
      }
    }

    const paymentDetails = getPaymentDetailsFromResponse(data);

    await withConnection(async (conn) => {
      await upsertOrderFromPayment(conn, tenantId, orderId, paymentDetails, requestPayload, data);
    });

    return res.status(response.status).json(successResponse(unwrapPaymentResponse(data) as CreatePaymentResponse));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create payment';
    const statusCode = message === 'Order has already been paid' ? 409 : 502;
    return res.status(statusCode).json(errorResponse(message));
  }
});

// POST /payment/webhook - receive payment status notifications and persist them
router.post('/webhook', async (req: Request, res: Response) => {
  const validation = validateWebhookPayload(req.body);
  if (!validation.valid) {
    return res.status(400).json(errorResponse(validation.message));
  }

  const payload = validation.payload;
  const webhookMessage = JSON.stringify(req.body);
  const identifiers = getWebhookIdentifiers(payload);
  const tenantId = identifiers.tenantId;
  const orderId = identifiers.orderId;
  const paymentId = identifiers.paymentId;

  if (!tenantId || !orderId) {
    return res.status(400).json(errorResponse('data.metadata.tenantId and data.metadata.orderId are required'));
  }

  // TODO: Handle the payment here - add a license, allocate a ticket or give the user their credits

  try {
    await withConnection(async (conn) => {
      await conn.execute(
        `
          INSERT INTO payment_webhook (
            tenant_id,
            event,
            message
          ) VALUES (?, ?, ?)
        `,
        [tenantId, payload.event, webhookMessage],
      );

      const status = normalizeWebhookStatus(payload.event, payload.data.status);

      await conn.execute(
        `
          INSERT INTO orders (
            tenant_id,
            order_id,
            payment_id,
            status,
            amount,
            currency,
            metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            payment_id = VALUES(payment_id),
            status = VALUES(status),
            metadata = VALUES(metadata)
        `,
        [
          tenantId,
          orderId,
          paymentId,
          status,
          0,
          'ZAR',
          JSON.stringify(payload),
        ],
      );
    });

    return res.status(200).json(successResponse({ received: true }));
  } catch (error) {
    return res.status(500).json(errorResponse(error instanceof Error ? error.message : 'Failed to process payment webhook'));
  }
});

export default router;
