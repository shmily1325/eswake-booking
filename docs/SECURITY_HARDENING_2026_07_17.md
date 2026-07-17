# Security Hardening Closure — 2026-07-17

## Status

The high-priority anonymous data-access review is closed.

Production verification confirmed:

- Anonymous callers cannot execute the five sensitive LIFF member/order RPCs.
- Only `service_role` can execute those RPCs.
- Anonymous callers have no `SELECT`, `INSERT`, `UPDATE`, or `DELETE` privilege on:
  - `members`
  - `line_bindings`
  - `board_storage`
  - `shop_orders`
  - `shop_order_items`
  - `shop_order_settlements`
- Existing LIFF member profile, transaction, shop-order, booking, and binding flows were smoke-tested successfully.

## Changes completed

| Migration | Change |
| --- | --- |
| `141_harden_shop_financial_rpc_authorization.sql` | Restricted shop financial RPCs to authenticated allow-listed staff and removed anon/PUBLIC execution. |
| `142_remove_anon_booking_delete.sql` | Removed obsolete anonymous booking and booking-relation deletion. |
| `143_add_liff_birthday_rpc.sql` | Added a narrow birthday-update RPC for the LIFF flow. |
| `144_revoke_anon_member_update.sql` | Removed broad anonymous updates on the complete `members` row. |
| `145_scope_liff_transaction_reads.sql` | Replaced unrestricted transaction reads with member-scoped RPC access. |
| `146_scope_liff_member_and_order_access.sql` | Added server-only member binding/profile/order RPCs and one-active-LINE-binding enforcement. |
| `147_revoke_anon_liff_member_and_order_access.sql` | Completed the cutover by revoking direct anonymous table and sensitive RPC access. |

## LIFF security boundary

Sensitive LIFF requests now follow this path:

```text
LIFF client
  -> /api/liff-member-access with LINE access token
  -> LINE /v2/profile verification
  -> verified LINE user ID
  -> service-role-only Supabase RPC
```

The browser cannot choose the `line_user_id` used by a sensitive RPC. The API derives it from LINE after validating the access token.

The service-role key remains server-side and must never be exposed through a `VITE_*` client environment variable.

## Binding behavior

Binding intentionally preserves the existing business behavior:

1. Verify the LINE access token.
2. Find one active member by normalized phone number.
3. Reject conflicting active LINE/member bindings.
4. Create or refresh the binding.
5. Write the birthday entered in the binding form to the member record.

Birthday is written during binding; it is not used as a lookup condition.

The partial unique index `uq_line_bindings_active_member` prevents concurrent requests from creating multiple active LINE bindings for one member.

## Performance

Initial LIFF member profile and shop-order loading are combined into one bootstrap request:

- One LINE token verification instead of two.
- No token caching.
- No relaxation of database grants or RLS.
- If shop-order loading fails, the member profile can still render.

Individual transaction and manual order-refresh requests still verify the LINE token independently. A small delay compared with direct browser-to-Supabase access is expected because the secure path includes Vercel and LINE verification.

Typical added latency should be below one second. Occasional serverless cold starts may take one to two seconds. Repeated delays above two to three seconds should be investigated in Vercel logs.

## Production verification

Expected function privileges:

| Function | anon | authenticated | service_role |
| --- | --- | --- | --- |
| `bind_liff_member(text,text,date)` | false | false | true |
| `get_liff_member_profile(text,boolean)` | false | false | true |
| `get_liff_member_transactions(text,text,date)` | false | false | true |
| `get_liff_shop_orders(text)` | false | false | true |
| `update_liff_member_birthday(text,date)` | false | false | true |

Expected anonymous table privileges for all six protected tables:

```text
SELECT=false
INSERT=false
UPDATE=false
DELETE=false
```

These values were confirmed in production after migration 147.

## Test evidence

At the security cutover:

- Full Vitest suite: 1,071 passed, 2 skipped.
- Production build passed.
- Changed-file lint checks passed.
- Serverless API TypeScript check passed.
- Endpoint tests confirmed that request-provided LINE IDs are ignored and identity is derived from LINE.
- Bootstrap tests confirmed one LINE verification loads the member and shop orders.

## Deployment notes

The safe migration order was:

1. Apply additive migration 146.
2. Deploy the token-verifying API and updated LIFF client.
3. Smoke-test existing member and new binding flows.
4. Apply revocation migration 147.
5. Verify grants and repeat the LIFF smoke test.

Migration 146 is idempotent and was safely rerun after correcting birthday behavior.

The Vercel Hobby project currently uses all 12 available Serverless Function slots. The disabled `line-send-single` endpoint was removed to make room for the LIFF security gateway. Future API additions require consolidation, removal of another inactive endpoint, or a plan upgrade.

## Deferred and accepted items

The following items were reviewed and intentionally deferred because their current operational exposure is lower:

- Google OAuth initialization callback returns tokens and should be restricted if that setup flow becomes active.
- Shop settlement still trusts staff-submitted line prices; financial RPC execution is now restricted to allow-listed staff.
- Booking conflict checks are not fully atomic at the database layer.
- A broader authenticated-role RLS audit remains optional.
- Dependency advisories remain; most currently involve unused SSR/proxy paths, but dependencies should be updated during routine maintenance.
- Backup PII encryption, CI, and additional monitoring remain operational improvements.

Reopen this security review if any deferred endpoint becomes actively used, LIFF identity behavior changes, or another public Supabase data path is introduced.
