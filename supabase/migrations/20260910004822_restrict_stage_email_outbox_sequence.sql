-- Supabase's public-schema defaults grant sequence usage to browser roles.
-- The outbox is service-only, so its identity sequence must be service-only too.

revoke all on sequence public.stage_email_outbox_delivery_sequence_seq
  from public, anon, authenticated;
grant all on sequence public.stage_email_outbox_delivery_sequence_seq
  to service_role;
