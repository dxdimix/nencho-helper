import Anthropic from "@anthropic-ai/sdk";

// 認証情報は環境変数 ANTHROPIC_API_KEY から読む。コードに直接書かない。
export const claude = new Anthropic();

export const MODEL = "claude-opus-5-5";
