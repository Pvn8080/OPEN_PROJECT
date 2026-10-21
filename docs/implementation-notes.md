# Implementation decisions

These decisions were made while executing the approved implementation plan natively in the existing isolated cloud checkout.

1. Use Node 24 built-in SQLite rather than a native SQLite npm binding. This avoids an additional native binary installation and requires Node 24 or newer on the target machine.
2. Maintain the execution ledger directly because the cloud skill instructions did not expose executable task-helper paths. Task evidence is retained explicitly; helper automation is not available.
3. Store canonical scheduled project documents alongside relational authorization/history/invitation tables and per-entity projections. This simplifies atomic prototype changes; large analytical workloads may later need normalized task columns. Explicit earliest-start constraints are kept separate from calculated dates so automatic tasks can move earlier as well as later.
4. Debounce task-search filtering by 150 ms while keeping the input state local. Typing remains responsive on large plans; filtered results appear after that short pause.

The planner is a web prototype with real persistence and validation. Live AI requires secure provider configuration, and production operations and native desktop packaging remain separate work.
