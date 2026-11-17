-- 写真を送れるアカウントを、決めたメールアドレスだけに限る。
-- （このプロジェクトに以前のシステムのアカウントが残っていても、それらでは使えないようにするため）
-- 実行する前に、メールアドレスを書き換える。複数なら in ('a@example.com', 'b@example.com') のように並べる。

drop policy "insert own pending jobs" on public.read_jobs;

create policy "insert own pending jobs" on public.read_jobs
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending' and result is null and error is null
    and (select auth.jwt() ->> 'email') in ('ここに自分のメールアドレス')
  );
