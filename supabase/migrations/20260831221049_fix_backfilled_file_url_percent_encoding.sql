-- Corrects a bug in 20260831214241_backfill_file_url_to_storage_path.sql:
-- that migration stripped the public-URL prefix but left the remainder
-- percent-encoded (e.g. "%20" for a space), because the stored public URL
-- was itself percent-encoded. The actual object key in storage.objects is
-- the raw, unencoded string originally passed to `.upload()` — certification
-- and deliverable uploads never sanitized filenames, so real filenames with
-- spaces/parens ended up with a file_url that no longer matches the real
-- storage key, breaking createSignedUrl() for those rows.
--
-- Decodes any percent-encoded sequences back to their raw characters. A
-- no-op on paths that were never encoded (submission_documents' upload path
-- already sanitizes filenames to safe characters, so most of its rows have
-- nothing to decode) and safe to run more than once (decoding an
-- already-decoded string with no "%XX" sequences left is a no-op).

create or replace function pg_temp.url_decode(input text) returns text as $$
declare
  bin bytea := '';
  c text;
  i int := 1;
begin
  while i <= length(input) loop
    c := substr(input, i, 1);
    if c = '%' and i + 2 <= length(input) then
      bin := bin || decode(substr(input, i + 1, 2), 'hex');
      i := i + 3;
    else
      bin := bin || convert_to(c, 'UTF8');
      i := i + 1;
    end if;
  end loop;
  return convert_from(bin, 'UTF8');
end;
$$ language plpgsql immutable;

update "public"."submission_documents"
set file_url = pg_temp.url_decode(file_url)
where file_url like '%\%%' escape '\';

update "public"."deliverables"
set file_url = pg_temp.url_decode(file_url)
where file_url like '%\%%' escape '\';

update "public"."client_certifications"
set file_url = pg_temp.url_decode(file_url)
where file_url like '%\%%' escape '\';
