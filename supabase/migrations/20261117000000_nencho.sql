-- サクッとねんちょー：Supabase の設定（何度実行しても大丈夫）。
-- ほかのアプリと混ざらないよう、表はすべて専用のスキーマ「nencho」に置く。
-- 以前の手順で public.read_jobs を作っていた場合は、nencho に移す。
--
-- 実行したあと、管理画面の「Project Settings」→「Data API」の「Exposed schemas」に nencho を追加する。

create schema if not exists nencho;
grant usage on schema nencho to anon, authenticated, service_role;

-- 以前の手順で作った public.read_jobs があれば、nencho に移す（中身・ルールも一緒に移る）
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'read_jobs')
     and not exists (select 1 from information_schema.tables where table_schema = 'nencho' and table_name = 'read_jobs') then
    execute 'alter table public.read_jobs set schema nencho';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 招待した人（ここにいる人だけが「写真で登録」を使える）。
-- 追加・削除は自宅PCのアプリが secret キーで行う（画面からは変更できない）。
create table if not exists nencho.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  invited_at timestamptz not null default now()
);
alter table nencho.members enable row level security;
drop policy if exists "read own membership" on nencho.members;
create policy "read own membership" on nencho.members
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- スマホの画面と自宅PCの間で、ハガキの写真を受け渡す表。
-- 画面が写真を status = 'pending' で追加 → 自宅PCが読み取り、結果を書いて写真を消す → 画面が結果を受け取って行を消す。
-- 消し忘れは、自宅PCが15分以上前の行を自動で消す。
create table if not exists nencho.read_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- [{ "type": "image/jpeg", "data": "<base64>" }]。読み取り後は null にする
  images jsonb,
  -- pending: PCの読み取り待ち / processing: 読み取り中 / done: 完了 / error: 失敗
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'error')),
  result text,
  error text,
  created_at timestamptz not null default now(),
  -- 写真が大きすぎる送信を防ぐ（約12MBまで）
  constraint read_jobs_images_size check (images is null or pg_column_size(images) < 12000000)
);
create index if not exists read_jobs_pending_idx on nencho.read_jobs (created_at) where status = 'pending';
alter table nencho.read_jobs enable row level security;

drop policy if exists "read own jobs" on nencho.read_jobs;
create policy "read own jobs" on nencho.read_jobs
  for select to authenticated
  using (user_id = (select auth.uid()));

-- 写真を送れるのは、招待された本人だけ
drop policy if exists "insert own pending jobs" on nencho.read_jobs;
create policy "insert own pending jobs" on nencho.read_jobs
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending' and result is null and error is null
    and exists (select 1 from nencho.members m where m.user_id = (select auth.uid()))
  );

drop policy if exists "delete own jobs" on nencho.read_jobs;
create policy "delete own jobs" on nencho.read_jobs
  for delete to authenticated
  using (user_id = (select auth.uid()));
-- 更新（結果の書き込み）は自宅PCのアプリだけが secret キーで行う（RLS の対象外）。

-- ---------------------------------------------------------------------------
-- 画面（ログインした人）と自宅PC（secret キー）が、表を使えるようにする
grant select, insert, delete on nencho.read_jobs to authenticated;
grant select on nencho.members to authenticated;
grant all on nencho.read_jobs, nencho.members to service_role;
