// Service worker: shows Web Push notifications and opens the app when tapped.
self.addEventListener("push", (event) => {
  let data = { title: "FitTrack AI", body: "" };
  try { data = event.data.json(); } catch (e) {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, tag: data.id, data, vibrate: [120, 60, 120] }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window" }).then((cs) => (cs.length ? cs[0].focus() : self.clients.openWindow("/notifications"))));
});
