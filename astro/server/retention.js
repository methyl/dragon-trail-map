// Used both by request-time housekeeping and the scheduled cleanup Worker.
export async function prune(db, now = Math.floor(Date.now() / 1000)) {
  return db.batch([
    db.prepare('DELETE FROM waitlist_rate_limits WHERE expires_at < ?').bind(now),
    db.prepare("DELETE FROM waitlist_subscribers WHERE status='pending' AND updated_at < ?").bind(now - 7 * 86400),
    db.prepare("DELETE FROM waitlist_subscribers WHERE status='unsubscribed' AND updated_at < ?").bind(now - 30 * 86400),
    // One-off list is not a newsletter. Remove notified rows after 30 days.
    db.prepare('DELETE FROM waitlist_subscribers WHERE notified_at IS NOT NULL AND notified_at < ?').bind(now - 30 * 86400),
    // Hard stop after race day, even if no notification campaign was sent.
    db.prepare('DELETE FROM waitlist_subscribers WHERE ? >= ?').bind(now, Date.parse('2027-05-16T00:00:00Z') / 1000),
  ]);
}
