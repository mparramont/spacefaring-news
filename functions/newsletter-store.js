import { randomUUID } from "node:crypto";

export class NewsletterStore {
  constructor(db) {
    this.db = db;
  }

  async saveSubscriber(email, name = null, source = "web") {
    const now = new Date().toISOString();
    const id = randomUUID();
    const unsubscribeToken = randomUUID();

    try {
      await this.db
        .prepare(
          `INSERT INTO newsletter_subscribers
            (id, email, name, subscribed_at, unsubscribe_token, is_active, source)
           VALUES (?, ?, ?, ?, ?, 1, ?)`,
        )
        .bind(id, email, name, now, unsubscribeToken, source)
        .run();

      return {
        success: true,
        subscriber: {
          id,
          email,
          name,
          subscribedAt: now,
          unsubscribeToken,
          source,
        },
      };
    } catch (error) {
      if (error.message.includes("UNIQUE constraint failed")) {
        // Email already exists, check if it's active
        const existing = await this.db
          .prepare("SELECT id, is_active FROM newsletter_subscribers WHERE email = ?")
          .bind(email)
          .first();

        if (existing) {
          if (existing.is_active === 1) {
            return {
              success: false,
              error: "already_subscribed",
              message: "This email is already subscribed.",
            };
          } else {
            // Reactivate the subscriber
            await this.db
              .prepare(
                "UPDATE newsletter_subscribers SET is_active = 1, updated_at = ? WHERE email = ?",
              )
              .bind(now, email)
              .run();

            return {
              success: true,
              subscriber: {
                id: existing.id,
                email,
                name,
                subscribedAt: now,
                reactivated: true,
              },
            };
          }
        }
      }

      return {
        success: false,
        error: "database_error",
        message: error.message,
      };
    }
  }

  async getSubscriberByEmail(email) {
    return this.db
      .prepare(
        `SELECT id, email, name, subscribed_at, is_active, unsubscribe_token, source
         FROM newsletter_subscribers WHERE email = ?`,
      )
      .bind(email)
      .first();
  }

  async getSubscriberByUnsubscribeToken(token) {
    return this.db
      .prepare(
        `SELECT id, email, name, subscribed_at, is_active, source
         FROM newsletter_subscribers WHERE unsubscribe_token = ?`,
      )
      .bind(token)
      .first();
  }

  async unsubscribe(emailOrToken) {
    const now = new Date().toISOString();

    // Try as token first
    let subscriber = await this.getSubscriberByUnsubscribeToken(emailOrToken);
    
    if (!subscriber) {
      // Try as email
      subscriber = await this.getSubscriberByEmail(emailOrToken);
    }

    if (!subscriber) {
      return { success: false, error: "not_found", message: "Subscriber not found." };
    }

    await this.db
      .prepare("UPDATE newsletter_subscribers SET is_active = 0, updated_at = ? WHERE id = ?")
      .bind(now, subscriber.id)
      .run();

    return { success: true, email: subscriber.email };
  }

  async getActiveSubscribers(limit = null, offset = 0) {
    let query = this.db
      .prepare(
        `SELECT id, email, name, subscribed_at, source
         FROM newsletter_subscribers
         WHERE is_active = 1
         ORDER BY subscribed_at DESC`,
      );

    if (limit !== null) {
      query = query.bind(limit, offset);
    }

    const result = await query.all();
    return result.results ?? [];
  }

  async getSubscriberCount() {
    const result = await this.db
      .prepare("SELECT COUNT(*) as count FROM newsletter_subscribers WHERE is_active = 1")
      .first();
    return result?.count ?? 0;
  }

  async saveNewsletterIssue(issue) {
    const now = new Date().toISOString();
    
    await this.db
      .prepare(
        `INSERT INTO newsletter_issues
          (id, issue_number, title, content_html, content_text, sent_at, 
           recipient_count, sent_count, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        issue.id,
        issue.issueNumber,
        issue.title,
        issue.contentHtml,
        issue.contentText,
        issue.sentAt || null,
        issue.recipientCount || 0,
        issue.sentCount || 0,
        issue.status || "draft",
        now,
        now,
      )
      .run();

    return { success: true, issue };
  }

  async updateNewsletterIssue(issueId, updates) {
    const now = new Date().toISOString();
    const { status, sentAt, recipientCount, sentCount, ...rest } = updates;

    const updateFields = [];
    const bindValues = [];

    if (status !== undefined) {
      updateFields.push("status = ?");
      bindValues.push(status);
    }
    if (sentAt !== undefined) {
      updateFields.push("sent_at = ?");
      bindValues.push(sentAt);
    }
    if (recipientCount !== undefined) {
      updateFields.push("recipient_count = ?");
      bindValues.push(recipientCount);
    }
    if (sentCount !== undefined) {
      updateFields.push("sent_count = ?");
      bindValues.push(sentCount);
    }
    if (updates.bounceCount !== undefined) {
      updateFields.push("bounce_count = ?");
      bindValues.push(updates.bounceCount);
    }
    if (updates.unsubscribeCount !== undefined) {
      updateFields.push("unsubscribe_count = ?");
      bindValues.push(updates.unsubscribeCount);
    }

    updateFields.push("updated_at = ?");
    bindValues.push(now);

    bindValues.push(issueId);

    if (updateFields.length > 1) {
      await this.db
        .prepare(`UPDATE newsletter_issues SET ${updateFields.join(", ")} WHERE id = ?`)
        .bind(...bindValues)
        .run();
    }

    return { success: true };
  }

  async recordSend(issueId, subscriberId, status = "sent", bounceReason = null) {
    const now = new Date().toISOString();
    const id = randomUUID();

    await this.db
      .prepare(
        `INSERT INTO newsletter_sends
          (id, issue_id, subscriber_id, sent_at, status, bounce_reason)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, issueId, subscriberId, now, status, bounceReason)
      .run();

    return { success: true, sendId: id };
  }

  async getLatestIssue() {
    return this.db
      .prepare(
        `SELECT * FROM newsletter_issues
         ORDER BY issue_number DESC
         LIMIT 1`,
      )
      .first();
  }

  async getIssueById(issueId) {
    return this.db
      .prepare("SELECT * FROM newsletter_issues WHERE id = ?")
      .bind(issueId)
      .first();
  }

  async getIssues(limit = 10, offset = 0) {
    const result = await this.db
      .prepare(
        `SELECT * FROM newsletter_issues
         ORDER BY issue_number DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(limit, offset)
      .all();
    return result.results ?? [];
  }

  async getSendStatsForIssue(issueId) {
    const result = await this.db
      .prepare(
        `SELECT 
          COUNT(*) as total_sends,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
          SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) as bounced_count
         FROM newsletter_sends
         WHERE issue_id = ?`,
      )
      .bind(issueId)
      .first();
    
    return result || { total_sends: 0, sent_count: 0, bounced_count: 0 };
  }

  async stats() {
    const subscriberCount = await this.getSubscriberCount();
    
    const latestIssue = await this.getLatestIssue();
    const issueCount = latestIssue ? latestIssue.issue_number : 0;

    const recentSends = await this.db
      .prepare(
        `SELECT COUNT(*) as count FROM newsletter_sends
         WHERE sent_at >= datetime('now', '-7 days')`,
      )
      .first();

    return {
      subscriberCount,
      issueCount,
      recentSendsCount: recentSends?.count ?? 0,
    };
  }
}