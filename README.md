# pi-loop-guard

[![npm](https://img.shields.io/npm/v/pi-loop-guard)](https://www.npmjs.com/package/pi-loop-guard)

Detects when pi's LLM gets stuck repeating the same tool calls and breaks the loop before it wastes tokens.

[中文版](README.zh.md)

## Quick Install

```bash
pi install npm:pi-loop-guard
```

## What It Does

pi-loop-guard monitors every turn and watches for two loop patterns:

| Pattern | Example |
|---------|---------|
| **Consecutive** | `AAAA` — same tool + same args, turn after turn |
| **Alternating** | `ABABAB` — two calls bouncing back and forever |

When a loop is detected, pi-loop-guard injects a steering message telling the model to either try a different approach or stop and report results.

## Configuration

Create `.pi/loop-guard.json` in your project root (optional):

```json
{
  "maxRepeats": 5,
  "windowSize": 5,
  "enabled": true
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `maxRepeats` | `5` | Number of identical turns before triggering |
| `windowSize` | `5` | How many recent turns to check |
| `enabled` | `true` | Set `false` to disable without uninstalling |

## Why Not Just Rely on the Model?

Models sometimes loop — especially with tool-calling. Even with good prompting, a model can call `read` on the same file 10+ times when confused. pi-loop-guard is a safety net that costs nothing when there's no loop and saves tokens when there is.

## How It Works

1. On each `turn_end`, extract the tool calls from the assistant message
2. Compare against recent turn history (up to `windowSize` turns back)
3. If `maxRepeats` identical turns are found (consecutive or alternating), inject a steering message and reset history
4. On `session_shutdown`, clear history

## License

MIT
