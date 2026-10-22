# Open Project prompt loop

Treat the user's prompts as continuing instructions for the same product. Preserve earlier requirements unless the user explicitly changes them.

For each prompt:

1. Extract the requested outcome and acceptance criteria; carry forward relevant constraints.
2. Inspect the current implementation and reproduce any reported problem.
3. Implement the smallest complete change that meets the request.
4. Verify the actual delivered artifact through the affected user flow.
5. Publish when authorized, verify the URL, and report what works and any remaining limitation.
6. Incorporate the user's next prompt and repeat.

Current priority: transfer the complete source to another environment, then build, diagnose and install the Mac app locally on the user's M4 Pro. The Mac build repeatedly fails on that machine; do not present it as fixed based on CI alone. Do not set up GitHub hosting. See START-HERE.md for current evidence and the local builder.

Retained product requirements: powerful MS Project-style planning; polished, calm, light interface; movable and color-coded Gantt tasks; resources; completion tracking; baselines; reusable templates; AI analysis and changes from prompts; sharing. Browser-local planning is available as a fallback; live AI and sharing require the server deployment and provider configuration.
