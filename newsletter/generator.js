import { NewsletterStore } from "../functions/newsletter-store.js";

export async function generateNewsletterIssue(store, issueNumber, date = new Date()) {
  const now = date.toISOString();
  const dateStr = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long', 
    day: 'numeric'
  });

  // Get recent stories for the newsletter
  const recentItems = await store.db
    .prepare(
      `SELECT 
        items.id,
        items.source_id,
        items.source_title,
        items.title,
        items.url,
        items.summary,
        items.author,
        items.published_at,
        items.fetched_at
      FROM news_items AS items
      WHERE COALESCE(items.published_at, items.fetched_at) >= datetime('now', '-2 days')
      ORDER BY COALESCE(items.published_at, items.fetched_at) DESC
      LIMIT 10`
    )
    .all();

  const items = recentItems.results ?? [];

  // Get subscriber count
  const subscriberCount = await store.getSubscriberCount();

  // Generate issue ID
  const issueId = `issue-${date.toISOString().slice(0, 10)}-${String(issueNumber).padStart(4, '0')}`;

  // Generate HTML content
  const htmlContent = generateHtmlIssue(items, dateStr, issueNumber, subscriberCount);
  const textContent = generateTextIssue(items, dateStr, issueNumber, subscriberCount);

  return {
    id: issueId,
    issueNumber,
    title: `Spacefaring News Issue #${issueNumber} - ${dateStr}`,
    contentHtml: htmlContent,
    contentText: textContent,
    sentAt: null,
    recipientCount: subscriberCount,
    sentCount: 0,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

function generateHtmlIssue(items, dateStr, issueNumber, subscriberCount) {
  const storiesHtml = items.map((item, index) => {
    const publishedDate = item.published_at ? new Date(item.published_at).toLocaleString() : '';
    return `
      <article class="newsletter-story">
        <h3><a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a></h3>
        <p class="story-meta">${escapeHtml(item.source_title)} • ${publishedDate}</p>
        ${item.summary ? `<p class="story-summary">${escapeHtml(item.summary)}</p>` : ''}
        ${item.author ? `<p class="story-author">By ${escapeHtml(item.author)}</p>` : ''}
      </article>
    `;
  }).join('');

  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Spacefaring News Issue #${issueNumber} - ${dateStr}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
      background-color: #fff;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #000;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: bold;
    }
    .header p {
      margin: 5px 0 0 0;
      color: #666;
    }
    .stats {
      text-align: center;
      margin: 20px 0;
      color: #666;
      font-size: 14px;
    }
    .newsletter-story {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }
    .newsletter-story:last-child {
      border-bottom: none;
    }
    .newsletter-story h3 {
      margin: 0 0 10px 0;
      font-size: 18px;
    }
    .newsletter-story h3 a {
      color: #000;
      text-decoration: none;
    }
    .newsletter-story h3 a:hover {
      text-decoration: underline;
    }
    .story-meta {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #666;
    }
    .story-summary {
      margin: 0 0 10px 0;
      color: #444;
    }
    .story-author {
      margin: 0;
      font-size: 14px;
      color: #666;
      font-style: italic;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 14px;
      color: #666;
      text-align: center;
    }
    .footer a {
      color: #000;
    }
    .unsubscribe {
      margin-top: 20px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>SPACEFARING NEWS</h1>
    <p>Issue #${issueNumber} • ${dateStr}</p>
  </div>
  
  <p>Good morning, spacefarer.</p>
  <p>Here's your daily briefing on what's happening beyond Earth's atmosphere.</p>

  <div class="stats">
    <strong>${subscriberCount}</strong> spacefarers aboard
  </div>

  <section class="stories">
    ${storiesHtml}
  </section>

  <div class="footer">
    <p><a href="https://spacefaring-news.pages.dev">Read more on our website</a></p>
    <p class="unsubscribe">
      <a href="{{unsubscribe_url}}">Unsubscribe</a> | 
      <a href="{{preferences_url}}">Update preferences</a>
    </p>
  </div>
</body>
</html>
  `;
}

function generateTextIssue(items, dateStr, issueNumber, subscriberCount) {
  const storiesText = items.map((item, index) => {
    return `
${item.title}
${item.source_title} • ${item.published_at || item.fetched_at}
${item.url}
${item.summary ? `${item.summary}\n` : ''}
${item.author ? `By ${item.author}\n` : ''}
    `;
  }).join('\n---\n');

  return `
Spacefaring News - Issue #${issueNumber}
${dateStr}

Good morning, spacefarer.

Here's your daily briefing on what's happening beyond Earth's atmosphere.

${subscriberCount} spacefarers aboard

---

${storiesText}

---

Read more on our website: https://spacefaring-news.pages.dev

Unsubscribe: {{unsubscribe_url}}
Update preferences: {{preferences_url}}
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}