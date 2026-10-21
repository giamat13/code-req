import { $, h, setBusy } from "../../core/dom.js";
import { icon } from "../../core/icons.js";
import { t } from "../../core/i18n.js";
import { describeError } from "../../core/errors.js";
import { setStatus } from "../../core/page.js";
import { developerUrl, pageUrl } from "../../core/router.js";
import { checkboxField, pillField, textField } from "../../components/forms.js";
import { copyButton, linkButton } from "../../components/ui.js";
import { PLATFORMS } from "../../domain/constants.js";
import { normalizeUsername, slugifyUsername, usernameError } from "../../domain/usernames.js";
import { validateProfile } from "../../domain/validation.js";
import { claimUsername, isUsernameTaken } from "../../services/developers.js";

const AVAILABILITY_DEBOUNCE_MS = 300;

// Username and profile setup. Runs once per account, before the dashboard is shown.
export function renderOnboarding(user) {
  const section = $("#onboarding");
  if (section.dataset.ready === user.uid) return;
  section.dataset.ready = user.uid;

  const username = textField({
    name: "username",
    label: t("onboarding.username"),
    value: slugifyUsername(user.displayName ?? user.email?.split("@")[0] ?? ""),
    required: true,
    autocomplete: "username",
    help: t("onboarding.usernameHelp"),
  });
  const displayName = textField({
    name: "displayName",
    label: t("onboarding.displayName"),
    value: user.displayName ?? "",
    required: true,
    autocomplete: "name",
    max: 60,
  });
  const platforms = pillField({
    name: "acceptedPlatforms",
    label: t("onboarding.platforms"),
    options: PLATFORMS.map((platform) => ({ value: platform, label: t(`platform.${platform}`) })),
    selected: PLATFORMS,
    required: true,
    help: t("onboarding.platformsHelp"),
  });
  const accepting = checkboxField({
    name: "acceptingRequests",
    label: t("onboarding.accepting"),
    checked: true,
    help: t("onboarding.acceptingHelp"),
  });
  const availability = h("p", { class: "availability", role: "status", "aria-live": "polite" });
  const status = h("p", {
    class: "form-status",
    role: "status",
    "aria-live": "polite",
    hidden: true,
  });
  const submit = h(
    "button",
    { type: "submit", class: "btn btn-primary", id: "claim-button" },
    t("onboarding.claim"),
  );

  const form = h(
    "form",
    { id: "onboarding-form", class: "onboarding-form", novalidate: true },
    h("h1", { class: "section-title" }, t("onboarding.title")),
    h("p", { class: "section-lead" }, t("onboarding.lead")),
    username.root,
    availability,
    displayName.root,
    platforms.root,
    accepting.root,
    h("div", { class: "form-actions" }, submit),
    status,
  );
  section.replaceChildren(form);

  let timer = null;
  let lastChecked = null;
  const checkAvailability = async () => {
    const name = normalizeUsername(username.read());
    const problem = usernameError(name);
    if (problem) {
      availability.textContent = t(problem);
      availability.dataset.state = "error";
      return false;
    }
    if (name === lastChecked) return availability.dataset.state === "ok";
    try {
      const taken = await isUsernameTaken(name);
      lastChecked = name;
      availability.textContent = taken
        ? t("onboarding.taken", { username: name })
        : t("onboarding.available", { username: name });
      availability.dataset.state = taken ? "error" : "ok";
      return !taken;
    } catch {
      availability.textContent = t("errors.network");
      availability.dataset.state = "error";
      return false;
    }
  };

  username.control.addEventListener("input", () => {
    lastChecked = null;
    clearTimeout(timer);
    timer = setTimeout(checkAvailability, AVAILABILITY_DEBOUNCE_MS);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = normalizeUsername(username.read());
    const validation = validateProfile({
      displayName: displayName.read(),
      acceptedPlatforms: platforms.read(),
      acceptingRequests: accepting.read(),
    });
    const errors = { ...validation.errors };
    const problem = usernameError(name);
    if (problem) errors.username = { key: problem };
    username.setError(errors.username ?? null);
    displayName.setError(errors.displayName ?? null);
    platforms.setError(errors.acceptedPlatforms ?? null);

    if (Object.keys(errors).length > 0) {
      setStatus(status, t("form.fixErrors"), { error: true });
      if (errors.username) username.control.focus();
      else if (errors.displayName) displayName.control.focus();
      else platforms.focus();
      return;
    }

    setBusy(submit, true);
    try {
      await claimUsername({
        uid: user.uid,
        username: name,
        profile: {
          ...validation.values,
          bio: null,
          website: null,
          pricingNote: null,
          avatarUrl: user.photoURL ?? null,
        },
      });
      showClaimed(name);
    } catch (error) {
      // A rejected claim usually means someone else took the name first.
      const message =
        error?.code === "permission-denied"
          ? t("onboarding.taken", { username: name })
          : describeError(error);
      setStatus(status, message, { error: true });
    } finally {
      setBusy(submit, false);
    }
  });
}

function showClaimed(username) {
  const link = new URL(developerUrl(username), location.href).href;
  $("#onboarding").replaceChildren(
    h("h1", { class: "section-title" }, t("onboarding.doneTitle")),
    h("p", {}, t("onboarding.doneBody")),
    h(
      "div",
      { class: "tracking" },
      h("label", { class: "field-label", for: "developer-link" }, t("onboarding.yourLink")),
      h("input", { id: "developer-link", class: "tracking-input", readonly: true, value: link }),
      copyButton({
        getText: () => link,
        label: t("onboarding.copyLink"),
        className: "btn btn-primary btn-sm",
      }),
    ),
    h(
      "div",
      { class: "form-actions" },
      h(
        "button",
        {
          type: "button",
          class: "btn btn-secondary",
          onclick: () => window.location.assign(pageUrl("dashboard.html")),
        },
        icon("arrowRight", { size: 16 }),
        t("onboarding.goToDashboard"),
      ),
      linkButton({ href: link, label: t("onboarding.viewPage"), className: "btn btn-ghost" }),
    ),
  );
}
