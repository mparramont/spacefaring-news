import { NewsletterStore } from "../newsletter-store.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const onRequestPost = async ({ request, env }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const url = new URL(request.url);
  const email = url.searchParams.get("email") || body.email;
  const token = url.searchParams.get("token") || body.token;

  const identifier = token || email;

  if (!identifier) {
    return json({ 
      success: false, 
      error: "missing_identifier", 
      message: "Email or token is required" 
    }, 400);
  }

  try {
    const store = new NewsletterStore(env.NEWS_DB);
    const result = await store.unsubscribe(identifier);

    if (result.success) {
      return json({ 
        success: true, 
        message: `Successfully unsubscribed ${result.email}` 
      });
    } else {
      return json({ 
        success: false, 
        error: result.error, 
        message: result.message 
      }, 400);
    }
  } catch (error) {
    return json({ 
      success: false, 
      error: "server_error", 
      message: error.message 
    }, 500);
  }
};

export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  const token = url.searchParams.get("token");

  if (!email && !token) {
    // Return a simple unsubscribe form
    return new Response(`
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Unsubscribe - Spacefaring News</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 500px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1 { color: #000; }
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-weight: 500; }
    input[type="email"] {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
    }
    button {
      background: #000;
      color: #fff;
      border: none;
      padding: 10px 15px;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover { background: #333; }
    .message { margin-top: 15px; padding: 10px; border-radius: 4px; }
    .success { background: #d4edda; color: #155724; }
    .error { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <h1>Unsubscribe</h1>
  <p>Enter your email address to unsubscribe from Spacefaring News.</p>
  
  <form method="post" action="/api/unsubscribe">
    <div class="form-group">
      <label for="email">Email address</label>
      <input type="email" id="email" name="email" required />
    </div>
    <button type="submit">Unsubscribe</button>
  </form>
</body>
</html>
    `, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // Process the unsubscribe
  const identifier = token || email;
  
  try {
    const store = new NewsletterStore(env.NEWS_DB);
    const result = await store.unsubscribe(identifier);

    if (result.success) {
      return new Response(`
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Unsubscribed - Spacefaring News</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 500px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
      text-align: center;
    }
    h1 { color: #000; }
    .message { margin-top: 15px; padding: 10px; border-radius: 4px; }
    .success { background: #d4edda; color: #155724; }
  </style>
</head>
<body>
  <h1>Unsubscribed</h1>
  <div class="message success">
    <p><strong>You have been unsubscribed from Spacefaring News.</strong></p>
    <p>We're sorry to see you go. You can resubscribe anytime at <a href="https://spacefaring-news.pages.dev">spacefaring-news.pages.dev</a>.</p>
  </div>
</body>
</html>
      `, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } else {
      return new Response(`
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Error - Spacefaring News</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 500px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
      text-align: center;
    }
    h1 { color: #000; }
    .message { margin-top: 15px; padding: 10px; border-radius: 4px; }
    .error { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <h1>Error</h1>
  <div class="message error">
    <p><strong>Unable to process unsubscribe request.</strong></p>
    <p>${escapeHtml(result.message || 'Subscriber not found.')}</p>
    <p>Please try again or contact support.</p>
  </div>
</body>
</html>
      `, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
  } catch (error) {
    return new Response(`
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Error - Spacefaring News</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 500px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
      text-align: center;
    }
    h1 { color: #000; }
    .message { margin-top: 15px; padding: 10px; border-radius: 4px; }
    .error { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <h1>Error</h1>
  <div class="message error">
    <p><strong>Server error</strong></p>
    <p>Please try again later or contact support.</p>
  </div>
</body>
</html>
    `, {
      status: 500,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
};

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}