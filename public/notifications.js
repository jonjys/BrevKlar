/* Brevklar — deadline push notifications (browser Notification API) */

const NOTIF_KEY = 'bk_notif_v1';

function _getNotifState() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}'); } catch { return {}; }
}
function _saveNotifState(s) {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(s)); } catch {}
}

function _notifSupported() {
  return 'Notification' in window;
}

async function requestNotifPermission() {
  if (!_notifSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const p = await Notification.requestPermission();
  return p === 'granted';
}

function _fire(title, body, tag) {
  if (!_notifSupported() || Notification.permission !== 'granted') return;
  const n = new Notification(title, {
    body,
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    tag,
    requireInteraction: false,
  });
  n.onclick = () => { window.focus(); window.location.href = '/calendar'; n.close(); };
}

function checkDeadlineNotifications() {
  if (!_notifSupported() || Notification.permission !== 'granted') return;

  const deadlines = JSON.parse(localStorage.getItem('bk_deadlines') || '[]');
  if (!deadlines.length) return;

  const state = _getNotifState();
  const notified = state.notified || {};
  const today = new Date(); today.setHours(0, 0, 0, 0);

  deadlines.forEach((dl) => {
    if (!dl.dueDate) return;
    const due = new Date(dl.dueDate); due.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((due - today) / 86400000);
    if (daysLeft < 0 || daysLeft > 7) return;

    const windows = daysLeft === 0 ? [0] : [7, 3, 1].filter((w) => daysLeft <= w);
    windows.forEach((w) => {
      const key = `${dl.id}-${w}d`;
      if (notified[key]) return;

      const dLabel = daysLeft === 0
        ? 'Förfaller IDAG'
        : `Deadline om ${daysLeft} dag${daysLeft === 1 ? '' : 'ar'}`;
      const sender = dl.senderName ? ` — ${dl.senderName}` : '';
      _fire(`⏰ ${dLabel}`, (dl.description || 'Deadline') + sender, `bk-${key}`);
      notified[key] = true;
    });
  });

  state.notified = notified;
  _saveNotifState(state);
}

/* Called from scan.js after a successful analysis that produced deadlines */
async function tryScheduleNotificationsAfterAnalysis(data) {
  const hasDeadlines = (data?.deadlines || []).some((d) => d.dueDate);
  if (!hasDeadlines) return;
  const granted = await requestNotifPermission();
  if (granted) checkDeadlineNotifications();
}

/* Auto-check on every page load (fires notifications if already granted) */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(checkDeadlineNotifications, 1500);
});
