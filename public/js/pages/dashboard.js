import { $, h } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { startPage } from "../core/page.js";
import { isConfigured } from "../core/config.js";
import { toast } from "../core/toast.js";
import { getParam } from "../core/router.js";
import { getDeveloper } from "../services/developers.js";
import {
  finishRedirectSignIn,
  signInWithGoogle,
  signOutUser,
  watchSignIn,
} from "../services/auth.js";
import { renderOnboarding } from "./dashboard/onboarding.js";
import { mountRequests, unmountRequests } from "./dashboard/requests.js";

function showOnly(id) {
  for (const section of ["auth-gate", "onboarding", "app"]) {
    $(`#${section}`).hidden = section !== id;
  }
}

function renderSignedOut(message = null) {
  showOnly("auth-gate");
  const status = $("#auth-status");
  status.textContent = message ?? "";
  status.hidden = !message;
}

async function signIn() {
  try {
    await signInWithGoogle();
  } catch (error) {
    if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request")
      return;
    renderSignedOut(t("dashboard.signInFailed"));
  }
}

async function onUser(user) {
  if (!user) {
    unmountRequests();
    renderSignedOut();
    return;
  }
  const developer = await getDeveloper(user.uid);
  if (!developer) {
    showOnly("onboarding");
    renderOnboarding(user);
    return;
  }
  showOnly("app");
  $("#account-name").textContent = developer.displayName;
  mountRequests(developer, user);
}

startPage(async () => {
  $("#sign-in-button").addEventListener("click", signIn);
  $("#sign-out-button").addEventListener("click", () => signOutUser());
  if (!isConfigured) {
    showOnly("auth-gate");
    $("#auth-gate").replaceChildren(
      h("h1", { class: "auth-title" }, t("setup.notConfiguredTitle")),
      h("p", {}, t("setup.notConfigured")),
    );
    return;
  }
  // Clears the redirect result so an interrupted popup flow does not leave the page in limbo.
  await finishRedirectSignIn();
  watchSignIn((user) => {
    onUser(user).catch(() => {
      renderSignedOut(t("errors.network"));
    });
  });
  if (getParam("signedout") === "1") toast(t("dashboard.signedOut"));
});
