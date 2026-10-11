import webpush from "web-push";
import { prisma } from "./db.js";

const pub = process.env.VAPID_PUBLIC_KEY;
const priv = process.env.VAPID_PRIVATE_KEY;
export const pushEnabled = !!(pub && priv);
if (pushEnabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub!, priv!);

/** Creates an in-app notification and, when VAPID keys are configured, a Web Push to every subscription of the profile. */
export async function notify(profileId: string, type: string, title: string, body: string, actions?: any) {
  const n = await prisma.notification.create({ data: { profileId, type, title, body, actions: actions ?? undefined } });
  if (pushEnabled) {
    const subs = await prisma.pushSub.findMany({ where: { profileId } });
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys as any }, JSON.stringify({ title, body, id: n.id, actions: actions ?? [] }));
      } catch (e: any) {
        if (e.statusCode === 404 || e.statusCode === 410) await prisma.pushSub.delete({ where: { id: s.id } }).catch(() => {});
      }
    }));
  }
  return n;
}
