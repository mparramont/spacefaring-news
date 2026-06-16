/**
 * Newsletter Sender
 * 
 * This module handles sending newsletters to subscribers.
 * For production use with Cloudflare, you'll need to configure:
 * - A Cloudflare Email Routing address for sending
 * - Or integrate with an email service like SendGrid, Mailgun, etc.
 * 
 * For now, this provides the structure and can be adapted to the chosen email provider.
 */

import { randomUUID } from "node:crypto";

export class NewsletterSender {
  constructor(db, options = {}) {
    this.db = db;
    this.options = {
      fromEmail: options.fromEmail || "newsletter@spacefaring.news",
      fromName: options.fromName || "Spacefaring News",
      replyTo: options.replyTo || "hello@spacefaring.news",
      baseUrl: options.baseUrl || "https://spacefaring-news.pages.dev",
      ...options,
    };
  }

  /**
   * Send a newsletter issue to all active subscribers
   * This is a placeholder that logs the send operation.
   * In production, you would integrate with an email service.
   */
  async sendIssueToAll(issue, store, limit = null) {
    const now = new Date().toISOString();
    const subscribers = await store.getActiveSubscribers(limit);
    
    let sentCount = 0;
    let failedCount = 0;
    const sends = [];

    for (const subscriber of subscribers) {
      try {
        // In production, this would actually send the email
        const sendResult = await this.sendToSubscriber(issue, subscriber);
        
        if (sendResult.success) {
          // Record the send in the database
          await store.recordSend(issue.id, subscriber.id, "sent");
          sends.push({ subscriberId: subscriber.id, status: "sent" });
          sentCount++;
        } else {
          await store.recordSend(issue.id, subscriber.id, "failed", sendResult.error);
          sends.push({ subscriberId: subscriber.id, status: "failed", error: sendResult.error });
          failedCount++;
        }
      } catch (error) {
        await store.recordSend(issue.id, subscriber.id, "failed", error.message);
        sends.push({ subscriberId: subscriber.id, status: "failed", error: error.message });
        failedCount++;
      }
    }

    // Update the issue with final counts
    await store.updateNewsletterIssue(issue.id, {
      sentAt: now,
      recipientCount: subscribers.length,
      sentCount: sentCount,
      status: "sent",
    });

    return {
      success: true,
      totalRecipients: subscribers.length,
      sentCount,
      failedCount,
      issueId: issue.id,
      sends,
    };
  }

  /**
   * Send newsletter to a single subscriber
   * This is a placeholder that simulates the send operation.
   */
  async sendToSubscriber(issue, subscriber) {
    // Generate personalized content
    const personalizedContent = this.personalizeContent(issue, subscriber);
    
    // In production, this would send the actual email
    // For now, we just log and return success
    console.log(`Sending newsletter issue #${issue.issueNumber} to ${subscriber.email}`);
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      email: subscriber.email,
      issueId: issue.id,
    };
  }

  /**
   * Personalize newsletter content for a specific subscriber
   */
  personalizeContent(issue, subscriber) {
    const unsubscribeUrl = this.generateUnsubscribeUrl(subscriber);
    const preferencesUrl = this.generatePreferencesUrl(subscriber);
    
    let htmlContent = issue.contentHtml
      .replace(/\{\{unsubscribe_url\}\}/g, escapeHtml(unsubscribeUrl))
      .replace(/\{\{preferences_url\}\}/g, escapeHtml(preferencesUrl));
    
    let textContent = issue.contentText
      .replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl)
      .replace(/\{\{preferences_url\}\}/g, preferencesUrl);
    
    return {
      html: htmlContent,
      text: textContent,
    };
  }

  /**
   * Generate unsubscribe URL for a subscriber
   */
  generateUnsubscribeUrl(subscriber) {
    if (subscriber.unsubscribe_token) {
      return `${this.options.baseUrl}/api/unsubscribe?token=${subscriber.unsubscribe_token}`;
    }
    return `${this.options.baseUrl}/api/unsubscribe?email=${encodeURIComponent(subscriber.email)}`;
  }

  /**
   * Generate preferences URL for a subscriber
   */
  generatePreferencesUrl(subscriber) {
    return `${this.options.baseUrl}/preferences?email=${encodeURIComponent(subscriber.email)}`;
  }

  /**
   * Preview email content without sending
   */
  async previewIssue(issue, email = "test@example.com", store) {
    const testSubscriber = {
      id: "test-subscriber",
      email,
      name: "Test User",
      unsubscribe_token: randomUUID(),
    };
    
    const personalizedContent = this.personalizeContent(issue, testSubscriber);
    
    return {
      issueId: issue.id,
      issueNumber: issue.issueNumber,
      email,
      htmlContent: personalizedContent.html,
      textContent: personalizedContent.text,
      subject: issue.title,
    };
  }
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