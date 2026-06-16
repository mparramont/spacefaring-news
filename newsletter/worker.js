import { NewsletterStore } from "../functions/newsletter-store.js";
import { NewsletterSender } from "./sender.js";
import { generateNewsletterIssue } from "./generator.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function html(content, status = 200) {
  return new Response(content, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runScheduledNewsletter(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return corsPreflight();
    }

    const store = new NewsletterStore(env.NEWS_DB);
    const sender = new NewsletterSender(env.NEWS_DB);

    // Newsletter stats
    if (request.method === "GET" && url.pathname === "/api/newsletter/stats") {
      return json(await store.stats());
    }

    // Subscriber count
    if (request.method === "GET" && url.pathname === "/api/newsletter/subscribers/count") {
      return json({ count: await store.getSubscriberCount() });
    }

    // List subscribers (for admin)
    if (request.method === "GET" && url.pathname === "/api/newsletter/subscribers") {
      const limit = parseInt(url.searchParams.get("limit")) || 100;
      const offset = parseInt(url.searchParams.get("offset")) || 0;
      const subscribers = await store.getActiveSubscribers(limit, offset);
      return json({ subscribers, total: await store.getSubscriberCount() });
    }

    // Unsubscribe endpoint
    if (request.method === "POST" && url.pathname === "/api/unsubscribe") {
      let body;
      try {
        body = await request.json();
      } catch {
        body = {};
      }

      const email = url.searchParams.get("email") || body.email;
      const token = url.searchParams.get("token") || body.token;

      const identifier = token || email;
      const result = await store.unsubscribe(identifier);

      if (result.success) {
        return json({ success: true, message: `Unsubscribed ${result.email}` });
      } else {
        return json({ success: false, error: result.error, message: result.message }, 400);
      }
    }

    // Generate a new newsletter issue
    if (request.method === "POST" && url.pathname === "/api/newsletter/generate") {
      let body = await request.json();
      const issueNumber = body.issueNumber || 1;
      
      const issue = await generateNewsletterIssue(store, issueNumber);
      await store.saveNewsletterIssue(issue);

      return json({
        success: true,
        issue: {
          id: issue.id,
          issueNumber: issue.issueNumber,
          title: issue.title,
          status: issue.status,
        },
      });
    }

    // Preview newsletter issue
    if (request.method === "GET" && url.pathname === "/api/newsletter/preview") {
      const issueId = url.searchParams.get("issueId");
      const email = url.searchParams.get("email") || "test@example.com";

      if (issueId) {
        const issue = await store.getIssueById(issueId);
        if (!issue) {
          return json({ error: "Issue not found" }, 404);
        }
        
        const preview = await sender.previewIssue(issue, email, store);
        return json(preview);
      }

      // Generate a preview for the next issue
      const latestIssue = await store.getLatestIssue();
      const nextIssueNumber = latestIssue ? latestIssue.issue_number + 1 : 1;
      const issue = await generateNewsletterIssue(store, nextIssueNumber);
      const preview = await sender.previewIssue(issue, email, store);

      return json(preview);
    }

    // Send newsletter issue to all subscribers
    if (request.method === "POST" && url.pathname === "/api/newsletter/send") {
      let body = await request.json();
      const issueId = body.issueId;
      const testMode = body.testMode === true;
      const limit = testMode ? body.limit || 10 : null;

      if (!issueId) {
        // Send the latest issue
        const latestIssue = await store.getLatestIssue();
        if (!latestIssue) {
          return json({ error: "No issues found to send" }, 400);
        }
        
        const sender = new NewsletterSender(env.NEWS_DB, {
          baseUrl: body.baseUrl || "https://spacefaring-news.pages.dev"
        });
        
        const result = await sender.sendIssueToAll(latestIssue, store, limit);
        return json(result);
      }

      const issue = await store.getIssueById(issueId);
      if (!issue) {
        return json({ error: "Issue not found" }, 404);
      }

      const result = await sender.sendIssueToAll(issue, store, limit);
      return json(result);
    }

    // List newsletter issues
    if (request.method === "GET" && url.pathname === "/api/newsletter/issues") {
      const limit = parseInt(url.searchParams.get("limit")) || 20;
      const offset = parseInt(url.searchParams.get("offset")) || 0;
      const issues = await store.getIssues(limit, offset);
      return json({ issues, total: issues.length });
    }

    // Get specific issue
    if (request.method === "GET" && url.pathname.match(/^\/api\/newsletter\/issues\/\w+$/)) {
      const issueId = url.pathname.split("/").pop();
      const issue = await store.getIssueById(issueId);
      if (!issue) {
        return json({ error: "Issue not found" }, 404);
      }
      return json(issue);
    }

    // Health check
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, timestamp: new Date().toISOString() });
    }

    // Default 404
    return json({ error: "Not found" }, 404);
  },
};

async function runScheduledNewsletter(env) {
  try {
    const store = new NewsletterStore(env.NEWS_DB);
    const sender = new NewsletterSender(env.NEWS_DB);

    // Check if we should send a daily newsletter
    const latestIssue = await store.getLatestIssue();
    const today = new Date().toISOString().slice(0, 10);
    
    // Only send if no issue was sent today
    if (latestIssue && latestIssue.sent_at && latestIssue.sent_at.startsWith(today)) {
      console.log("Newsletter already sent today, skipping scheduled send");
      return;
    }

    // Get the next issue number
    const nextIssueNumber = latestIssue ? latestIssue.issue_number + 1 : 1;
    
    // Generate the newsletter issue
    const issue = await generateNewsletterIssue(store, nextIssueNumber);
    await store.saveNewsletterIssue(issue);

    // Send to all subscribers
    const result = await sender.sendIssueToAll(issue, store);
    console.log(`Scheduled newsletter send completed: ${JSON.stringify(result)}`);
    
  } catch (error) {
    console.error("Error in scheduled newsletter send:", error);
  }
}