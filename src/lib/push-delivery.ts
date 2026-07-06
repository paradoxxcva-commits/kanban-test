import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const sendPushNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        title: z.string(),
        body: z.string().optional(),
        url: z.string().optional(),
        tag: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if user has browser_push enabled
    const { data: prefs } = await supabaseAdmin
      .from("notification_preferences")
      .select("browser_push")
      .eq("user_id", data.userId)
      .maybeSingle();

    if (prefs && prefs.browser_push === false) return { sent: false, reason: "disabled" };

    // Get user's push subscriptions
    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", data.userId);

    if (error || !subs?.length) return { sent: false, reason: "no_subscriptions" };

    const webPush = await import("web-push");
    const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return { sent: false, reason: "no_vapid_keys" };

    webPush.setVapidDetails(
      "mailto:admin@planka.local",
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
    );

    const payload = JSON.stringify({
      title: data.title,
      body: data.body || "",
      url: data.url || "/",
      tag: data.tag || "planka",
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (err: any) {
        // Remove dead subscriptions (410 Gone or expired)
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
        }
      }
    }

    return { sent, total: subs.length };
  });
