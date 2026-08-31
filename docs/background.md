---
title: plainlog - Background
tags:
  - project
  - plainlog
status: active
---

# Background

`plainlog` is a lightweight, pluggable, testable logger for Node.js and the
browser. Published on npm as `plainlog` (repo: `damiensmith1/logger-kit` /
`damiensmith1/plainlog`), currently at v1.0.0.

This doc set replaces and formalizes the original idea note — see
[[Logger]] for the initial pitch this project grew out of.

## Why it exists

Existing loggers didn't fit:

- **Winston** is flexible, but that flexibility brings structure/abstraction
  that makes it easy for logging to become inconsistent or hard to reason
  about once you add formats, transports, and custom behavior. It's often
  unclear *why* a log looks the way it does or where its context came from.
- **Pino** is fast, but rigid. Great for high log volume, not especially
  friendly when you want explicit context, buffering, or to test logging
  behavior directly. Optimized for throughput, not application-level
  ergonomics.

## What plainlog is instead

A logger where:

- Context is **explicit**, not global/async-magic — attached to a specific
  logger instance and passed down deliberately, so it's obvious where data
  came from and there's no cross-request leakage risk.
- Transport failures are isolated — a broken transport can't crash the app
  or the rest of logging.
- Behavior is small enough to fully understand, and easy to assert on in
  tests.
- It works identically in Node and the browser.

Not trying to replace Winston or Pino for their strengths (ecosystem size,
raw throughput) — this is for application code where clarity, safety, and
control matter more than either of those.

## Prior art / origin

Original scope and rationale captured in [[Logger]] before implementation
started. The shipped v1.0.0 has grown beyond that note's original plan (e.g.
`FileTransport` was listed as "future" there and is already implemented).
