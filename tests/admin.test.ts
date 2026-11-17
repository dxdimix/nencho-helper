import { describe, expect, it } from "vitest";
import { buildInviteLink, DEFAULT_APP_URL, normalizeEmail } from "../local/admin.mjs";

describe("招待リンク", () => {
  it("アプリのアドレスに、リンクの情報を付ける", () => {
    const link = buildInviteLink(DEFAULT_APP_URL, "abc123", "invite");
    expect(link).toBe("https://dxdimix.github.io/nencho-helper/?token_hash=abc123&type=invite");
  });
  it("メールアドレスを小文字にそろえ、形式が違えば知らせる", () => {
    expect(normalizeEmail("  Taro@Example.COM ")).toBe("taro@example.com");
    expect(() => normalizeEmail("taro")).toThrow("形式");
  });
});
