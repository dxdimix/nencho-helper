import Anthropic from "@anthropic-ai/sdk";

// 認証情報は環境変数 ANTHROPIC_API_KEY から読む。コードに直接書かない。
// 接続先は Anthropic の API に固定する（環境側の ANTHROPIC_BASE_URL に影響されないようにする）。
export const claude = new Anthropic({ baseURL: "https://api.anthropic.com" });

export const MODEL = "claude-opus-5-5";
