import { $, h } from "../core/dom.js";
import { isConfigured } from "../core/config.js";
import { describeAuthError } from "../core/errors.js";
import { startPage, setStatus } from "../core/page.js";
import { t } from "../core/i18n.js";
import { toast } from "../core/toast.js";
import { withTimeout } from "../core/timeout.js";
import { getDeveloper } from "../services/developers.js";
import {
  finishRedirectSignIn,
  isDeveloperAccount,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
  watchSignIn,
} from "../services/auth.js";
import { renderOnboarding } from "./dashboard/onboarding.js";
import { mountRequests, unmountRequests } from "./dashboard/requests.js";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD_LENGTH = 6;

function showOnly(id) {
  for (const section of ["auth-gate", "onboarding", "app"]) {
    $(`#${section}`).hidden = section !== id;
  }
}

function gateStatus(message = null, { error = false } = {}) {
  setStatus($("#auth-status"), message ?? "", { error });
}

function renderSignedOut(message = null) {
  showOnly("auth-gate");
  gateStatus(message, { error: Boolean(message) });
}

// Returns the form values, or an error message when the input cannot work.
function readCredentials() {
  const form = $("#email-form");
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  if (!EMAIL_PATTERN.test(email)) return { error: t("auth.invalidEmail"), email, password };
  if (password.length < MIN_PASSWORD_LENGTH)
    return { error: t("auth.weakPassword"), email, password };
  return { error: null, email, password };
}

async function signInGoogle() {
  try {
    await signInWithGoogle();
  } catch (error) {
    if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request")
      return;
    renderSignedOut(describeAuthError(error));
  }
}

async function runEmailAction(action) {
  const credentials = readCredentials();
  if (credentials.error) {
    renderSignedOut(credentials.error);
    $("#auth-email").focus();
    return;
  }
  try {
    await action(credentials.email, credentials.password);
    // The auth listener moves the page on from here.
  } catch (error) {
    renderSignedOut(describeAuthError(error));
  }
}

async function resetPassword() {
  const email = $("#email-form").elements.email.value.trim();
  if (!EMAIL_PATTERN.test(email)) {
    renderSignedOut(t("auth.invalidEmail"));
    $("#auth-email").focus();
    return;
  }
  try {
    await sendPasswordReset(email);
  } catch (error) {
    if (error.code !== "auth/user-not-found") renderSignedOut(describeAuthError(error));
    // Unknown addresses get the same message, so the page does not reveal which emails have accounts.
  }
  gateStatus(t("auth.resetSent"));
}

async function onUser(user) {
  // Anonymous sessions come from requesters, who submit without an account. They cannot manage requests.
  if (!isDeveloperAccount(user)) {
    unmountRequests();
    renderSignedOut(user ? t("dashboard.anonymousNotAllowed") : null);
    return;
  }
  const developer = await withTimeout(getDeveloper(user.uid));
  if (!developer) {
    showOnly("onboarding");
    renderOnboarding(user);
    return;
  }
  showOnly("app");
  $("#account-name").textContent = developer.displayName;
  mountRequests(developer, user);
}

function wireGate() {
  $("#sign-in-button").addEventListener("click", signInGoogle);
  $("#email-form").addEventListener("submit", (event) => {
    event.preventDefault();
    runEmailAction(signInWithEmail);
  });
  $("#email-sign-up").addEventListener("click", () => runEmailAction(signUpWithEmail));
  $("#password-reset").addEventListener("click", resetPassword);
}

startPage(async () => {
  wireGate();
  $("#sign-out-button").addEventListener("click", () => signOutUser());

  if (!isConfigured) {
    showOnly("auth-gate");
    $("#auth-gate").replaceChildren(
      h("h1", { class: "auth-title" }, t("setup.notConfiguredTitle")),
      h("p", {}, t("setup.notConfigured")),
    );
    return;
  }

  // Completes a redirect sign-in that started on this page. Without it the page would stay signed out.
  const redirected = await finishRedirectSignIn();
  if (redirected) toast(t("dashboard.signedIn"));
  watchSignIn((user) => {
    onUser(user).catch((error) => {
      // The underlying error goes under the message, so a failure on this page can be reported exactly.
      const detail = error?.code
        ? `${error.code}: ${error.message}`
        : String(error?.message ?? error);
      renderSignedOut(`${t("errors.network")} ${t("errors.detail", { detail })}`);
    });
  });
});
