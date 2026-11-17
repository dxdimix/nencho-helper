import { describe, expect, it } from "vitest";
import { createWorker } from "../local/cloud.mjs";

type Job = { id: string; status: string; images: unknown; result?: string; error?: string; created_at: string };

// Supabase の代わりの、メモリ上の偽物
function fakeRepo(jobs: Job[]) {
  return {
    jobs,
    async nextPending() {
      return jobs.find((j) => j.status === "pending")?.id ?? null;
    },
    async claim(id: string) {
      const j = jobs.find((x) => x.id === id && x.status === "pending");
      if (!j) return false;
      j.status = "processing";
      return true;
    },
    async images(id: string) {
      return jobs.find((x) => x.id === id)!.images;
    },
    async finish(id: string, result: string) {
      Object.assign(jobs.find((x) => x.id === id)!, { status: "done", result, images: null });
    },
    async fail(id: string, error: string) {
      Object.assign(jobs.find((x) => x.id === id)!, { status: "error", error, images: null });
    },
    async cleanup(before: string) {
      for (let i = jobs.length - 1; i >= 0; i--) if (jobs[i].created_at < before) jobs.splice(i, 1);
    },
  };
}

describe("Supabase 経由の読み取り（自宅PC側）", () => {
  const img = [{ type: "image/jpeg", data: "AAAA" }];
  it("待っている写真を読み取り、結果を書いて写真を消す", async () => {
    const repo = fakeRepo([{ id: "a", status: "pending", images: img, created_at: new Date().toISOString() }]);
    const worker = createWorker(repo, { read: async () => '{"life":[]}' });
    expect(await worker.tick()).toBe(true);
    expect(repo.jobs[0]).toMatchObject({ status: "done", result: '{"life":[]}', images: null });
    expect(await worker.tick()).toBe(false); // もう待っているものはない
  });
  it("読み取りに失敗したら、理由を書いて写真を消す", async () => {
    const repo = fakeRepo([{ id: "a", status: "pending", images: img, created_at: new Date().toISOString() }]);
    const worker = createWorker(repo, { read: async () => { throw new Error("Claude Code がエラーで終了しました。"); } });
    await worker.tick();
    expect(repo.jobs[0]).toMatchObject({ status: "error", images: null });
    expect(repo.jobs[0].error).toContain("Claude Code");
  });
  it("15分以上前の行は消す", async () => {
    const now = Date.now();
    const repo = fakeRepo([
      { id: "old", status: "done", images: null, created_at: new Date(now - 20 * 60_000).toISOString() },
      { id: "new", status: "pending", images: img, created_at: new Date(now - 60_000).toISOString() },
    ]);
    await createWorker(repo, { read: async () => "" }).cleanup(now);
    expect(repo.jobs.map((j) => j.id)).toEqual(["new"]);
  });
});
