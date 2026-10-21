import { toDate } from "../domain/time.js";
import { currentLocale, t } from "./i18n.js";

// A missing timestamp means the server has not confirmed the write yet.
export function formatDate(value, { time = false } = {}) {
  const date = toDate(value);
  if (!date) return t("time.pending");
  const options = time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" };
  return new Intl.DateTimeFormat(currentLocale(), options).format(date);
}

export function formatRelative(value, now = Date.now()) {
  const date = toDate(value);
  if (!date) return t("time.pending");
  const seconds = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(currentLocale(), { numeric: "auto" });
  if (abs < 60) return formatter.format(0, "second");
  if (abs < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return formatter.format(Math.round(seconds / 3600), "hour");
  if (abs < 30 * 86400) return formatter.format(Math.round(seconds / 86400), "day");
  return formatDate(date);
}
