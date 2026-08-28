import { useEffect } from "react";

const CHATWOOT_BASE_URL = "https://app.chatwoot.com";
const CHATWOOT_SCRIPT_ID = "chatwoot-sdk";
const CHATWOOT_WEBSITE_TOKEN = "8F9os7QyqQAbpTowA6x8iNte";
const CHATWOOT_MOBILE_STYLE_ID = "chatwoot-mobile-style";

function runChatwoot() {
  if (window.__globalsfinChatwootInitialized || !window.chatwootSDK) {
    return;
  }

  window.__globalsfinChatwootInitialized = true;
  window.chatwootSDK.run({
    baseUrl: CHATWOOT_BASE_URL,
    websiteToken: CHATWOOT_WEBSITE_TOKEN,
  });
}

function ChatwootWidget() {
  useEffect(() => {
    window.chatwootSettings = {
      launcherTitle: "",
      position: "right",
      type: "standard",
    };

    if (!document.getElementById(CHATWOOT_MOBILE_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = CHATWOOT_MOBILE_STYLE_ID;
      style.textContent = `
        @media (max-width: 640px) {
          .woot-widget-holder {
            bottom: max(12px, env(safe-area-inset-bottom)) !important;
            right: 12px !important;
            transform: scale(0.86);
            transform-origin: bottom right;
          }
        }
      `;
      document.head.appendChild(style);
    }

    const existingScript = document.getElementById(CHATWOOT_SCRIPT_ID);

    if (existingScript) {
      if (window.chatwootSDK) {
        runChatwoot();
        return undefined;
      }

      existingScript.addEventListener("load", runChatwoot, { once: true });
      return () => existingScript.removeEventListener("load", runChatwoot);
    }

    const script = document.createElement("script");
    script.id = CHATWOOT_SCRIPT_ID;
    script.src = `${CHATWOOT_BASE_URL}/packs/js/sdk.js`;
    script.async = true;
    script.addEventListener("load", runChatwoot, { once: true });
    document.head.appendChild(script);

    return () => script.removeEventListener("load", runChatwoot);
  }, []);

  return null;
}

export default ChatwootWidget;
