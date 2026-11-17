-- サクッとねんちょー：スマホの画面と自宅PCの間で、ハガキの写真を受け渡す表。
-- 画面がログインした本人として写真を status = 'pending' で追加し、
-- 自宅PCのアプリが secret キーで受け取り、Claude Code で読み取った結果を書き込む。
-- 写真（images）は読み取りが終わったらすぐ消し、画面は結果を受け取ったら行ごと消す。
-- 消し忘れに備えて、自宅PCのアプリが15分以上前の行を自動で消す。

create table public.read_jobs (
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

create index read_jobs_pending_idx on public.read_jobs (created_at) where status = 'pending';

alter table public.read_jobs enable row level security;

-- 画面からは、ログインした本人の行だけ読める・追加できる・消せる。
create policy "read own jobs" on public.read_jobs
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "insert own pending jobs" on public.read_jobs
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and result is null and error is null);

create policy "delete own jobs" on public.read_jobs
  for delete to authenticated
  using (user_id = (select auth.uid()));
-- 更新（結果の書き込み）は自宅PCのアプリだけが secret キーで行う（RLS の対象外）。
