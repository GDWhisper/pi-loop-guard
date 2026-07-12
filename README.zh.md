# pi-loop-guard

[![npm](https://img.shields.io/npm/v/pi-loop-guard)](https://www.npmjs.com/package/pi-loop-guard)

检测 pi 的 LLM 是否陷入重复工具调用循环，并在浪费 token 之前强制中断。

[English](README.md)

## 快速安装

```bash
pi install npm:pi-loop-guard
```

## 它能做什么

pi-loop-guard 监控每一轮对话，检测两种循环模式：

| 模式 | 示例 |
|------|------|
| **连续重复** | `AAAA` — 连续多轮调用相同工具 + 相同参数 |
| **交替重复** | `ABABAB` — 两个调用来回交替，永不停止 |

检测到循环后，pi-loop-guard 会向模型注入一条引导消息，要求它尝试不同方法，或停止并汇报结果。

## 配置

在项目根目录创建 `.pi/loop-guard.json`（可选）：

```json
{
  "maxRepeats": 5,
  "windowSize": 5,
  "enabled": true
}
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `maxRepeats` | `5` | 连续多少轮相同调用后触发 |
| `windowSize` | `5` | 回溯检查最近多少轮 |
| `enabled` | `true` | 设为 `false` 可临时禁用 |

## 为什么模型自己不会停？

即使提示写得再好，模型在工具调用场景下也可能陷入循环 —— 尤其当它对结果困惑时，可能会连续读取同一个文件十几次。pi-loop-guard 是一个低成本的安全网：没有循环时不产生任何开销，检测到循环时立刻止损。

## 工作原理

1. 每次 `turn_end` 时，提取助手消息中的工具调用
2. 与最近 `windowSize` 轮的历史记录比较
3. 如果发现 `maxRepeats` 轮相同的调用（连续或交替），注入引导消息并重置历史
4. `session_shutdown` 时清空历史

## 开源协议

MIT License

Copyright (c) 2026 GDWhisper
