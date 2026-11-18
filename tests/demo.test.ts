import { describe, expect, it } from "vitest";
import { DEMO_EMAIL, DEMO_PASSWORD, demoLogin } from "../src/lib/demo.mjs";

describe("デモ用アカウント", () => {
  it("0000 / 0000 を実際の値に置き換える", () => {
    expect(demoLogin("0000", "0000")).toEqual({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    expect(demoLogin(" 0000 ", "0000")).toEqual({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  });
  it("パスワードが違えば置き換えない（ログインに失敗させる）", () => {
    expect(demoLogin("0000", "1234")).toEqual({ email: DEMO_EMAIL, password: "1234" });
  });
  it("ふつうのメールアドレスはそのまま", () => {
    expect(demoLogin("a@b.jp", "pass1234")).toEqual({ email: "a@b.jp", password: "pass1234" });
  });
  it("Supabase の条件（6文字以上）を満たす", () => {
    expect(DEMO_PASSWORD.length).toBeGreaterThanOrEqual(6);
  });
});
