-- Give every outbox row a monotonic order. Timestamps cannot safely provide
-- FIFO ordering because PostgreSQL's now() is constant within a transaction.

begin;

alter table public.stage_email_outbox
  add column delivery_sequence bigint generated always as identity;

alter table public.stage_email_outbox
  add constraint stage_email_outbox_delivery_sequence_key
  unique (delivery_sequence);

drop index public.stage_email_outbox_delivery_idx;
create index stage_email_outbox_delivery_idx
  on public.stage_email_outbox(status, available_at, delivery_sequence);

create or replace function public.claim_stage_email_outbox(
  p_lock_token uuid,
  p_limit integer default 10,
  p_outbox_id uuid default null
)
returns setof public.stage_email_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A worker can disappear after taking its fifth lease. Such a row cannot be
  -- retried safely, so terminalize it before selecting new work.
  update public.stage_email_outbox
  set
    status = 'failed',
    skip_reason = 'delivery_failed',
    last_error = coalesce(last_error, 'Worker lease expired on final attempt'),
    locked_at = null,
    lock_token = null,
    updated_at = now()
  where status = 'processing'
    and attempts >= 5
    and locked_at < now() - interval '10 minutes';

  return query
    with candidates as (
      select o.id
      from public.stage_email_outbox as o
      where (p_outbox_id is null or o.id = p_outbox_id)
        and o.attempts < 5
        and not exists (
          select 1
          from public.stage_email_outbox as earlier
          where earlier.submission_id = o.submission_id
            and earlier.delivery_sequence < o.delivery_sequence
            and earlier.status in ('pending', 'processing')
        )
        and (
          (o.status = 'pending' and o.available_at <= now())
          or (
            o.status = 'processing'
            and o.locked_at < now() - interval '10 minutes'
          )
        )
      order by o.delivery_sequence
      for update skip locked
      limit greatest(1, least(p_limit, 50))
    )
    update public.stage_email_outbox as o
    set
      status = 'processing',
      attempts = o.attempts + 1,
      locked_at = now(),
      lock_token = p_lock_token,
      updated_at = now()
    from candidates as c
    where o.id = c.id
    returning o.*;
end;
$$;

revoke all on function public.claim_stage_email_outbox(uuid, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_stage_email_outbox(uuid, integer, uuid)
  to service_role;

commit;
