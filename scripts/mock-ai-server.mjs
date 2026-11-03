// A stand-in for the AI model service, for testing She Agent's plumbing without spending credits.
// Run:  node scripts/mock-ai-server.mjs   then start the app with  AI_API_BASE=http://localhost:9911/v1 OPENAI_API_KEY=test
// MOCK_DELAY_MS sets the simulated model time per call (default 700). MOCK_REJECT_FAST=1 makes it refuse the
// latency settings with a 400, like a model that does not support them.
import http from "node:http";
const delay = Number(process.env.MOCK_DELAY_MS || 700), reject = process.env.MOCK_REJECT_FAST === "1";
const log = [];
const final = (reply) => ({ reply, intent: "answer", budget: -1, selectedProductIds: [], basketProductIds: [], removeProductIds: [], navigateTo: "", clarifyingQuestion: "", requiresPhoto: false, targetOrderId: "", createTicket: false, ticketSubject: "", ticketCategory: "Other", ticketPriority: "Normal", memoryUpdates: [] });
const message = (obj) => ({ id: "resp_" + Math.random().toString(36).slice(2), status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(obj) }] }] });
http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/log") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(log)); }
  let raw = ""; req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw || "{}");
    log.push({ at: Date.now(), first: !body.previous_response_id, reasoning: body.reasoning, verbosity: body.text?.verbosity, model: body.model });
    if (reject && (body.reasoning || body.text?.verbosity)) { res.statusCode = 400; res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ error: { message: "Unsupported parameter: 'reasoning' is not supported with this model.", code: "unsupported_parameter" } })); }
    if (body.stream) {
      // streamed: the first words arrive after MOCK_FIRST_TOKEN_MS, then the rest at ~25 ms per chunk
      res.setHeader("content-type", "text/event-stream");
      const text = String(body.input || "");
      const useTool = !body.previous_response_id && /protein|basket|cart/i.test(text);
      const finished = useTool
        ? { id: "resp_tool", status: "completed", output: [{ type: "function_call", call_id: "call_1", name: "get_current_cart", arguments: "{}" }] }
        : message(final(body.previous_response_id ? "Your basket is empty. Want me to suggest something?" : "Hi! How can I help with your food shopping today?"));
      const send = (evt) => res.write(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`);
      const first = Number(process.env.MOCK_FIRST_TOKEN_MS || 300);
      setTimeout(() => {
        if (useTool) { send({ type: "response.completed", response: finished }); return res.end(); }
        const full = finished.output[0].content[0].text; let i = 0;
        const tick = () => { if (i >= full.length) { send({ type: "response.completed", response: finished }); return res.end(); } send({ type: "response.output_text.delta", delta: full.slice(i, i + 6) }); i += 6; setTimeout(tick, 25); };
        tick();
      }, first);
      return;
    }
    setTimeout(() => {
      res.setHeader("content-type", "application/json");
      const text = String(body.input || "");
      if (!body.previous_response_id && /protein|basket|cart/i.test(text)) {
        return res.end(JSON.stringify({ id: "resp_tool", status: "completed", output: [{ type: "function_call", call_id: "call_1", name: "get_current_cart", arguments: "{}" }] }));
      }
      res.end(JSON.stringify(message(final(body.previous_response_id ? "Your basket is empty. Want me to suggest something?" : "Hi! How can I help with your food shopping today?"))));
    }, delay);
  });
}).listen(9911, () => console.log("mock AI service on :9911, delay", delay, "ms"));
