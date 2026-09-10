-- Record a real admin page view even when a concurrent manual transition
-- moves the submission beyond `in_review` before the automatic request
-- obtains its row lock.

begin;

create or replace function public.transition_submission_stage(
  p_submission_id uuid,
  p_expected_stage public.submission_stage,
  p_new_stage public.submission_stage,
  p_actor_id uuid,
  p_event_type text,
  p_event_detail jsonb default '{}'::jsonb,
  p_mark_first_viewed boolean default false
)
returns table (
  outcome text,
  current_stage public.submission_stage,
  agency text,
  is_test boolean,
  client_company_name text,
  client_email text,
  submission_org_id uuid
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
begin
  select
    s.stage,
    s.agency,
    s.is_test,
    s.draft,
    c.company_name,
    c.email,
    c.org_id
  into
    v_current_stage,
    v_agency,
    v_is_test,
    v_is_draft,
    v_client_company_name,
    v_client_email,
    v_org_id
  from public.submissions as s
  join public.clients as c on c.id = s.client_id
  where s.id = p_submission_id
  for update of s;

  if not found then
    return query
      select
        'not_found'::text,
        null::public.submission_stage,
        null::text,
        null::boolean,
        null::text,
        null::text,
        null::uuid;
    return;
  end if;

  if p_actor_id is not null and not exists (
    select 1
    from public.team_members as tm
    where tm.id = p_actor_id
      and tm.org_id = v_org_id
      and tm.role = 'admin'
  ) then
    raise exception 'Actor is not an administrator for this submission';
  end if;

  if p_mark_first_viewed and v_is_draft then
    return query
      select
        'ineligible'::text,
        v_current_stage,
        v_agency,
        v_is_test,
        v_client_company_name,
        v_client_email,
        v_org_id;
    return;
  end if;

  -- This page-view fact is independent of which stage transition wins.
  -- Recording it before the outcome branches covers unchanged and conflict
  -- races without duplicating stage audit events or notification delivery.
  if p_mark_first_viewed then
    update public.submissions
    set first_viewed_by_admin_at = coalesce(first_viewed_by_admin_at, now())
    where id = p_submission_id;
  end if;

  if v_current_stage = p_new_stage then
    return query
      select
        'unchanged'::text,
        v_current_stage,
        v_agency,
        v_is_test,
        v_client_company_name,
        v_client_email,
        v_org_id;
    return;
  end if;

  if v_current_stage <> p_expected_stage then
    return query
      select
        'conflict'::text,
        v_current_stage,
        v_agency,
        v_is_test,
        v_client_company_name,
        v_client_email,
        v_org_id;
    return;
  end if;

  update public.submissions
  set
    stage = p_new_stage,
    updated_at = now()
  where id = p_submission_id;

  insert into public.audit_log (
    submission_id,
    org_id,
    actor_id,
    event_type,
    event_detail
  )
  values (
    p_submission_id,
    v_org_id,
    p_actor_id,
    p_event_type,
    coalesce(p_event_detail, '{}'::jsonb) || jsonb_build_object(
      'from', v_current_stage,
      'to', p_new_stage
    )
  );

  return query
    select
      'applied'::text,
      p_new_stage,
      v_agency,
      v_is_test,
      v_client_company_name,
      v_client_email,
      v_org_id;
end;
$$;

commit;
