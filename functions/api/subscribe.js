import { renderSubscribeInvalid, renderSubscribeSuccess } from "../_backend";

function isPlausibleEmail(email) {
  return typeof email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export const onRequestPost = async ({ request }) => {
  const formData = await request.formData();
  const fragment = isPlausibleEmail(formData.get("email"))
    ? await renderSubscribeSuccess()
    : await renderSubscribeInvalid();

  return new Response(fragment, {
    headers: {
      "content-type": "text/html;charset=UTF-8",
      "cache-control": "no-store",
    },
  });
};
