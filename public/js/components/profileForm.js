import { h, setBusy } from "../core/dom.js";
import { describeError } from "../core/errors.js";
import { t } from "../core/i18n.js";
import { setStatus } from "../core/page.js";
import { LIMITS, PLATFORMS } from "../domain/constants.js";
import { validateProfile } from "../domain/validation.js";
import { updateDeveloper } from "../services/developers.js";
import { checkboxField, textField } from "./forms.js";
import { createPlatformPicker } from "./platformPicker.js";

// Edits the signed-in developer's own profile. The username and the suspended flag are left out on purpose:
// the rules keep both fixed, and the username is the developer's link.
// onSaved receives the saved profile. onCancel closes the form without saving.
export function createProfileForm(developer, { onSaved, onCancel }) {
  const accepted = developer.acceptedPlatforms ?? [];

  const displayName = textField({
    name: "displayName",
    label: t("onboarding.displayName"),
    value: developer.displayName ?? "",
    required: true,
    autocomplete: "name",
    max: 60,
  });
  const bio = textField({
    name: "bio",
    label: t("developer.bio"),
    value: developer.bio ?? "",
    multiline: true,
    rows: 3,
    max: LIMITS.bio.max,
  });
  const website = textField({
    name: "website",
    label: t("developer.website"),
    value: developer.website ?? "",
    type: "url",
    placeholder: "https://",
    help: t("developer.websiteHelp"),
  });
  const pricingNote = textField({
    name: "pricingNote",
    label: t("developer.pricingNote"),
    value: developer.pricingNote ?? "",
    max: LIMITS.pricingNote.max,
    help: t("developer.pricingNoteHelp"),
  });
  const platforms = createPlatformPicker({
    selected: accepted.filter((platform) => PLATFORMS.includes(platform)),
    custom: accepted.filter((platform) => !PLATFORMS.includes(platform)),
  });
  const accepting = checkboxField({
    name: "acceptingRequests",
    label: t("onboarding.accepting"),
    checked: developer.acceptingRequests === true,
    help: t("onboarding.acceptingHelp"),
  });
  const usesAi = checkboxField({
    name: "usesAi",
    label: t("developer.usesAi"),
    checked: developer.usesAi === true,
    help: t("developer.usesAiHelp"),
  });
  const status = h("p", {
    class: "form-status",
    role: "status",
    "aria-live": "polite",
    hidden: true,
  });
  const save = h(
    "button",
    { type: "submit", class: "btn btn-primary" },
    t("developer.saveProfile"),
  );

  const form = h(
    "form",
    { class: "onboarding-form", novalidate: true },
    h("h2", { class: "section-title" }, t("developer.editTitle")),
    displayName.root,
    bio.root,
    website.root,
    pricingNote.root,
    platforms.root,
    accepting.root,
    usesAi.root,
    h(
      "div",
      { class: "form-actions" },
      save,
      h(
        "button",
        { type: "button", class: "btn btn-ghost", onclick: onCancel },
        t("common.cancel"),
      ),
    ),
    status,
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const picked = platforms.read();
    const validation = validateProfile({
      displayName: displayName.read(),
      bio: bio.read(),
      website: website.read(),
      pricingNote: pricingNote.read(),
      acceptedPlatforms: picked.list ?? [],
      acceptingRequests: accepting.read(),
      usesAi: usesAi.read(),
    });
    const errors = { ...validation.errors };
    if (picked.error) errors.acceptedPlatforms = picked.error;
    displayName.setError(errors.displayName ?? null);
    bio.setError(errors.bio ?? null);
    website.setError(errors.website ?? null);
    pricingNote.setError(errors.pricingNote ?? null);
    platforms.setError(errors.acceptedPlatforms ?? null);

    if (Object.keys(errors).length > 0) {
      setStatus(status, t("form.fixErrors"), { error: true });
      return;
    }

    setBusy(save, true);
    try {
      await updateDeveloper(developer.uid, validation.values);
      onSaved({ ...developer, ...validation.values });
    } catch (error) {
      setStatus(status, describeError(error), { error: true });
    } finally {
      setBusy(save, false);
    }
  });

  return form;
}
