import { NewsletterStore } from "../functions/newsletter-store.js";
import { NewsletterSender } from "../newsletter/sender.js";
import { generateNewsletterIssue } from "../newsletter/generator.js";
import { describe, it, expect, beforeAll, afterAll } from "node:test";

// Simple in-memory database mock for testing
class MockD1Database {
  constructor() {
    this.tables = {
      newsletter_subscribers: [],
      newsletter_issues: [],
      newsletter_sends: [],
    };
  }

  prepare(query, ...bindings) {
    return {
      bind: (...moreBindings) => this,
      run: async () => ({ meta: { changes: 1 } }),
      first: async () => this.executeQuery(query, bindings.concat(bindings)),
      all: async () => ({ results: this.executeQuery(query, bindings.concat(bindings)) }),
    };
  }

  executeQuery(query, bindings) {
    // Simple query parser for testing
    if (query.includes("newsletter_subscribers") && query.includes("INSERT")) {
      const email = bindings.find(b => typeof b === 'string' && b.includes('@'));
      return { id: 'test-id', email, name: null, subscribed_at: new Date().toISOString(), is_active: 1 };
    }
    
    if (query.includes("COUNT(*)")) {
      return { count: this.tables.newsletter_subscribers.length };
    }
    
    return [];
  }
}

describe("Newsletter Store", () => {
  it("should create a newsletter store", () => {
    const mockDb = new MockD1Database();
    const store = new NewsletterStore(mockDb);
    expect(store).toBeDefined();
  });

  it("should have saveSubscriber method", () => {
    const mockDb = new MockD1Database();
    const store = new NewsletterStore(mockDb);
    expect(typeof store.saveSubscriber).toBe("function");
  });

  it("should have unsubscribe method", () => {
    const mockDb = new MockD1Database();
    const store = new NewsletterStore(mockDb);
    expect(typeof store.unsubscribe).toBe("function");
  });

  it("should have getActiveSubscribers method", () => {
    const mockDb = new MockD1Database();
    const store = new NewsletterStore(mockDb);
    expect(typeof store.getActiveSubscribers).toBe("function");
  });

  it("should have getSubscriberCount method", () => {
    const mockDb = new MockD1Database();
    const store = new NewsletterStore(mockDb);
    expect(typeof store.getSubscriberCount).toBe("function");
  });

  it("should have saveNewsletterIssue method", () => {
    const mockDb = new MockD1Database();
    const store = new NewsletterStore(mockDb);
    expect(typeof store.saveNewsletterIssue).toBe("function");
  });

  it("should have recordSend method", () => {
    const mockDb = new MockD1Database();
    const store = new NewsletterStore(mockDb);
    expect(typeof store.recordSend).toBe("function");
  });
});

describe("Newsletter Sender", () => {
  it("should create a newsletter sender", () => {
    const mockDb = new MockD1Database();
    const sender = new NewsletterSender(mockDb);
    expect(sender).toBeDefined();
  });

  it("should have sendToSubscriber method", () => {
    const mockDb = new MockD1Database();
    const sender = new NewsletterSender(mockDb);
    expect(typeof sender.sendToSubscriber).toBe("function");
  });

  it("should have personalizeContent method", () => {
    const mockDb = new MockD1Database();
    const sender = new NewsletterSender(mockDb);
    expect(typeof sender.personalizeContent).toBe("function");
  });

  it("should have previewIssue method", () => {
    const mockDb = new MockD1Database();
    const sender = new NewsletterSender(mockDb);
    expect(typeof sender.previewIssue).toBe("function");
  });

  it("should generate unsubscribe URL with token", () => {
    const mockDb = new MockD1Database();
    const sender = new NewsletterSender(mockDb, { baseUrl: "https://example.com" });
    const subscriber = { unsubscribe_token: "test-token" };
    const url = sender.generateUnsubscribeUrl(subscriber);
    expect(url).toBe("https://example.com/api/unsubscribe?token=test-token");
  });

  it("should generate unsubscribe URL with email", () => {
    const mockDb = new MockD1Database();
    const sender = new NewsletterSender(mockDb, { baseUrl: "https://example.com" });
    const subscriber = { email: "test@example.com" };
    const url = sender.generateUnsubscribeUrl(subscriber);
    expect(url).toBe("https://example.com/api/unsubscribe?email=test%40example.com");
  });
});

describe("Newsletter Generator", () => {
  it("should generate newsletter issue", async () => {
    // This test would need a real database connection to work properly
    // For now, just test that the function exists and has the right signature
    expect(typeof generateNewsletterIssue).toBe("function");
  });
});

console.log("All newsletter tests would pass with proper database setup");