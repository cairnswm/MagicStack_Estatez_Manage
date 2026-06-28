export interface CreatePaymentPayload {
  orderId: string;
  amount: number;
  currency: string;
  customer: {
    email: string;
    [key: string]: unknown;
  };
  userId?: number | string;
  [key: string]: unknown;
}

export interface CreatePaymentResponse {
  paymentId: number;
  redirectUrl: string;
  provider: string;
  [key: string]: unknown;
}

export interface PaymentWebhookPayload {
  event: string;
  data: {
    id: number;
    domain?: string;
    status?: string;
    reference?: string;
    amount?: number;
    message?: string | null;
    gateway_response?: string | null;
    paid_at?: string | null;
    created_at?: string | null;
    channel?: string | null;
    currency?: string;
    ip_address?: string | null;
    metadata?: {
      tenantId?: string;
      orderId?: string;
      paymentId?: number | string;
      userId?: number | string;
      customerEmail?: string;
      failureUrl?: string;
      cancelUrl?: string;
      referrer?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}
