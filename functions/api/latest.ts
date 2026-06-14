import { renderLatestIssue } from "../_backend";

export const onRequestGet: PagesFunction = async () => {
  return new Response(await renderLatestIssue(), {
    headers: {
      "content-type": "text/html;charset=UTF-8",
      "cache-control": "no-store",
    },
  });
};

