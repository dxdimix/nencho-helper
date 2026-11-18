import { describe, expect, it } from "vitest";
import { formatDateText, parseDateText } from "../src/lib/dateText";

describe("生年月日の手入力", () => {
  it("8桁の数字", () => {
    expect(parseDateText("19881212")).toBe("1988-12-12");
    expect(parseDateText("２００５０１０２")).toBe("2005-01-02");
  });
  it("区切りのある形", () => {
    expect(parseDateText("1988/12/12")).toBe("1988-12-12");
    expect(parseDateText("1988-1-2")).toBe("1988-01-02");
    expect(parseDateText("1988年1月2日")).toBe("1988-01-02");
  });
  it("ない日付・途中の入力は null", () => {
    expect(parseDateText("19880230")).toBeNull();
    expect(parseDateText("20230229")).toBeNull();
    expect(parseDateText("20240229")).toBe("2024-02-29");
    expect(parseDateText("198812")).toBeNull();
    expect(parseDateText("")).toBeNull();
  });
  it("表示用の形", () => {
    expect(formatDateText("1988-12-12")).toBe("1988/12/12");
    expect(formatDateText("")).toBe("");
  });
});
