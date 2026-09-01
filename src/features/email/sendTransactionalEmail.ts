import 'server-only';
import { createInsumosSupabaseAdmin } from '@/features/shared/server/supabase';
import { getConfiguredProviderName, getEmailProvider } from './provider';
import type { EmailMessage } from './types';

export const TRANSACTIONAL_EMAIL_EVENTS = ['order_received'] as const;
export type TransactionalEmailEvent = (typeof TRANSACTIONAL_EMAIL_EVENTS)[number];

export interface SendTransactionalEmailInput {
  eventType: TransactionalEmailEvent;
  orderId: string;
  message: EmailMessage;
}

export type SendTransactionalEmailStatus = 'sent' | 'failed' | 'skipped';

export interface SendTransactionalEmailResult {
  status: SendTransactionalEmailStatus;
  providerMessageId?: string;
  error?: string;
}

type SupabaseAdminClient = ReturnType<typeof createInsumosSupabaseAdmin>;

/**
 * Shared terminal step for both a fresh send and an explicit retry: calls
 * the configured provider and writes the outcome onto the *same* row (never
 * inserts). Used by sendTransactionalEmail and retryTransactionalEmail so
 * "how a delivery ends up sent or failed" only has one implementation.
 */
async function attemptProviderSend(admin: SupabaseAdminClient, deliveryId: string, message: EmailMessage): Promise<SendTransactionalEmailResult> {
  try {
    const provider = getEmailProvider();
    const result = await provider.send(message);
    await admin
      .from('email_deliveries')
      .update({
        status: 'sent',
        provider_message_id: result.providerMessageId,
        sent_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deliveryId);
    return { status: 'sent', providerMessageId: result.providerMessageId };
  } catch (sendError) {
    const message2 = sendError instanceof Error ? sendError.message : 'Error desconocido al enviar el correo.';
    await admin
      .from('email_deliveries')
      .update({ status: 'failed', last_error: message2, updated_at: new Date().toISOString() })
      .eq('id', deliveryId);
    console.error('[email] provider send failed', sendError);
    return { status: 'failed', error: message2 };
  }
}

/**
 * Fire-and-record: sends one transactional email and writes its outcome to
 * email_deliveries for audit/idempotency. Deliberately never throws — every
 * failure mode (provider down, DB write failed, unexpected exception)
 * resolves to a result object instead, so a caller can never let an email
 * problem turn into a failed order response. The order itself is always
 * already committed by the time this runs.
 */
export async function sendTransactionalEmail(input: SendTransactionalEmailInput): Promise<SendTransactionalEmailResult> {
  const admin = createInsumosSupabaseAdmin();
  const providerName = getConfiguredProviderName();

  try {
    // (order_id, event_type) is unique at the DB level too — this check just
    // avoids a wasted provider call and a guaranteed insert conflict on a
    // duplicate request. Every existing status skips an automatic (re)send
    // here, for a different reason each time:
    //   sent    — already delivered, never resend automatically.
    //   pending — a concurrent request already claimed this row; skipping
    //             avoids a double-send race, it isn't a real duplicate.
    //   failed  — left exactly as-is for an explicit, separate
    //             retryTransactionalEmail(deliveryId) call — this path
    //             never retries automatically.
    const { data: existing } = await admin
      .from('email_deliveries')
      .select('id, status')
      .eq('order_id', input.orderId)
      .eq('event_type', input.eventType)
      .maybeSingle();
    if (existing) {
      return { status: 'skipped' };
    }

    const { data: inserted, error: insertError } = await admin
      .from('email_deliveries')
      .insert({
        order_id: input.orderId,
        event_type: input.eventType,
        recipient: input.message.to.email,
        provider: providerName,
        status: 'pending',
        attempts: 1,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      // A unique-violation here means a concurrent request already claimed
      // this (order_id, event_type) — that's a successful idempotency skip,
      // not a failure, so it's not logged as an error.
      if (insertError?.code !== '23505') {
        console.error('[email] failed to record pending delivery', insertError);
      }
      return { status: 'skipped' };
    }

    return await attemptProviderSend(admin, inserted.id, input.message);
  } catch (error) {
    console.error('[email] unexpected error in sendTransactionalEmail', error);
    return { status: 'failed', error: 'Error inesperado al enviar el correo.' };
  }
}

export interface RetryTransactionalEmailInput {
  deliveryId: string;
  message: EmailMessage;
}

/**
 * Explicit, manual retry primitive for a single failed delivery row.
 * Deliberately NOT wired to checkout, a cron, or any worker — nothing calls
 * this automatically yet. It exists so the data model is provably ready for
 * a future retry mechanism without duplicating rows: it only ever accepts a
 * row whose status is 'failed' (retrying a 'sent' or already-'pending' row
 * is rejected outright, since resending something that already succeeded —
 * or is mid-flight — is never the intent here), moves that same row back to
 * 'pending', increments attempts, clears last_error, then reuses
 * attemptProviderSend — the same terminal step a fresh send uses — so the
 * row ends up 'sent' or 'failed' again without ever inserting a second row.
 * That keeps unique(order_id, event_type) safe by construction.
 */
export async function retryTransactionalEmail(input: RetryTransactionalEmailInput): Promise<SendTransactionalEmailResult> {
  const admin = createInsumosSupabaseAdmin();

  try {
    const { data: existing, error: fetchError } = await admin
      .from('email_deliveries')
      .select('id, status, attempts')
      .eq('id', input.deliveryId)
      .maybeSingle();
    if (fetchError || !existing) {
      return { status: 'failed', error: 'No se encontró el envío a reintentar.' };
    }
    if (existing.status !== 'failed') {
      // Retrying a 'sent' or 'pending' row is a no-op, not an error —
      // there is nothing to retry.
      return { status: 'skipped' };
    }

    const nextAttempts = (existing.attempts || 0) + 1;
    const { error: updateError } = await admin
      .from('email_deliveries')
      .update({ status: 'pending', attempts: nextAttempts, last_error: null, updated_at: new Date().toISOString() })
      .eq('id', input.deliveryId);
    if (updateError) {
      console.error('[email] failed to prepare retry', updateError);
      return { status: 'failed', error: 'No se pudo preparar el reintento.' };
    }

    return await attemptProviderSend(admin, input.deliveryId, input.message);
  } catch (error) {
    console.error('[email] unexpected error in retryTransactionalEmail', error);
    return { status: 'failed', error: 'Error inesperado al reintentar el correo.' };
  }
}
