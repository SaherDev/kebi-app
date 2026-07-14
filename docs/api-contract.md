# API Contract — product repo ↔ kebi

> **This file is a pointer, not a copy.** The canonical API contract lives in
> the **kebi repo** at `docs/api-contract.md`. Read and edit it there — do not
> re-add the full contract text here.

Maintaining a second full copy in this repo led to drift (the two versions fell
tens of KB apart), so the copy was collapsed to this pointer. There is now one
source of truth.

## Where it is

- **Repo:** `kebi` — https://github.com/SaherDev/kebi
- **File:** `docs/api-contract.md` in that repo

(Referenced by repo, not by filesystem path, so it holds however the repos are
checked out — siblings, nested, or cloned independently.)

## Why kebi is canonical

kebi is the **server** that implements every endpoint the contract describes,
and every contract change is driven by an ADR in that repo (`docs/decisions.md`)
— the change originates there and its code and tests live there. Keeping the
authoritative spec next to the implementation is what removes the drift.

## When you change the contract

1. Edit `docs/api-contract.md` in the **kebi repo** and record an ADR there.
2. Update this repo's client (NestJS gateway) to match the new shapes/headers.
3. Ship both repos in one coordinated deploy when the change is breaking (see the
   gateway-auth and table-rename coordination notes in the canonical contract).
