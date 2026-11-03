// Deploy as a Supabase Edge Function and invoke it every minute with Supabase Cron.
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_NAME.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
  const templateName = Deno.env.get("WHATSAPP_TEMPLATE_NAME") || "sheplates_schedule_reminder";
  if (!url || !key || !token || !phoneId) return new Response("Missing provider secrets", { status: 503 });
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: rows, error } = await supabase.from("communication_outbox").select("id,recipient_id,template_key,payload").eq("channel", "whatsapp").eq("status", "queued").lte("scheduled_for", new Date().toISOString()).limit(50);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  let sent = 0;
  for (const row of rows || []) {
    await supabase.from("communication_outbox").update({ status: "sending" }).eq("id", row.id).eq("status", "queued");
    const phone = String(row.payload?.phone || "").replace(/\D/g, "");
    const response = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "template", template: { name: templateName, language: { code: "en" }, components: [{ type: "body", parameters: [{ type: "text", text: row.template_key }] }] } }),
    });
    const result = await response.json();
    if (response.ok) { sent += 1; await supabase.from("communication_outbox").update({ status: "sent", provider_message_id: result.messages?.[0]?.id || null, sent_at: new Date().toISOString(), last_error: null }).eq("id", row.id); }
    else await supabase.from("communication_outbox").update({ status: "failed", last_error: JSON.stringify(result).slice(0, 2000) }).eq("id", row.id);
  }
  return Response.json({ processed: rows?.length || 0, sent });
});

