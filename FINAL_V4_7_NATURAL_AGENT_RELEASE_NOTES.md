# ShePlates v4.7.0 — Natural She Agent

## What changed

- Customer She Agent no longer uses browser-side keyword, regex, command, or phrase routing for commerce requests.
- Every normal customer message is sent to the conversational reasoning layer together with authorised ShePlates context and recent conversation history.
- The assistant returns structured, validated actions for browsing, recommendation, basket changes, navigation, tracking, support, quality issues, and clarification.
- Nearby catalogue requests now use the same serviceable marketplace catalogue that powers the customer Marketplace screen.
- Product IDs returned by the assistant are validated against the currently available catalogue before cards or basket actions are shown.
- Budget-constrained selections are validated before they reach the UI.
- Conversation history now includes the product IDs shown in earlier recommendations, allowing natural follow-ups such as referring to earlier choices without phrase-specific code.
- Quality complaints are interpreted conversationally; when a photo is needed, the UI opens the existing evidence flow and keeps final refund approval with Operations.
- Support-ticket creation can be proposed from natural conversation and is converted into the existing ticket workflow.
- Persistent shopping preference memory remains governed and user-clearable.

## Product copy cleanup

Customer- and staff-facing screens no longer expose provider names, infrastructure names, credential names, internal access-control terminology, model names, or developer setup instructions. Product copy now uses neutral language such as “account service”, “latest data”, “She Agent”, and “live account”.

## Validation

- 91 TypeScript/TSX files parsed: 0 syntax errors.
- 18 static/regression contract tests passed.
- Added regression coverage that checks the customer chat no longer contains the old hard-coded recommendation, tracking, budget, or add-to-cart intent detectors.
- Added product-copy regression coverage for implementation-name leakage.

## Important runtime requirement

She Agent’s natural conversation requires the server-side conversational service to be configured. If it is temporarily unavailable, She Agent returns a short neutral availability message rather than pretending to understand through a hard-coded fallback.
