import { $, h, setBusy } from "../core/dom.js";
import { showDialog, confirmDialog } from "../core/dialog.js";
import { isConfigured } from "../core/config.js";
import { describeError } from "../core/errors.js";
import { formatDate } from "../core/format.js";
import { icon } from "../core/icons.js";
import { t } from "../core/i18n.js";
import { startPage, setStatus } from "../core/page.js";
import { developerUrl, getParam } from "../core/router.js";
import { toast } from "../core/toast.js";
import { createContactFields } from "../components/contactFields.js";
import { createRequestFields } from "../components/requestFields.js";
import {
  avatar,
  definitionList,
  emptyState,
  linkButton,
  platformChips,
  statusBadge,
} from "../components/ui.js";
import { LIMITS } from "../domain/constants.js";
import { changedFields } from "../domain/edits.js";
import { validateContact, validateMessage, validateRequestForm } from "../domain/validation.js";
import { findDeveloper } from "../services/developers.js";
import {
  cancelRequest,
  getRequest,
  saveContact,
  saveEdits,
  watchRequest,
} from "../services/requests.js";
import { sendMessage, watchMessages } from "../services/messages.js";

// Steps the request goes through. Declined and cancelled requests are shown as badges instead.
const FLOW = ["new", "in_progress", "done"];
const EDITABLE = ["new", "in_progress"];

// Maps an edited field name to its label, for the notice in the thread.
const FIELD_LABELS = {
  requesterName: "form.requesterName",
  title: "form.title",
  appName: "form.appName",
  appDescription: "form.appDescription",
  platforms: "form.platforms",
  svgIcon: "form.svgLabel",
  notes: "form.notes",
  template: "form.template",
  budgetRange: "form.budget",
  deadline: "form.deadline",
};

const state = {
  requestId: null,
  request: null,
  developer: null,
  messageCount: 0,
};

function renderHeader(request) {
  $("#track-header").replaceChildren(
    h("p", { class: "eyebrow" }, t("track.eyebrow")),
    h("h1", { class: "track-title" }, request.title),
    h("p", { class: "track-app" }, request.appName),
    h(
      "p",
      { class: "track-meta" },
      t("track.submitted", { date: formatDate(request.createdAt) }),
      request.updatedAt && request.updatedAt !== request.createdAt
        ? ` · ${t("track.updated", { date: formatDate(request.updatedAt, { time: true }) })}`
        : null,
    ),
  );
}

function renderStepper(request) {
  const node = $("#track-status");
  if (!FLOW.includes(request.status)) {
    node.replaceChildren(statusBadge(request.status));
    return;
  }
  const current = FLOW.indexOf(request.status);
  node.replaceChildren(
    h(
      "ol",
      { class: "stepper", "aria-label": t("track.progress") },
      FLOW.map((status, position) =>
        h(
          "li",
          {
            class: [
              "step",
              position < current ? "is-done" : "",
              position === current ? "is-current" : "",
            ]
              .filter(Boolean)
              .join(" "),
            "aria-current": position === current ? "step" : null,
          },
          h("span", { class: "step-dot", "aria-hidden": "true" }),
          h("span", { class: "step-label" }, t(`status.${status}`)),
        ),
      ),
    ),
  );
}

function renderQuote(request) {
  const node = $("#track-quote");
  if (!request.quote) {
    node.replaceChildren(h("p", { class: "muted" }, t("track.noQuote")));
    return;
  }
  node.replaceChildren(
    h("h2", { class: "section-title" }, t("track.quoteTitle")),
    definitionList([
      { label: t("track.quoteAmount"), value: `${request.quote.amount} ${request.quote.currency}` },
      { label: t("track.quoteTimeline"), value: request.quote.timeline },
      { label: t("track.quoteValidUntil"), value: request.quote.validUntil },
    ]),
  );
}

function renderDeveloper(request) {
  const developer = state.developer;
  const name = developer?.displayName ?? `@${request.developerUsername}`;
  $("#track-developer").replaceChildren(
    h("h2", { class: "section-title" }, t("track.developerTitle")),
    h(
      "a",
      { class: "developer-card", href: developerUrl(request.developerUsername) },
      avatar({ src: developer?.avatarUrl ?? null, name, size: "md" }),
      h(
        "div",
        { class: "developer-card-body" },
        h("h3", { class: "developer-card-name" }, name),
        h("p", { class: "developer-card-handle" }, `@${request.developerUsername}`),
        developer?.unavailable
          ? h("p", { class: "developer-card-note" }, t("track.developerUnavailable"))
          : null,
        developer?.acceptedPlatforms ? platformChips(developer.acceptedPlatforms) : null,
      ),
    ),
  );
}

function renderSummary(request) {
  const editable = EDITABLE.includes(request.status);
  $("#track-summary").replaceChildren(
    h(
      "div",
      { class: "section-head" },
      h("h2", { class: "section-title" }, t("track.summaryTitle")),
      editable
        ? h(
            "button",
            {
              type: "button",
              class: "btn btn-secondary btn-sm",
              id: "edit-request",
              onclick: openEditor,
            },
            icon("edit", { size: 16 }),
            t("track.editRequest"),
          )
        : null,
    ),
    editable ? null : h("p", { class: "muted" }, t("track.notEditable")),
    definitionList([
      { label: t("form.requesterName"), value: request.requesterName },
      { label: t("form.appName"), value: request.appName },
      { label: t("form.appDescription"), value: request.appDescription },
      {
        label: t("form.platforms"),
        value: request.platforms.map((platform) => t(`platform.${platform}`)).join(", "),
      },
      {
        label: t("form.template"),
        value: request.template ? t(`template.${request.template}`) : null,
      },
      {
        label: t("form.budget"),
        value: request.budgetRange ? t(`budget.${request.budgetRange}`) : null,
      },
      { label: t("form.deadline"), value: request.deadline },
      { label: t("form.notes"), value: request.notes },
    ]),
  );
}

function renderContact(request) {
  const onFile = request.hasContact === true;
  $("#track-contact").replaceChildren(
    h("h2", { class: "section-title" }, t("track.contactTitle")),
    h(
      "p",
      { class: onFile ? "contact-state contact-on" : "contact-state" },
      icon(onFile ? "check" : "mail", { size: 16 }),
      onFile ? t("track.contactOnFile") : t("track.contactMissing"),
    ),
    h("p", { class: "muted" }, t("track.contactPrivacy")),
    h(
      "button",
      {
        type: "button",
        class: "btn btn-secondary btn-sm",
        id: "edit-contact",
        onclick: openContact,
      },
      onFile ? t("track.updateContact") : t("track.addContact"),
    ),
  );
}

function renderActions(request) {
  const node = $("#track-actions");
  if (request.status !== "new") {
    node.replaceChildren();
    return;
  }
  node.replaceChildren(
    h(
      "button",
      { type: "button", class: "btn btn-danger btn-sm", id: "cancel-request", onclick: cancel },
      icon("x", { size: 16 }),
      t("track.cancel"),
    ),
  );
}

function renderComposer(request) {
  const closed = request.status === "cancelled";
  const textarea = $("#composer-body");
  textarea.disabled = closed;
  $("#composer-send").disabled = closed;
  $("#composer-closed").hidden = !closed;
  $("#composer").hidden = closed;
}

function messageLabel(message) {
  if (message.kind === "edit") {
    const fields = (message.body ?? "")
      .split(",")
      .filter(Boolean)
      .map((field) => t(FIELD_LABELS[field] ?? "form.title"));
    return t("track.noticeEdit", { fields: fields.join(", ") });
  }
  if (message.kind === "contact") return t("track.noticeContact");
  return null;
}

function renderThread(messages) {
  const list = $("#thread-list");
  const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  const items = messages.map((message) => {
    const notice = messageLabel(message);
    if (notice) {
      return h(
        "li",
        { class: "thread-notice" },
        icon("clock", { size: 14 }),
        h("span", {}, notice),
        h("time", { datetime: "" }, formatDate(message.createdAt, { time: true })),
      );
    }
    const role = message.authorRole === "developer" ? "developer" : "requester";
    return h(
      "li",
      { class: `bubble bubble-${role}` },
      h(
        "p",
        { class: "bubble-meta" },
        h("span", { class: "bubble-author" }, t(`track.role.${role}`)),
        h("time", {}, formatDate(message.createdAt, { time: true })),
      ),
      h("p", { class: "bubble-body" }, message.body),
    );
  });
  list.replaceChildren(...items);
  if (messages.length === 0) {
    list.replaceChildren(h("li", { class: "thread-empty" }, t("track.threadEmpty")));
  }
  if (nearBottom || messages.length > state.messageCount) list.scrollTop = list.scrollHeight;
  state.messageCount = messages.length;
}

function renderAll() {
  const request = state.request;
  document.title = t("track.pageTitle", {
    status: t(`status.${request.status}`),
    app: request.appName,
  });
  renderHeader(request);
  renderStepper(request);
  renderQuote(request);
  renderDeveloper(request);
  renderSummary(request);
  renderContact(request);
  renderActions(request);
  renderComposer(request);
}

function openEditor() {
  const request = state.request;
  const fields = createRequestFields({
    acceptedPlatforms: state.developer?.acceptedPlatforms ?? request.platforms,
    initial: request,
  });
  const status = h("p", {
    class: "form-status",
    role: "status",
    "aria-live": "polite",
    hidden: true,
  });
  const content = h(
    "form",
    { id: "edit-form", novalidate: true },
    h("p", { class: "section-lead" }, t("track.editIntro")),
    fields.root,
    status,
  );
  let saveButton = null;
  const { dialog } = showDialog({
    title: t("track.editTitle"),
    size: "lg",
    content,
    actions: [
      { label: t("common.cancel"), value: "cancel" },
      {
        label: t("track.saveChanges"),
        value: "saved",
        variant: "primary",
        onClick: (self) => {
          saveButton = self.querySelector(".dialog-actions .btn-primary");
          saveEdit(fields, self, status, saveButton);
          // The dialog closes itself after a successful save.
          return false;
        },
      },
    ],
  });
  return dialog;
}

async function saveEdit(fields, dialog, status, button) {
  const request = state.request;
  const { input, svgError } = fields.read();
  // The deadline may already be in the past. Keep it when the requester did not change it.
  const keepsDeadline = input.deadline === request.deadline;
  const validation = validateRequestForm(input, {
    acceptedPlatforms: state.developer?.acceptedPlatforms ?? request.platforms,
    today: keepsDeadline ? "0000-01-01" : undefined,
  });
  const errors = { ...validation.errors };
  if (svgError) errors.svgIcon = svgError;
  fields.setErrors(errors, svgError);
  if (Object.keys(errors).length > 0) {
    setStatus(status, t("form.fixErrors"), { error: true });
    fields.focusFirstError(errors, svgError);
    return;
  }

  const changed = changedFields(request, validation.values);
  if (changed.length === 0) {
    dialog.close("cancel");
    toast(t("track.noChanges"));
    return;
  }

  setBusy(button, true);
  try {
    await saveEdits(state.requestId, validation.values, changed);
    dialog.close("saved");
    toast(t("track.saved"));
  } catch (error) {
    setStatus(status, describeError(error), { error: true });
  } finally {
    setBusy(button, false);
  }
}

// Contact fields start empty on purpose. Saved details are visible only to the developer.
function openContact() {
  const request = state.request;
  const fields = createContactFields();
  const status = h("p", {
    class: "form-status",
    role: "status",
    "aria-live": "polite",
    hidden: true,
  });
  const content = h(
    "form",
    { id: "contact-form", novalidate: true },
    h("p", { class: "section-lead" }, t("track.contactIntro")),
    fields.root,
    status,
  );
  showDialog({
    title: t("track.contactDialogTitle"),
    size: "md",
    content,
    actions: [
      { label: t("common.cancel"), value: "cancel" },
      {
        label: t("track.saveContact"),
        value: "saved",
        variant: "primary",
        onClick: (self) => {
          saveContactFrom(
            fields,
            self,
            status,
            self.querySelector(".dialog-actions .btn-primary"),
            request,
          );
          return false;
        },
      },
    ],
  });
}

async function saveContactFrom(fields, dialog, status, button, request) {
  const validation = validateContact(fields.read());
  fields.setErrors(validation.errors);
  if (!validation.ok) {
    setStatus(status, t("form.fixErrors"), { error: true });
    fields.focusFirstError(validation.errors);
    return;
  }
  setBusy(button, true);
  try {
    // Requests that are cancelled cannot receive messages, so no notice is added for them.
    await saveContact(state.requestId, validation.values, {
      notify: request.status !== "cancelled",
    });
    dialog.close("saved");
    toast(t("track.contactSaved"));
  } catch (error) {
    setStatus(status, describeError(error), { error: true });
  } finally {
    setBusy(button, false);
  }
}

async function cancel() {
  const confirmed = await confirmDialog({
    title: t("track.cancelTitle"),
    message: t("track.cancelBody"),
    confirmLabel: t("track.cancelConfirm"),
    danger: true,
  });
  if (!confirmed) return;
  try {
    await cancelRequest(state.requestId);
    toast(t("track.cancelled"));
  } catch (error) {
    toast(describeError(error), { type: "error" });
  }
}

async function sendFromComposer(event) {
  event.preventDefault();
  const textarea = $("#composer-body");
  const status = $("#composer-status");
  const button = $("#composer-send");
  const validation = validateMessage(textarea.value);
  if (!validation.ok) {
    setStatus(status, t(validation.error.key, validation.error.params ?? {}), { error: true });
    textarea.focus();
    return;
  }
  setBusy(button, true);
  try {
    await sendMessage(state.requestId, "requester", validation.value);
    textarea.value = "";
    updateComposerCounter();
    setStatus(status, "");
  } catch (error) {
    setStatus(status, describeError(error), { error: true });
  } finally {
    setBusy(button, false);
  }
}

function updateComposerCounter() {
  const textarea = $("#composer-body");
  $("#composer-counter").textContent = `${[...textarea.value].length} / ${LIMITS.messageBody.max}`;
}

function wireComposer() {
  const textarea = $("#composer-body");
  $("#composer").addEventListener("submit", sendFromComposer);
  textarea.addEventListener("input", updateComposerCounter);
  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      $("#composer").requestSubmit();
    }
  });
  updateComposerCounter();
}

function showUnavailable(title, body) {
  $("#track-main").replaceChildren(
    emptyState({
      iconName: "alert",
      title,
      body,
      action: linkButton({
        href: "index.html",
        label: t("track.backToStart"),
        className: "btn btn-primary",
      }),
    }),
  );
}

async function load() {
  if (!isConfigured) {
    showUnavailable(t("setup.notConfiguredTitle"), t("setup.notConfigured"));
    return;
  }
  const requestId = (getParam("r") ?? "").trim();
  if (!/^[A-Za-z0-9]{10,40}$/.test(requestId)) {
    showUnavailable(t("track.notFound"), t("track.notFoundBody"));
    return;
  }

  let request;
  try {
    request = await getRequest(requestId);
  } catch (error) {
    showUnavailable(describeError(error), t("errors.networkBody"));
    return;
  }
  if (!request) {
    showUnavailable(t("track.notFound"), t("track.notFoundBody"));
    return;
  }

  state.requestId = requestId;
  state.request = request;
  state.developer = await findDeveloper(request.developerUsername).catch(() => null);
  renderAll();
  $("#live-indicator").hidden = false;

  watchRequest(
    requestId,
    (updated) => {
      if (!updated) {
        showUnavailable(t("track.notFound"), t("track.notFoundBody"));
        return;
      }
      state.request = updated;
      renderAll();
    },
    () => {
      $("#live-indicator").hidden = true;
    },
  );
  watchMessages(requestId, renderThread, () => {
    $("#thread-status").textContent = t("errors.network");
  });
  wireComposer();
}

startPage(load);
