import { toDate } from "../domain/time.js";
import { currentLocale, t } from "./i18n.js";

// A missing timestamp means the server has not confirmed the write yet.
export function formatDate(value, { time = false } = {}) {
  const date = toDate(value);
  if (!date) return t("time.pending");
  const options = time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" };
  return new Intl.DateTimeFormat(currentLocale(), options).format(date);
}

// Intl.RelativeTimeFormat puts the number in parentheses for Hebrew special forms ("לפני שעתיים (2)"),
// so the short relative labels come from our own translations.
export function formatRelative(value, now = Date.now()) {
  const date = toDate(value);
  if (!date) return t("time.pending");
  const seconds = Math.floor((now - date.getTime()) / 1000);
  if (seconds < 60) return t("time.now");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("time.daysAgo", { count: days });
  return formatDate(date);
}
