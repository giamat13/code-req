import { h } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { CONTACT_CHANNELS, LIMITS } from "../domain/constants.js";
import { radioField, textField } from "./forms.js";

// Contact details for the developer. Only the developer can read what is saved, so the copy says so.
export function createContactFields({ initial = {} } = {}) {
  const channel = radioField({
    name: "channel",
    label: t("contact.channel"),
    value: initial.channel ?? "thread",
    options: CONTACT_CHANNELS.map((item) => ({ value: item, label: t(`contact.channel.${item}`) })),
  });
  const email = textField({
    name: "email",
    label: t("contact.email"),
    value: initial.email ?? "",
    type: "email",
    autocomplete: "email",
    help: t("contact.emailHelp"),
  });
  const phone = textField({
    name: "phone",
    label: t("contact.phone"),
    value: initial.phone ?? "",
    type: "tel",
    autocomplete: "tel",
    inputmode: "tel",
    help: t("contact.phoneHelp"),
  });
  const availability = textField({
    name: "availability",
    label: t("contact.availability"),
    value: initial.availability ?? "",
    multiline: true,
    rows: 2,
    max: LIMITS.availability.max,
    help: t("contact.availabilityHelp"),
  });

  const root = h(
    "fieldset",
    { class: "contact-fields" },
    h("legend", { class: "section-title" }, t("contact.title")),
    h("p", { class: "field-help" }, t("contact.privacy")),
    channel.root,
    h("div", { class: "field-row" }, email.root, phone.root),
    availability.root,
  );

  return {
    root,
    read: () => ({
      channel: channel.read(),
      email: email.read(),
      phone: phone.read(),
      availability: availability.read(),
    }),
    write(values) {
      channel.write(values.channel ?? "thread");
      email.write(values.email ?? "");
      phone.write(values.phone ?? "");
      availability.write(values.availability ?? "");
    },
    setErrors(errors) {
      channel.setError(errors.channel ?? null);
      email.setError(errors.email ?? null);
      phone.setError(errors.phone ?? null);
      availability.setError(errors.availability ?? null);
    },
    focusFirstError(errors) {
      if (errors.channel) channel.focus();
      else if (errors.email) email.control.focus();
      else if (errors.phone) phone.control.focus();
      else if (errors.availability) availability.control.focus();
    },
  };
}
