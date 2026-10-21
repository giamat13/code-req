import { $, h, setBusy } from "../core/dom.js";
import { showDialog } from "../core/dialog.js";
import { isConfigured } from "../core/config.js";
import { icon } from "../core/icons.js";
import { t } from "../core/i18n.js";
import { startPage, setStatus } from "../core/page.js";
import { developerUrl, getParam, pageUrl, trackUrl } from "../core/router.js";
import { storage } from "../core/storage.js";
import { checkboxField } from "../components/forms.js";
import { createContactFields } from "../components/contactFields.js";
import { createRequestFields } from "../components/requestFields.js";
import {
  avatar,
  copyButton,
  definitionList,
  emptyState,
  linkButton,
  platformChips,
  platformLabel,
} from "../components/ui.js";
import { COOLDOWN_SECONDS, DRAFT_DEBOUNCE_MS } from "../domain/constants.js";
import { extractUsername, usernameError } from "../domain/usernames.js";
import { contactState, validateContact, validateRequestForm } from "../domain/validation.js";
import { withTimeout } from "../core/timeout.js";
import { findDeveloper } from "../services/developers.js";
import { createRequest } from "../services/requests.js";
import { ensureRequesterSession } from "../services/auth.js";

const LAST_SUBMIT_KEY = "apprequest.lastSubmit";
const draftKey = (username) => `apprequest.draft.v1:${username}`;

const state = {
  developer: null,
  fields: null,
  contact: null,
  consent: null,
  submitting: false,
  cooldownTimer: null,
};

function profileHeader(developer) {
  const website = developer.website
    ? h(
        "a",
        {
          class: "profile-link",
          href: developer.website,
          target: "_blank",
          rel: "noopener noreferrer",
        },
        developer.website.replace(/^https:\/\//, ""),
      )
    : null;
  return h(
    "header",
    { class: "profile" },
    avatar({ src: developer.avatarUrl, name: developer.displayName, size: "xl" }),
    h(
      "div",
      { class: "profile-body" },
      h("h1", { class: "profile-name" }, developer.displayName),
      h("p", { class: "profile-handle" }, `@${developer.username}`),
      developer.bio ? h("p", { class: "profile-bio" }, developer.bio) : null,
      h(
        "div",
        { class: "profile-meta" },
        developer.acceptingRequests
          ? h(
              "span",
              { class: "badge badge-open" },
              icon("check", { size: 14 }),
              t("developer.open"),
            )
          : h(
              "span",
              { class: "badge badge-closed" },
              icon("clock", { size: 14 }),
              t("developer.closed"),
            ),
        developer.pricingNote ? h("span", { class: "profile-price" }, developer.pricingNote) : null,
      ),
      platformChips(developer.acceptedPlatforms ?? []),
      website,
      h(
        "div",
        { class: "profile-actions" },
        copyButton({
          getText: () => new URL(developerUrl(developer.username), location.href).href,
          label: t("developer.copyLink"),
        }),
        navigator.share
          ? h(
              "button",
              {
                type: "button",
                class: "btn btn-secondary btn-sm",
                onclick: () =>
                  navigator
                    .share({
                      title: developer.displayName,
                      url: new URL(developerUrl(developer.username), location.href).href,
                    })
                    .catch(() => {}),
              },
              icon("external", { size: 16 }),
              t("developer.share"),
            )
          : null,
      ),
    ),
  );
}

function setStateMessage(title, body) {
  $("#developer-main").replaceChildren(
    emptyState({
      iconName: "alert",
      title,
      body,
      action: linkButton({
        href: "index.html",
        label: t("developer.backToDirectory"),
        className: "btn btn-primary",
      }),
    }),
  );
}

function errorMessageFor(error) {
  if (error?.code === "permission-denied") return t("form.notAccepting");
  if (error?.code === "unavailable" || error?.code === "failed-precondition")
    return t("errors.network");
  return t("errors.generic");
}

function saveDraft() {
  if (!state.developer || !state.fields) return;
  const { input } = state.fields.read();
  storage.setJSON(draftKey(state.developer.username), {
    savedAt: Date.now(),
    fields: input,
    contact: state.contact.read(),
  });
}

function scheduleDraft() {
  clearTimeout(scheduleDraft.timer);
  scheduleDraft.timer = setTimeout(saveDraft, DRAFT_DEBOUNCE_MS);
}

function restoreDraft(form) {
  const draft = storage.getJSON(draftKey(state.developer.username));
  if (!draft?.fields) return;
  state.fields.write(draft.fields);
  state.contact.write(draft.contact ?? {});
  const note = h(
    "div",
    { class: "notice", role: "status" },
    t("form.draftRestored"),
    h(
      "button",
      {
        type: "button",
        class: "btn btn-ghost btn-sm",
        onclick: () => {
          storage.remove(draftKey(state.developer.username));
          window.location.reload();
        },
      },
      t("form.discardDraft"),
    ),
  );
  form.prepend(note);
}

function cooldownRemaining() {
  const last = storage.getJSON(LAST_SUBMIT_KEY, 0);
  return Math.max(0, COOLDOWN_SECONDS - Math.floor((Date.now() - Number(last)) / 1000));
}

function applyCooldown(submitButton) {
  const remaining = cooldownRemaining();
  submitButton.disabled = remaining > 0;
  const status = $("#form-status");
  if (remaining > 0) {
    setStatus(status, t("form.cooldown", { seconds: remaining }));
    clearTimeout(state.cooldownTimer);
    state.cooldownTimer = setTimeout(() => applyCooldown(submitButton), 1000);
  } else if (status.dataset.state === undefined || status.dataset.state === "cooldown") {
    setStatus(status, "");
  }
}

function reviewContent(values, contactValues) {
  const platforms = values.platforms.map((platform) => platformLabel(platform)).join(", ");
  return definitionList([
    { label: t("form.requesterName"), value: values.requesterName },
    { label: t("form.title"), value: values.title },
    { label: t("form.appName"), value: values.appName },
    { label: t("form.appDescription"), value: values.appDescription },
    { label: t("form.platforms"), value: platforms },
    { label: t("form.template"), value: values.template ? t(`template.${values.template}`) : null },
    {
      label: t("form.budget"),
      value: values.budgetRange ? t(`budget.${values.budgetRange}`) : null,
    },
    { label: t("form.deadline"), value: values.deadline },
    { label: t("form.notes"), value: values.notes },
    { label: t("contact.channel"), value: t(`contact.channel.${contactValues.channel}`) },
    { label: t("contact.email"), value: contactValues.email },
    { label: t("contact.phone"), value: contactValues.phone },
    { label: t("contact.availability"), value: contactValues.availability },
  ]);
}

function showSuccess(requestId) {
  const form = $("#request-form");
  const panel = $("#success-panel");
  const link = requestId ? trackUrl(requestId) : null;
  form.hidden = true;
  panel.hidden = false;
  panel.replaceChildren(
    h("h2", { class: "success-title", tabindex: "-1" }, t("form.successTitle")),
    h("p", {}, t("form.successBody")),
    link
      ? h(
          "div",
          { class: "tracking" },
          h("label", { class: "field-label", for: "tracking-link" }, t("form.trackingLinkLabel")),
          h("input", {
            id: "tracking-link",
            class: "tracking-input",
            readonly: true,
            value: new URL(link, location.href).href,
          }),
          h(
            "div",
            { class: "row" },
            copyButton({
              getText: () => new URL(link, location.href).href,
              label: t("form.copyLink"),
              className: "btn btn-primary btn-sm",
            }),
            h(
              "button",
              {
                type: "button",
                class: "btn btn-secondary btn-sm",
                onclick: () => downloadTracking(link, requestId),
              },
              icon("download", { size: 16 }),
              t("form.downloadTxt"),
            ),
          ),
          h(
            "p",
            { class: "notice notice-warning" },
            icon("alert", { size: 16 }),
            t("form.saveWarning"),
          ),
          linkButton({
            href: pageUrl("requests.html"),
            label: t("form.openMyRequests"),
            className: "btn btn-secondary btn-sm",
          }),
        )
      : null,
    h(
      "button",
      {
        type: "button",
        class: "btn btn-secondary",
        onclick: () => {
          panel.hidden = true;
          form.hidden = false;
          form.reset();
          state.fields.write({});
          state.contact.write({});
          $("#form-status").textContent = "";
        },
      },
      t("form.submitAnother"),
    ),
  );
  panel.querySelector(".success-title").focus();
}

function downloadTracking(link, requestId) {
  const text = [
    `${t("form.trackingLinkLabel")}: ${new URL(link, location.href).href}`,
    `${t("form.developer")}: @${state.developer.username}`,
    `${t("form.requestId")}: ${requestId}`,
    "",
    t("form.saveWarning"),
    "",
  ].join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const anchor = h("a", { href: url, download: `code-req-${requestId}.txt` });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function submit(values, contactValues) {
  if (state.submitting) return;
  state.submitting = true;
  const button = $("#submit-request");
  setBusy(button, true);
  try {
    const requesterUid = await ensureRequesterSession();
    const requestId = await createRequest({
      developer: state.developer,
      values,
      contact: contactValues,
      requesterUid,
    });
    storage.setJSON(LAST_SUBMIT_KEY, Date.now());
    storage.remove(draftKey(state.developer.username));
    showSuccess(requestId);
  } catch (error) {
    setStatus($("#form-status"), errorMessageFor(error), { error: true });
  } finally {
    state.submitting = false;
    setBusy(button, false);
    applyCooldown(button);
  }
}

async function review(event) {
  event.preventDefault();
  const form = $("#request-form");
  const status = $("#form-status");
  const { input, svgError } = state.fields.read();
  const requestValidation = validateRequestForm(
    { ...input, website: form.elements.website.value },
    { acceptedPlatforms: state.developer.acceptedPlatforms },
  );
  const contactInput = state.contact.read();
  const contactValidation = validateContact(contactInput);
  const consentError = state.consent.read() ? null : { key: "errors.consent" };

  if (requestValidation.spam) {
    // A bot filled the honeypot. Show a success message without storing anything.
    showSuccess(null);
    return;
  }

  const errors = { ...requestValidation.errors };
  if (svgError) errors.svgIcon = svgError;
  state.fields.setErrors(errors, svgError);
  state.contact.setErrors(contactValidation.errors);
  state.consent.setError(consentError);

  const invalid = Object.keys(errors).length > 0 || !contactValidation.ok || consentError !== null;
  if (invalid) {
    setStatus(status, t("form.fixErrors"), { error: true });
    if (Object.keys(errors).length > 0) state.fields.focusFirstError(errors, svgError);
    else if (!contactValidation.ok) state.contact.focusFirstError(contactValidation.errors);
    else state.consent.control.focus();
    return;
  }

  setStatus(status, "");
  const decision = await showDialog({
    title: t("form.reviewTitle"),
    size: "md",
    content: reviewContent(requestValidation.values, contactValidation.values),
    actions: [
      { label: t("form.edit"), value: "edit" },
      { label: t("form.submit"), value: "submit", variant: "primary" },
    ],
  }).result;
  if (decision !== "submit") return;

  const contact = contactState(contactValidation.values).stored ? contactValidation.values : null;
  await submit(requestValidation.values, contact);
}

function renderForm(developer) {
  state.developer = developer;
  state.fields = createRequestFields({ acceptedPlatforms: developer.acceptedPlatforms });
  state.contact = createContactFields();
  state.consent = checkboxField({
    name: "consent",
    label: t("form.consent"),
    required: true,
    help: t("form.consentHelp"),
  });

  const honeypot = h("input", {
    type: "text",
    name: "website",
    class: "hp-field",
    tabindex: "-1",
    autocomplete: "off",
    "aria-hidden": "true",
  });

  const form = h(
    "form",
    {
      id: "request-form",
      class: "request-form",
      novalidate: true,
      "aria-labelledby": "form-title",
    },
    h("h2", { id: "form-title", class: "section-title" }, t("developer.formTitle")),
    h("p", { class: "section-lead" }, t("developer.formIntro", { username: developer.username })),
    state.fields.root,
    state.contact.root,
    honeypot,
    state.consent.root,
    h(
      "div",
      { class: "form-actions" },
      h(
        "button",
        { id: "submit-request", type: "submit", class: "btn btn-primary" },
        t("form.review"),
      ),
    ),
    h("p", {
      id: "form-status",
      class: "form-status",
      role: "status",
      "aria-live": "polite",
      hidden: true,
    }),
  );

  const section = $("#developer-form");
  section.replaceChildren(
    form,
    h("div", { id: "success-panel", hidden: true, class: "success-panel" }),
  );
  form.addEventListener("submit", review);
  form.addEventListener("input", scheduleDraft);
  form.addEventListener("change", scheduleDraft);
  restoreDraft(form);
  applyCooldown($("#submit-request"));
}

function renderDeveloper(developer) {
  document.title = t("developer.pageTitle", { name: developer.displayName });
  $("#developer-header").replaceChildren(profileHeader(developer));
  if (developer.suspended || developer.unavailable) {
    $("#developer-form").replaceChildren(
      emptyState({
        iconName: "shield",
        title: t("developer.unavailable"),
        body: t("developer.unavailableBody"),
      }),
    );
    return;
  }
  if (!developer.acceptingRequests) {
    $("#developer-form").replaceChildren(
      emptyState({
        iconName: "clock",
        title: t("developer.notAccepting"),
        body: t("developer.notAcceptingBody"),
      }),
    );
    return;
  }
  renderForm(developer);
}

async function load() {
  if (!isConfigured) {
    setStateMessage(t("setup.notConfiguredTitle"), t("setup.notConfigured"));
    return;
  }
  const username = extractUsername(getParam("u") ?? "");
  if (usernameError(username)) {
    setStateMessage(t("developer.notFound"), t("developer.notFoundBody"));
    return;
  }
  try {
    const developer = await withTimeout(findDeveloper(username));
    if (!developer) {
      setStateMessage(t("developer.notFound"), t("developer.notFoundBody"));
      return;
    }
    renderDeveloper(developer);
  } catch {
    setStateMessage(t("errors.network"), t("errors.networkBody"));
  }
}

startPage(load);
