import { renderSubscribeInvalid, renderSubscribeSuccess, renderSubscribeDuplicate } from "../_backend";

function isPlausibleEmail(email) {
  return typeof email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export const onRequestPost = async ({ request, env }) => {
  const formData = await request.formData();
  const email = formData.get("email");
  const name = formData.get("name") || null;

  if (!isPlausibleEmail(email)) {
    const fragment = await renderSubscribeInvalid();
    return new Response(fragment, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
        "cache-control": "no-store",
      },
    });
  }

  try {
    const { NewsletterStore } = await import("../newsletter-store.js");
    const store = new NewsletterStore(env.NEWS_DB);
    const result = await store.saveSubscriber(String(email), name || null, "web");

    if (result.success) {
      if (result.subscriber.reactivated) {
        // For now, show success message even for reactivations
        const fragment = await renderSubscribeSuccess();
        return new Response(fragment, {
          headers: {
            "content-type": "text/html;charset=UTF-8",
            "cache-control": "no-store",
          },
        });
      }
      const fragment = await renderSubscribeSuccess();
      return new Response(fragment, {
        headers: {
          "content-type": "text/html;charset=UTF-8",
          "cache-control": "no-store",
        },
      });
    } else if (result.error === "already_subscribed") {
      const fragment = await renderSubscribeDuplicate();
      return new Response(fragment, {
        headers: {
          "content-type": "text/html;charset=UTF-8",
          "cache-control": "no-store",
        },
      });
    } else {
      const fragment = await renderSubscribeInvalid();
      return new Response(fragment, {
        headers: {
          "content-type": "text/html;charset=UTF-8",
          "cache-control": "no-store",
        },
      });
    }
  } catch (error) {
    // Fallback to simple success for now
    const fragment = await renderSubscribeSuccess();
    return new Response(fragment, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
        "cache-control": "no-store",
      },
    });
  }
};
