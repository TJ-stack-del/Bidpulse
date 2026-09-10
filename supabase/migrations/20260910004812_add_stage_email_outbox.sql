-- Durable delivery for stage-change emails.
--
-- The transition and outbox insert commit together. Workers claim rows with a
-- lease so concurrent invocations cannot send the same message, and each send
-- uses the outbox UUID as the provider idempotency key.

begin;

create table public.stage_email_outbox (
  id uuid primary key default extensions.uuid_generate_v4(),
  transition_audit_id uuid not null unique
    references public.audit_log(id) on delete cascade,
  submission_id uuid not null
    references public.submissions(id) on delete cascade,
  org_id uuid not null
    references public.organizations(id) on delete cascade,
  actor_id uuid
    references public.team_members(id) on delete set null,
  idempotency_key uuid not null unique,
  stage public.submission_stage not null,
  transition_trigger text not null,
  recipient_email text,
  client_company_name text,
  agency text not null,
  email_subject text,
  email_html text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'skipped', 'failed')),
  skip_reason text,
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  lock_token uuid,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stage_email_outbox_delivery_idx
  on public.stage_email_outbox(status, available_at, created_at);

alter table public.stage_email_outbox enable row level security;
revoke all on table public.stage_email_outbox from anon, authenticated;
grant all on table public.stage_email_outbox to service_role;

create or replace function public.transition_submission_stage_with_outbox(
  p_submission_id uuid,
  p_expected_stage public.submission_stage,
  p_new_stage public.submission_stage,
  p_actor_id uuid,
  p_client_id uuid,
  p_event_type text,
  p_event_detail jsonb,
  p_mark_first_viewed boolean,
  p_require_complete_deliverables boolean,
  p_idempotency_key uuid
)
returns table (
  outcome text,
  current_stage public.submission_stage,
  notification_id uuid,
  notification_status text,
  notification_skip_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_stage public.submission_stage;
  v_agency text;
  v_is_test boolean;
  v_is_draft boolean;
  v_client_company_name text;
  v_client_email text;
  v_org_id uuid;
  v_client_id uuid;
  v_audit_id uuid;
  v_notification_id uuid;
  v_notification_status text;
  v_notification_skip_reason text;
  v_existing_submission_id uuid;
  v_existing_stage public.submission_stage;
begin
  select
    o.id,
    o.status,
    o.skip_reason,
    o.submission_id,
    o.stage
  into
    v_notification_id,
    v_notification_status,
    v_notification_skip_reason,
    v_existing_submission_id,
    v_existing_stage
  from public.stage_email_outbox as o
  where o.idempotency_key = p_idempotency_key;

  if found then
    if v_existing_submission_id <> p_submission_id
      or v_existing_stage <> p_new_stage then
      raise exception 'Idempotency key was already used for another transition';
    end if;

    select s.stage
    into v_current_stage
    from public.submissions as s
    where s.id = p_submission_id;

    return query
      select
        'replayed'::text,
        v_current_stage,
        v_notification_id,
        v_notification_status,
        v_notification_skip_reason;
    return;
  end if;

  select
    s.stage,
    s.agency,
    s.is_test,
    s.draft,
    c.company_name,
    c.email,
    c.org_id,
    c.id
  into
    v_current_stage,
    v_agency,
    v_is_test,
    v_is_draft,
    v_client_company_name,
    v_client_email,
    v_org_id,
    v_client_id
  from public.submissions as s
  join public.clients as c on c.id = s.client_id
  where s.id = p_submission_id
  for update of s;

  if not found then
    return query
      select
        'not_found'::text,
        null::public.submission_stage,
        null::uuid,
        null::text,
        null::text;
    return;
  end if;

  if p_actor_id is not null then
    if not exists (
      select 1
      from public.team_members as tm
      where tm.id = p_actor_id
        and tm.org_id = v_org_id
        and tm.role = 'admin'
    ) then
      raise exception 'Actor is not an administrator for this submission';
    end if;
  elsif p_client_id is null or p_client_id <> v_client_id then
    raise exception 'Client does not own this submission';
  end if;

  if p_mark_first_viewed and v_is_draft then
    return query
      select
        'ineligible'::text,
        v_current_stage,
        null::uuid,
        null::text,
        'draft_submission'::text;
    return;
  end if;

  if p_mark_first_viewed then
    update public.submissions
    set first_viewed_by_admin_at = coalesce(first_viewed_by_admin_at, now())
    where id = p_submission_id;
  end if;

  if p_require_complete_deliverables and not (
    select count(distinct d.deliverable_type) = 3
    from public.deliverables as d
    where d.submission_id = p_submission_id
      and d.deliverable_type in (
        'capability_statement',
        'compliance_matrix',
        'technical_narrative'
      )
      and (
        nullif(trim(d.content), '') is not null
        or nullif(trim(d.file_url), '') is not null
      )
  ) then
    return query
      select
        'ineligible'::text,
        v_current_stage,
        null::uuid,
        null::text,
        'incomplete_deliverables'::text;
    return;
  end if;

  if v_current_stage = p_new_stage then
    select o.id, o.status, o.skip_reason
    into v_notification_id, v_notification_status, v_notification_skip_reason
    from public.stage_email_outbox as o
    where o.submission_id = p_submission_id
      and o.stage = p_new_stage
      and o.status in ('pending', 'processing')
    order by o.created_at desc
    limit 1;

    return query
      select
        'unchanged'::text,
        v_current_stage,
        v_notification_id,
        v_notification_status,
        v_notification_skip_reason;
    return;
  end if;

  if v_current_stage <> p_expected_stage then
    return query
      select
        'conflict'::text,
        v_current_stage,
        null::uuid,
        null::text,
        null::text;
    return;
  end if;

  update public.submissions
  set
    stage = p_new_stage,
    updated_at = now()
  where id = p_submission_id;

  v_audit_id := extensions.uuid_generate_v4();
  insert into public.audit_log (
    id,
    submission_id,
    org_id,
    actor_id,
    event_type,
    event_detail
  )
  values (
    v_audit_id,
    p_submission_id,
    v_org_id,
    p_actor_id,
    p_event_type,
    coalesce(p_event_detail, '{}'::jsonb) || jsonb_build_object(
      'from', v_current_stage,
      'to', p_new_stage,
      'idempotency_key', p_idempotency_key
    )
  );

  v_notification_status := case
    when v_is_test then 'skipped'
    when nullif(trim(v_client_email), '') is null then 'skipped'
    else 'pending'
  end;
  v_notification_skip_reason := case
    when v_is_test then 'test_submission'
    when nullif(trim(v_client_email), '') is null then 'no_client_email'
    else null
  end;

  insert into public.stage_email_outbox (
    transition_audit_id,
    submission_id,
    org_id,
    actor_id,
    idempotency_key,
    stage,
    transition_trigger,
    recipient_email,
    client_company_name,
    agency,
    status,
    skip_reason
  )
  values (
    v_audit_id,
    p_submission_id,
    v_org_id,
    p_actor_id,
    p_idempotency_key,
    p_new_stage,
    coalesce(p_event_detail->>'trigger', 'unknown'),
    nullif(trim(v_client_email), ''),
    v_client_company_name,
    v_agency,
    v_notification_status,
    v_notification_skip_reason
  )
  returning id into v_notification_id;

  return query
    select
      'applied'::text,
      p_new_stage,
      v_notification_id,
      v_notification_status,
      v_notification_skip_reason;
end;
$$;

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
            and (
              earlier.created_at < o.created_at
              or (earlier.created_at = o.created_at and earlier.id < o.id)
            )
            and earlier.status in ('pending', 'processing')
        )
        and (
          (o.status = 'pending' and o.available_at <= now())
          or (
            o.status = 'processing'
            and o.locked_at < now() - interval '10 minutes'
          )
        )
      order by o.created_at
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

create or replace function public.complete_stage_email_outbox(
  p_outbox_id uuid,
  p_lock_token uuid,
  p_provider_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.stage_email_outbox%rowtype;
begin
  update public.stage_email_outbox
  set
    status = 'sent',
    sent_at = now(),
    provider_message_id = p_provider_message_id,
    last_error = null,
    skip_reason = null,
    locked_at = null,
    lock_token = null,
    updated_at = now()
  where id = p_outbox_id
    and lock_token = p_lock_token
    and status = 'processing'
  returning * into v_row;

  if not found then
    return false;
  end if;

  insert into public.audit_log (
    submission_id,
    org_id,
    actor_id,
    event_type,
    event_detail
  )
  values (
    v_row.submission_id,
    v_row.org_id,
    v_row.actor_id,
    'stage_change_email_sent',
    jsonb_build_object(
      'stage', v_row.stage,
      'auto', v_row.transition_trigger <> 'manual',
      'outbox_id', v_row.id,
      'provider_message_id', p_provider_message_id
    )
  );

  return true;
end;
$$;

create or replace function public.fail_stage_email_outbox(
  p_outbox_id uuid,
  p_lock_token uuid,
  p_error text,
  p_terminal boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  update public.stage_email_outbox
  set
    status = case
      when p_terminal or attempts >= 5 then 'failed'
      else 'pending'
    end,
    skip_reason = case
      when p_terminal or attempts >= 5 then 'delivery_failed'
      else 'queued_for_retry'
    end,
    available_at = case
      when p_terminal or attempts >= 5 then available_at
      else now() + make_interval(
        secs => least(3600, (300 * power(2, greatest(attempts - 1, 0)))::integer)
      )
    end,
    last_error = left(p_error, 2000),
    locked_at = null,
    lock_token = null,
    updated_at = now()
  where id = p_outbox_id
    and lock_token = p_lock_token
    and status = 'processing'
  returning status into v_status;

  return v_status;
end;
$$;

revoke all on function public.transition_submission_stage_with_outbox(
  uuid,
  public.submission_stage,
  public.submission_stage,
  uuid,
  uuid,
  text,
  jsonb,
  boolean,
  boolean,
  uuid
) from public, anon, authenticated;
grant execute on function public.transition_submission_stage_with_outbox(
  uuid,
  public.submission_stage,
  public.submission_stage,
  uuid,
  uuid,
  text,
  jsonb,
  boolean,
  boolean,
  uuid
) to service_role;

revoke all on function public.claim_stage_email_outbox(uuid, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_stage_email_outbox(uuid, integer, uuid)
  to service_role;

revoke all on function public.complete_stage_email_outbox(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.complete_stage_email_outbox(uuid, uuid, text)
  to service_role;

revoke all on function public.fail_stage_email_outbox(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.fail_stage_email_outbox(uuid, uuid, text, boolean)
  to service_role;

commit;
