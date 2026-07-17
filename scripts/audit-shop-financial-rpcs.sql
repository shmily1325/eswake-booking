-- Read-only production preflight for migration 141.
-- Run in Supabase SQL Editor before applying the migration.

WITH target_functions(signature) AS (
  VALUES
    ('public.submit_shop_order_billing(uuid,jsonb,uuid,text)'::regprocedure),
    ('public.cancel_shop_order_billing(uuid,jsonb,uuid,text)'::regprocedure),
    ('public.settle_shop_order(uuid,jsonb,uuid,text,uuid,text,text)'::regprocedure),
    ('public.adjust_shop_order_settlement(uuid,numeric,jsonb,text,uuid)'::regprocedure),
    ('public.void_shop_order(uuid,text)'::regprocedure)
)
SELECT
  tf.signature::text AS function_signature,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS security_definer,
  has_function_privilege('anon', tf.signature, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', tf.signature, 'EXECUTE') AS authenticated_can_execute,
  EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
    WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
  ) AS public_can_execute
FROM target_functions tf
JOIN pg_proc p ON p.oid = tf.signature
ORDER BY function_signature;

SELECT
  to_regprocedure('public.is_allowed_staff()') IS NOT NULL AS helper_exists,
  CASE
    WHEN to_regprocedure('public.is_allowed_staff()') IS NULL THEN NULL
    ELSE public.is_allowed_staff()
  END AS sql_editor_session_is_allowed_staff,
  auth.role() AS current_auth_role,
  auth.uid() AS current_auth_uid,
  lower(auth.jwt() ->> 'email') AS current_auth_email;

SELECT
  p.oid::regprocedure::text AS function_signature,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
WHERE p.oid IN (
  'public.submit_shop_order_billing(uuid,jsonb,uuid,text)'::regprocedure,
  'public.cancel_shop_order_billing(uuid,jsonb,uuid,text)'::regprocedure,
  'public.settle_shop_order(uuid,jsonb,uuid,text,uuid,text,text)'::regprocedure,
  'public.adjust_shop_order_settlement(uuid,numeric,jsonb,text,uuid)'::regprocedure,
  'public.void_shop_order(uuid,text)'::regprocedure
)
ORDER BY function_signature;
