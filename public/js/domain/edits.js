import { EDITABLE_FIELDS } from "./constants.js";

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Editable fields whose values differ between two versions of a request. Used for the edit notice in the thread.
export function changedFields(before, after) {
  return EDITABLE_FIELDS.filter((field) => !same(before[field], after[field]));
}

// Every editable field, with null for empty values. Firestore rejects undefined, so callers never pass it.
export function pickEditable(values) {
  return Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, values[field] ?? null]));
}
