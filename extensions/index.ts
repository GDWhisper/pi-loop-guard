/**
 * pi-loop-guard — Loop detection and prevention for pi
 *
 * Detects when the LLM gets stuck repeating the same tool calls
 * and forces it to stop and report results.
 *
 * Install: pi install npm:pi-loop-guard
 *
 * Config: .pi/loop-guard.json (project-local, optional)
 *   { "maxRepeats": 5, "windowSize": 5, "enabled": true }
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR_NAME, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ── Types ─────────────────────────────────────────────────────────────

type ToolCall = {
  name: string;
  args: string;
};

type TurnRecord = {
  toolCalls: ToolCall[];
  timestamp: number;
};

// ── Defaults ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  maxRepeats: 5,
  windowSize: 5,
  enabled: true,
};

// ── State ─────────────────────────────────────────────────────────────

let recentTurns: TurnRecord[] = [];
let config = { ...DEFAULT_CONFIG };

// ── Helpers ───────────────────────────────────────────────────────────

function serializeArgs(args: unknown): string {
  if (args === undefined || args === null) return "";
  try {
    return JSON.stringify(args, (_key: string, value: unknown) => {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return Object.keys(value as object)
          .sort()
          .reduce((acc: Record<string, unknown>, k: string) => {
            acc[k] = (value as Record<string, unknown>)[k];
            return acc;
          }, {});
      }
      return value;
    });
  } catch {
    return String(args);
  }
}

function extractToolCalls(message: unknown): ToolCall[] {
  if (!message || typeof message !== "object") return [];
  const msg = message as Record<string, unknown>;
  const content = msg.content;
  if (!Array.isArray(content)) return [];

  const calls: ToolCall[] = [];
  for (const part of content) {
    if (part && typeof part === "object" && (part as Record<string, unknown>).type === "toolCall") {
      const tc = part as Record<string, unknown>;
      calls.push({
        name: String(tc.name || ""),
        args: serializeArgs(tc.arguments),
      });
    }
  }
  return calls;
}

function turnsMatch(callsA: ToolCall[], callsB: ToolCall[]): boolean {
  if (callsA.length !== callsB.length) return false;
  return callsA.every((call, i) =>
    call.name === callsB[i]?.name && call.args === callsB[i]?.args
  );
}

function hasConsecutiveRepeat(calls: ToolCall[], window: TurnRecord[]): boolean {
  let matchCount = 0;
  for (const turn of [...window].reverse()) {
    if (!turnsMatch(calls, turn.toolCalls)) break;
    matchCount++;
    if (matchCount >= config.maxRepeats - 1) return true;
  }
  return false;
}

function hasAlternatingRepeat(calls: ToolCall[], window: TurnRecord[]): boolean {
  if (window.length < (config.maxRepeats - 1) * 2) return false;

  let matchCount = 0;
  for (let i = window.length - 2; i >= 0; i -= 2) {
    if (!turnsMatch(calls, window[i].toolCalls)) break;
    matchCount++;
    if (matchCount >= config.maxRepeats - 1) return true;
  }
  return false;
}

function isRepeating(calls: ToolCall[]): boolean {
  if (calls.length === 0) return false;

  const window = recentTurns.slice(-config.windowSize);
  if (window.length < config.maxRepeats - 1) return false;

  if (hasConsecutiveRepeat(calls, window)) return true;
  if (hasAlternatingRepeat(calls, window)) return true;

  return false;
}

// ── Extension entry ───────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // Load project-local config on session start
  pi.on("session_start", async (_event, ctx) => {
    try {
      const fullPath = join(ctx.cwd, CONFIG_DIR_NAME, "loop-guard.json");
      if (existsSync(fullPath)) {
        const saved = JSON.parse(readFileSync(fullPath, "utf8"));
        config = { ...DEFAULT_CONFIG, ...saved };
      }
    } catch {
      // use defaults if config is missing or malformed
    }
  });

  if (!config.enabled) return;

  pi.on("turn_end", async (event) => {
    const calls = extractToolCalls(event.message);

    if (isRepeating(calls)) {
      // Reset history to avoid repeated triggers after intervention
      recentTurns = [];

      pi.sendUserMessage(
        "[Loop Guard] You have run the same tool calls " +
        config.maxRepeats +
        " times in a row with identical output. This is a loop.\n" +
        "- If the task is NOT yet complete: try a different approach.\n" +
        "- If the task is blocked or already complete: stop and report results to the user.",
        { deliverAs: "steer" }
      );
    } else {
      recentTurns.push({ toolCalls: calls, timestamp: Date.now() });
      if (recentTurns.length > config.windowSize * 2) {
        recentTurns = recentTurns.slice(-config.windowSize);
      }
    }
  });

  pi.on("session_shutdown", async () => {
    recentTurns = [];
  });
}
