# Twilio 10DLC registration — beat-SPY

US carriers require A2P 10DLC registration before any application-to-person SMS
traffic on a long-code number. This runbook captures the brand + campaign info
beat-SPY needs to file in the Twilio console before launch.

## Prereqs

- Twilio account with a US long-code number provisioned
- Business EIN, legal name, address
- Privacy policy and ToS URLs publicly reachable

## Steps

1. **Register the brand** (Twilio Console → Messaging → Regulatory Compliance →
   Brands). Provide:
   - Legal business name + EIN
   - Business address, website, support email
   - Vertical: "Education" (or "Other" + "Account Notifications")

2. **Wait for brand approval.** Usually <1 business day. Status visible in
   console.

3. **Register the campaign** (Messaging → Regulatory Compliance → Campaigns):
   - **Use case:** "Account Notifications" (primary). Add "Marketing" only if
     marketing copy is sent — beat-SPY does not send marketing.
   - **Description:** "beat-SPY sends transactional notifications to registered
     users about challenges they have opted into: start/end reminders, prize
     wins, removal from a challenge by an organizer, and consent confirmations
     for parents of under-18 users. SMS is opt-in via a settings page with a
     TCPA disclosure and confirmation text. Reply STOP to opt out."
   - **Sample messages** — paste verbatim from the templates in
     `src/notifications/templates/`:

     - `start-tomorrow.js`:
       > beat-SPY: Test Cup starts tomorrow. Get your portfolio ready.
     - `started.js`:
       > beat-SPY: Test Cup is live. Time to trade.
     - `end-tomorrow.js`:
       > beat-SPY: Test Cup ends tomorrow. Last chance.
     - `won-payout.js`:
       > You won $100 in Test Cup! Claim: https://beat-snp.com/payouts/abc
     - `removed.js`:
       > beat-SPY: You've been removed from Test Cup.
     - SMS opt-in confirmation (from `api/profile/sms-optin.js`):
       > You're opted in to beat-SPY texts. Reply STOP to opt out. Msg & data
       > rates may apply.

   - **Opt-in workflow:** describe the in-app SMS opt-in flow on
     `/app/profile-settings` — phone field + TCPA checkbox + confirmation text.
   - **Opt-out keywords:** STOP, STOPALL, CANCEL, UNSUBSCRIBE, QUIT, END
   - **Help keywords:** HELP, INFO

4. **Wait for campaign approval.** Typically <24h. You'll receive an email.

5. **Once approved**, point the registered number at our app:
   - Set `TWILIO_FROM_NUMBER` in production env to the registered number
   - Configure inbound webhook on the number:
     `POST https://<host>/api/webhooks/twilio-status`
   - Set `TWILIO_WEBHOOK_AUTH_TOKEN` if using a non-default auth token

6. **Smoke test** before announcing:
   - Opt in via `/app/profile-settings`. Confirm receipt of confirmation text.
   - Trigger a test `start_tomorrow` notification (manually invoke the cron with
     a test competition starting in ~24h).
   - Reply STOP. Verify `profiles.sms_opt_in=false` in DB and that subsequent
     non-critical sends are gated.
   - Reply START. Verify re-opt-in.

## Required env vars (production)

| Var | Purpose |
|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio account ID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token (signs API calls + verifies webhooks) |
| `TWILIO_FROM_NUMBER` | Registered 10DLC long code, E.164 |
| `TWILIO_WEBHOOK_AUTH_TOKEN` | (optional) override webhook signing token |
| `TWILIO_WEBHOOK_SKIP_VERIFY` | (dev only) `true` to skip signature check |

If any of `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` are
missing, `sendSms` no-ops with `{skipped: true}` — the rest of the app keeps
working. `lookupPhone` returns `{valid: null}` and the SMS opt-in API accepts
phone numbers without validation.

## Production Deploy Checklist

- [ ] **`TWILIO_WEBHOOK_SKIP_VERIFY` MUST NOT be set in production.** This env
      var bypasses Twilio's `X-Twilio-Signature` HMAC verification on inbound
      webhooks (STOP/START handling). It exists for local development and
      replay testing only. Setting it in production allows anyone to forge
      inbound SMS webhooks, opt users in/out, and abuse the carrier-side STOP
      handling. The webhook handler logs a `[SECURITY]` error every time the
      bypass kicks in — alert on that log line.
- [ ] `TWILIO_AUTH_TOKEN` (or `TWILIO_WEBHOOK_AUTH_TOKEN`) is set so signature
      verification can run.
- [ ] Inbound webhook URL in Twilio console points at
      `https://<host>/api/webhooks/twilio-status` (HTTPS only).

## After launch

- Monitor Twilio console for delivery failures, especially `30007`
  (carrier filtered for unregistered traffic). If you see these after
  registration, the campaign isn't yet linked to the sending number.
- Annual brand re-verification. Twilio emails when due.
