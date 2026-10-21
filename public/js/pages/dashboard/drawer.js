import { $, h, setBusy } from "../../core/dom.js";
import { describeError } from "../../core/errors.js";
import { t } from "../../core/i18n.js";
import { icon } from "../../core/icons.js";
import { setStatus } from "../../core/page.js";
import { toast } from "../../core/toast.js";
import { renderThread } from "../../components/thread.js";
import { definitionList, platformChips, statusBadge } from "../../components/ui.js";
import { BOARD_STATUSES } from "../../domain/constants.js";
import { svgDataUri } from "../../domain/svg.js";
import { validateMessage } from "../../domain/validation.js";
import { sendMessage, watchMessages } from "../../services/messages.js";
import { getPrivateContact, setRequestStatus } from "../../services/requests.js";

const CHANNEL_KEYS = {
  email: "contact.channel.email",
  phone: "contact.channel.phone",
  thread: "contact.channel.thread",
};

const drawer = {
  requestId: null,
  stopMessages: null,
  returnFocus: null,
};

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
    holder.replaceChildren(contactDetails(contact));
  } catch (error) {
    holder.replaceChildren(h("p", { class: "field-error" }, describeError(error)));
  }
}

async function sendReply(event, requestId, textarea, status, button) {
  event.preventDefault();
  const validation = validateMessage(textarea.value);
  if (!validation.ok) {
    setStatus(status, t(validation.error.key, validation.error.params ?? {}), { error: true });
    textarea.focus();
    return;
  }
  setBusy(button, true);
  try {
    await sendMessage(requestId, "developer", validation.value);
    textarea.value = "";
    setStatus(status, "");
  } catch (error) {
    setStatus(status, describeError(error), { error: true });
  } finally {
    setBusy(button, false);
  }
}

function buildBody(request) {
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
    rows: 3,
    maxlength: null,
    "aria-label": t("drawer.replyLabel"),
    placeholder: t("drawer.replyPlaceholder"),
  });
  const sendButton = h(
    "button",
    { type: "submit", class: "btn btn-primary btn-sm" },
    icon("message", { size: 16 }),
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
  textarea.id = "reply-body";
  const select = body.querySelector("#drawer-status");
  if (select) {
    select.dataset.current = request.status;
    select.addEventListener("change", changeStatus);
  }
  return { body, contactHolder, threadList };
}

export function openDrawer(request) {
  const dialog = $("#request-drawer");
  drawer.requestId = request.id;
  drawer.returnFocus = document.activeElement;
  drawer.stopMessages?.();

  $("#drawer-title").textContent = request.title;
  const { body, contactHolder, threadList } = buildBody(request);
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

// Keeps the status and header in step with the live list while the drawer is open.
export function refreshDrawer(request) {
  if (drawer.requestId !== request.id) return;
  const select = $("#drawer-status");
  if (select && document.activeElement !== select && select.dataset.current !== request.status) {
    select.value = request.status;
    select.dataset.current = request.status;
  }
  $("#drawer-status-badge").replaceChildren(statusBadge(request.status));
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
    drawer.returnFocus?.focus?.();
    $("#drawer-body").replaceChildren();
  });
}
