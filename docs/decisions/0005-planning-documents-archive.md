# 0005 Planning documents archive

Context: P7-02 moves `SUMMARY.md`, `PLAN.md` and `FINAL_PLAN.md` to `docs/archive/`.

Finding: only `PLAN.md` was tracked on `refactor/template-v1`; `SUMMARY.md` and `FINAL_PLAN.md` existed only in the planning worktree.

Decision: archive the tracked `PLAN.md` and add the two planning documents from the planning worktree, excluded from the MkDocs build and from `scripts/init.mjs` rewrites.
