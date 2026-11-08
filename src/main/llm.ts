import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { net } from "electron";
import * as dotenv from "dotenv";
import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

export interface ConfiguredModel {
  model: LanguageModel;
  // e.g. "anthropic/claude-sonnet-5-5", for logs
  label: string;
}

// Chromium's network stack instead of Node's fetch: it trusts the OS certificate
// store (e.g. a company gateway's internal CA) and honors system proxy settings.
const systemFetch = net.fetch as unknown as typeof globalThis.fetch;

// Shared by the sidebar chat and the companion agent. Config comes only from
// the repo's .env, never from the shell environment.
export function createModel(): ConfiguredModel | null {
  const env = readDotEnv();
  const anthropicKey = env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN;
  const provider = env.LLM_PROVIDER?.toLowerCase();

  if (provider === "openai" || (!provider && !anthropicKey)) {
    if (!env.OPENAI_API_KEY) return null;
    const name = env.LLM_MODEL || "gpt-5";
    const openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
      fetch: systemFetch,
    });
    return { model: openai(name), label: `openai/${name}` };
  }
  if (!anthropicKey) return null;

  const baseURL = env.ANTHROPIC_BASE_URL?.replace(/\/+$/, "");
  const name = env.LLM_MODEL || "claude-sonnet-5-5";
  const anthropic = createAnthropic({
    apiKey: anthropicKey,
    fetch: systemFetch,
    // The SDK expects the /v1 prefix; ANTHROPIC_BASE_URL conventionally omits it
    baseURL: baseURL ? `${baseURL}/v1` : undefined,
  });
  return { model: anthropic(name), label: `anthropic/${name}` };
}

// Parsed directly instead of dotenv.config(), which would merge into
// process.env and let exported shell variables win.
function readDotEnv(): Record<string, string> {
  const file = join(__dirname, "../../.env");
  return existsSync(file) ? dotenv.parse(readFileSync(file)) : {};
}
