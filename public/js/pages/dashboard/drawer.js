import { $, h, setBusy } from "../../core/dom.js";
import { confirmDialog } from "../../core/dialog.js";
import { describeError } from "../../core/errors.js";
import { t } from "../../core/i18n.js";
import { setStatus } from "../../core/page.js";
import { toast } from "../../core/toast.js";
import { renderThread } from "../../components/thread.js";
import { copyText, definitionList, platformChips, statusBadge } from "../../components/ui.js";
import { BOARD_STATUSES, CURRENCIES } from "../../domain/constants.js";
import { buildBrief } from "../../domain/brief.js";
import { svgDataUri } from "../../domain/svg.js";
import {
  normalizeTags,
  validateInternalNotes,
  validateMessage,
  validateQuote,
} from "../../domain/validation.js";
import { sendMessage, watchMessages } from "../../services/messages.js";
import {
  deleteRequest,
  getPrivateContact,
  saveNotes,
  saveQuote,
  setRequestStatus,
} from "../../services/requests.js";

const CHANNEL_KEYS = {
  email: "contact.channel.email",
  phone: "contact.channel.phone",
  thread: "contact.channel.thread",
};

const drawer = {
  requestId: null,
  request: null,
  stopMessages: null,
  returnFocus: null,
  contact: null,
  notes: null,
  onNotesSaved: null,
};

function labeled(id, labelKey, control) {
  return h(
    "div",
    { class: "field" },
    h("label", { class: "field-label", for: id }, t(labelKey)),
    control,
  );
}

function statusControl(request) {
  if (request.status === "cancelled") {
    return h(
      "div",
      { class: "drawer-cancelled" },
      statusBadge("cancelled"),
      h("p", { class: "muted" }, t("drawer.cancelledByRequester")),
    );
  }
  return h(
    "select",
    { id: "drawer-status", class: "status-select", "aria-describedby": "drawer-status-help" },
    BOARD_STATUSES.map((status) =>
      h("option", { value: status, selected: status === request.status }, t(`status.${status}`)),
    ),
  );
}

async function changeStatus(event) {
  const select = event.currentTarget;
  const next = select.value;
  const previous = select.dataset.current;
  setBusy(select, true);
  try {
    await setRequestStatus(drawer.requestId, next);
    select.dataset.current = next;
    toast(t("drawer.statusSaved"));
  } catch (error) {
    select.value = previous;
    toast(describeError(error), { type: "error" });
  } finally {
    setBusy(select, false);
  }
}

function contactDetails(contact) {
  if (!contact) return h("p", { class: "muted" }, t("drawer.noContact"));
  return definitionList([
    {
      label: t("contact.channel"),
      value: CHANNEL_KEYS[contact.channel] ? t(CHANNEL_KEYS[contact.channel]) : null,
    },
    {
      label: t("contact.email"),
      value: contact.email ? h("a", { href: `mailto:${contact.email}` }, contact.email) : null,
    },
    {
      label: t("contact.phone"),
      value: contact.phone
        ? h("a", { href: `tel:${contact.phone.replace(/[^+0-9]/g, "")}` }, contact.phone)
        : null,
    },
    { label: t("contact.availability"), value: contact.availability },
  ]);
}

async function loadContact(requestId, holder) {
  try {
    const contact = await getPrivateContact(requestId);
    if (drawer.requestId !== requestId) return;
    drawer.contact = contact;
    holder.replaceChildren(contactDetails(contact));
  } catch (error) {
    holder.replaceChildren(h("p", { class: "field-error" }, describeError(error)));
  }
}

// The quote is shown to the requester on the tracking page, so the amount and timeline must be exact.
function quoteSection(request) {
  const quote = request.quote ?? null;
  const status = h("p", {
    class: "form-status",
    role: "status",
    "aria-live": "polite",
    hidden: true,
  });
  const amount = h("input", {
    id: "quote-amount",
    type: "text",
    inputmode: "decimal",
    value: quote?.amount ?? "",
  });
  const currency = h(
    "select",
    { id: "quote-currency" },
    CURRENCIES.filter((code) => code !== "other").map((code) =>
      h("option", { value: code, selected: code === (quote?.currency ?? "USD") }, code),
    ),
  );
  const timeline = h("input", {
    id: "quote-timeline",
    type: "text",
    value: quote?.timeline ?? "",
    placeholder: t("drawer.quoteTimelinePlaceholder"),
  });
  const validUntil = h("input", {
    id: "quote-valid",
    type: "date",
    value: quote?.validUntil ?? "",
  });
  const save = h(
    "button",
    { type: "button", class: "btn btn-primary btn-sm" },
    t("drawer.quoteSave"),
  );
  const clear = h(
    "button",
    { type: "button", class: "btn btn-ghost btn-sm", hidden: !quote },
    t("drawer.quoteClear"),
  );

  save.addEventListener("click", async () => {
    const validation = validateQuote({
      amount: amount.value,
      currency: currency.value,
      timeline: timeline.value,
      validUntil: validUntil.value,
    });
    if (!validation.ok) {
      const problem = validation.errors[validation.firstError];
      setStatus(status, t(problem.key, problem.params ?? {}), { error: true });
      return;
    }
    setBusy(save, true);
    try {
      await saveQuote(drawer.requestId, validation.values);
      clear.hidden = false;
      setStatus(status, t("drawer.quoteSaved"));
    } catch (error) {
      setStatus(status, describeError(error), { error: true });
    } finally {
      setBusy(save, false);
    }
  });

  clear.addEventListener("click", async () => {
    setBusy(clear, true);
    try {
      await saveQuote(drawer.requestId, null);
      amount.value = "";
      timeline.value = "";
      validUntil.value = "";
      clear.hidden = true;
      setStatus(status, t("drawer.quoteSaved"));
    } catch (error) {
      setStatus(status, describeError(error), { error: true });
    } finally {
      setBusy(clear, false);
    }
  });

  return h(
    "section",
    { class: "drawer-section", "aria-labelledby": "quote-title" },
    h("h3", { id: "quote-title", class: "section-title" }, t("drawer.quote")),
    h(
      "div",
      { class: "field-row" },
      labeled("quote-amount", "drawer.quoteAmount", amount),
      labeled("quote-currency", "drawer.quoteCurrency", currency),
    ),
    h(
      "div",
      { class: "field-row" },
      labeled("quote-timeline", "drawer.quoteTimeline", timeline),
      labeled("quote-valid", "drawer.quoteValidUntil", validUntil),
    ),
    h("div", { class: "form-actions" }, save, clear),
    status,
  );
}

// Private notes and tags. Only the developer reads them, and they never appear in the requester's view.
function notesSection(notes) {
  const status = h("p", {
    class: "form-status",
    role: "status",
    "aria-live": "polite",
    hidden: true,
  });
  const text = h("textarea", { id: "internal-notes", rows: 4, value: notes.internalNotes ?? "" });
  const tags = h("input", {
    id: "internal-tags",
    type: "text",
    value: (notes.tags ?? []).join(", "),
    placeholder: t("drawer.tagsPlaceholder"),
    autocomplete: "off",
  });
  const save = h(
    "button",
    { type: "button", class: "btn btn-secondary btn-sm" },
    t("drawer.notesSave"),
  );

  save.addEventListener("click", async () => {
    const notesValidation = validateInternalNotes(text.value);
    const tagValidation = normalizeTags(tags.value);
    if (!notesValidation.ok || !tagValidation.ok) {
      const problem = notesValidation.error ?? tagValidation.error;
      setStatus(status, t(problem.key, problem.params ?? {}), { error: true });
      return;
    }
    const saved = { internalNotes: notesValidation.value, tags: tagValidation.value };
    setBusy(save, true);
    try {
      await saveNotes(drawer.requestId, saved);
      drawer.notes = saved;
      drawer.onNotesSaved?.(saved);
      setStatus(status, t("drawer.notesSaved"));
    } catch (error) {
      setStatus(status, describeError(error), { error: true });
    } finally {
      setBusy(save, false);
    }
  });

  return h(
    "section",
    { class: "drawer-section", "aria-labelledby": "notes-title" },
    h("h3", { id: "notes-title", class: "section-title" }, t("drawer.notes")),
    h("p", { class: "field-help" }, t("drawer.notesHelp")),
    labeled("internal-notes", "drawer.notes", text),
    labeled("internal-tags", "drawer.tags", tags),
    h("div", { class: "form-actions" }, save),
    status,
  );
}

async function deleteCurrent() {
  const id = drawer.requestId;
  const confirmed = await confirmDialog({
    title: t("drawer.deleteTitle"),
    message: t("drawer.deleteBody"),
    confirmLabel: t("drawer.deleteConfirm"),
    danger: true,
  });
  if (!confirmed) return;
  try {
    await deleteRequest(id);
    closeDrawer();
    toast(t("drawer.deleted"));
  } catch (error) {
    toast(describeError(error), { type: "error" });
  }
}

function actionsRow() {
  const copy = h(
    "button",
    {
      type: "button",
      class: "btn btn-secondary btn-sm",
      onclick: async () => {
        const brief = buildBrief(drawer.request, {
          preferredChannel: drawer.contact?.channel ?? null,
          internalNotes: drawer.notes?.internalNotes ?? "",
          tags: drawer.notes?.tags ?? [],
        });
        const copied = await copyText(brief);
        toast(copied ? t("drawer.briefCopied") : t("common.copyFailed"), {
          type: copied ? "info" : "error",
        });
      },
    },
    t("drawer.copyBrief"),
  );
  const remove = h(
    "button",
    { type: "button", class: "btn btn-danger btn-sm", onclick: deleteCurrent },
    t("drawer.delete"),
  );
  return h("div", { class: "drawer-actions" }, copy, remove);
}

function sendReply(event, requestId, textarea, status, button) {
  event.preventDefault();
  const validation = validateMessage(textarea.value);
  if (!validation.ok) {
    setStatus(status, t(validation.error.key, validation.error.params ?? {}), { error: true });
    textarea.focus();
    return;
  }
  setBusy(button, true);
  sendMessage(requestId, "developer", validation.value)
    .then(() => {
      textarea.value = "";
      setStatus(status, "");
    })
    .catch((error) => {
      setStatus(status, describeError(error), { error: true });
    })
    .finally(() => {
      setBusy(button, false);
    });
}

function buildBody(request, notes) {
  const requestId = request.id;
  const contactHolder = h(
    "div",
    { class: "drawer-contact" },
    h("p", { class: "muted" }, t("common.loading")),
  );
  const threadList = h("ol", {
    class: "thread-list",
    "aria-label": t("drawer.thread"),
    "aria-live": "polite",
  });
  const replyStatus = h("p", {
    class: "form-status",
    role: "status",
    "aria-live": "polite",
    hidden: true,
  });
  const textarea = h("textarea", {
    id: "reply-body",
    rows: 3,
    "aria-label": t("drawer.replyLabel"),
    placeholder: t("drawer.replyPlaceholder"),
  });
  const sendButton = h(
    "button",
    { type: "submit", class: "btn btn-primary btn-sm" },
    t("drawer.send"),
  );

  const body = h(
    "div",
    { class: "drawer-content" },
    h(
      "div",
      { class: "drawer-status-row" },
      h("label", { class: "field-label", for: "drawer-status" }, t("drawer.status")),
      statusControl(request),
    ),
    h("p", { id: "drawer-status-help", class: "field-help" }, t("drawer.statusHelp")),
    actionsRow(),
    request.svgIcon
      ? h("img", {
          class: "svg-preview",
          src: svgDataUri(request.svgIcon),
          alt: t("drawer.iconAlt"),
        })
      : null,
    h("h3", { class: "section-title" }, t("drawer.details")),
    definitionList([
      { label: t("form.requesterName"), value: request.requesterName },
      { label: t("form.appName"), value: request.appName },
      { label: t("form.appDescription"), value: request.appDescription },
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
    platformChips(request.platforms),
    quoteSection(request),
    notesSection(notes),
    h("h3", { class: "section-title" }, t("drawer.contact")),
    contactHolder,
    h("h3", { class: "section-title" }, t("drawer.thread")),
    threadList,
    request.status === "cancelled"
      ? h("p", { class: "muted" }, t("drawer.threadClosed"))
      : h(
          "form",
          {
            class: "reply-form",
            novalidate: true,
            onsubmit: (event) => sendReply(event, requestId, textarea, replyStatus, sendButton),
          },
          h("label", { class: "field-label", for: "reply-body" }, t("drawer.replyLabel")),
          textarea,
          h("div", { class: "form-actions" }, sendButton),
          replyStatus,
        ),
  );
  const select = body.querySelector("#drawer-status");
  if (select) {
    select.dataset.current = request.status;
    select.addEventListener("change", changeStatus);
  }
  return { body, contactHolder, threadList };
}

export function openDrawer(
  request,
  { notes = { internalNotes: "", tags: [] }, onNotesSaved = null } = {},
) {
  const dialog = $("#request-drawer");
  drawer.requestId = request.id;
  drawer.request = request;
  drawer.notes = notes;
  drawer.onNotesSaved = onNotesSaved;
  drawer.contact = null;
  drawer.returnFocus = document.activeElement;
  drawer.stopMessages?.();

  $("#drawer-title").textContent = request.title;
  const { body, contactHolder, threadList } = buildBody(request, notes);
  $("#drawer-body").replaceChildren(body);
  $("#drawer-status-badge").replaceChildren(statusBadge(request.status));

  loadContact(request.id, contactHolder);
  drawer.stopMessages = watchMessages(
    request.id,
    (messages) => renderThread(threadList, messages, "developer"),
    () => {
      threadList.replaceChildren(h("li", { class: "thread-empty" }, t("errors.network")));
    },
  );

  if (!dialog.open) dialog.showModal();
}

// Keeps the header and the status in step with the live list while the drawer is open.
export function refreshDrawer(request) {
  if (drawer.requestId !== request.id) return;
  drawer.request = request;
  const select = $("#drawer-status");
  if (select && document.activeElement !== select && select.dataset.current !== request.status) {
    select.value = request.status;
    select.dataset.current = request.status;
  }
  $("#drawer-status-badge").replaceChildren(statusBadge(request.status));
}

export function openRequestId() {
  return drawer.requestId;
}

export function closeDrawer() {
  $("#request-drawer").close();
}

export function wireDrawer() {
  const dialog = $("#request-drawer");
  $("#drawer-close").addEventListener("click", closeDrawer);
  dialog.addEventListener("close", () => {
    drawer.stopMessages?.();
    drawer.stopMessages = null;
    drawer.requestId = null;
    drawer.request = null;
    drawer.returnFocus?.focus?.();
    $("#drawer-body").replaceChildren();
  });
}
