use spacefaring_news_backend::*;

#[test]
fn test_email_validation() {
    // Valid emails
    assert!(is_valid_email("test@example.com"));
    assert!(is_valid_email("user.name+tag@domain.co.uk"));
    assert!(is_valid_email("first.last@sub.domain.org"));
    assert!(is_valid_email("email123@domain.net"));

    // Invalid emails
    assert!(!is_valid_email(""));
    assert!(!is_valid_email("not-an-email"));
    assert!(!is_valid_email("missingdot@com")); // No dot in domain
    assert!(!is_valid_email("spaces not@allowed.com"));
    assert!(!is_valid_email("@missinglocal.com"));
    assert!(!is_valid_email("test@.com"));
    assert!(!is_valid_email("test@domain..com"));
    assert!(!is_valid_email("test@domain."));
}

#[test]
fn test_create_test_subscriber() {
    let subscriber = create_test_subscriber("test@example.com");

    assert_eq!(subscriber.email, "test@example.com");
    assert_eq!(subscriber.name, Some("Test User".to_string()));
    assert!(subscriber.is_active);
    assert_eq!(subscriber.source, "test");
    assert!(!subscriber.id.is_empty());
    assert!(!subscriber.unsubscribe_token.is_empty());
    assert!(!subscriber.subscribed_at.is_empty());
}

#[test]
fn test_create_test_issue() {
    let issue = create_test_issue(42);

    assert_eq!(issue.issue_number, 42);
    assert_eq!(issue.title, "Test Issue #42");
    assert!(!issue.id.is_empty());
    assert!(!issue.content_html.is_empty());
    assert!(!issue.content_text.is_empty());
    assert_eq!(issue.recipient_count, 0);
    assert_eq!(issue.sent_count, 0);
    assert_eq!(issue.bounce_count, 0);
    assert_eq!(issue.unsubscribe_count, 0);
    assert_eq!(issue.status, "draft");
    assert!(issue.sent_at.is_none());
}

#[test]
fn test_newsletter_subscriber_structure() {
    let subscriber = NewsletterSubscriber {
        id: "sub-123".to_string(),
        email: "test@example.com".to_string(),
        name: Some("Test User".to_string()),
        subscribed_at: "2026-01-01T00:00:00.000Z".to_string(),
        unsubscribe_token: "token-456".to_string(),
        is_active: true,
        source: "web".to_string(),
    };

    assert_eq!(subscriber.id, "sub-123");
    assert_eq!(subscriber.email, "test@example.com");
    assert_eq!(subscriber.name, Some("Test User".to_string()));
    assert!(subscriber.is_active);
}

#[test]
fn test_newsletter_issue_structure() {
    let issue = NewsletterIssue {
        id: "issue-001".to_string(),
        issue_number: 1,
        title: "First Issue".to_string(),
        content_html: "<h1>Hello</h1>".to_string(),
        content_text: "Hello".to_string(),
        sent_at: Some("2026-01-01T12:00:00.000Z".to_string()),
        recipient_count: 100,
        sent_count: 95,
        bounce_count: 5,
        unsubscribe_count: 2,
        status: "sent".to_string(),
    };

    assert_eq!(issue.id, "issue-001");
    assert_eq!(issue.issue_number, 1);
    assert_eq!(issue.title, "First Issue");
    assert_eq!(issue.status, "sent");
    assert_eq!(issue.recipient_count, 100);
    assert_eq!(issue.sent_count, 95);
    assert_eq!(issue.bounce_count, 5);
    assert_eq!(issue.unsubscribe_count, 2);
}

#[test]
fn test_newsletter_send_structure() {
    let send = NewsletterSend {
        id: "send-001".to_string(),
        issue_id: "issue-001".to_string(),
        subscriber_id: "sub-001".to_string(),
        sent_at: "2026-01-01T12:00:00.000Z".to_string(),
        status: "sent".to_string(),
        bounce_reason: None,
    };

    assert_eq!(send.id, "send-001");
    assert_eq!(send.issue_id, "issue-001");
    assert_eq!(send.subscriber_id, "sub-001");
    assert_eq!(send.status, "sent");
    assert!(send.bounce_reason.is_none());
}

#[test]
fn test_newsletter_send_with_bounce() {
    let send = NewsletterSend {
        id: "send-002".to_string(),
        issue_id: "issue-001".to_string(),
        subscriber_id: "sub-002".to_string(),
        sent_at: "2026-01-01T12:00:00.000Z".to_string(),
        status: "bounced".to_string(),
        bounce_reason: Some("Invalid email address".to_string()),
    };

    assert_eq!(send.status, "bounced");
    assert_eq!(send.bounce_reason, Some("Invalid email address".to_string()));
}

#[test]
fn test_subscribe_fragments_unchanged() {
    // Ensure existing subscription messages still work
    use spacefaring_news_backend::{SUBSCRIBE_SUCCESS, SUBSCRIBE_INVALID, SUBSCRIBE_DUPLICATE};
    
    let success = std::str::from_utf8(SUBSCRIBE_SUCCESS).expect("fragment is valid utf-8");
    let invalid = std::str::from_utf8(SUBSCRIBE_INVALID).expect("fragment is valid utf-8");
    let duplicate = std::str::from_utf8(SUBSCRIBE_DUPLICATE).expect("fragment is valid utf-8");

    assert!(success.contains("You've joined the manifest."));
    assert!(success.contains("Spacefaring News dispatch coming soon."));
    assert!(invalid.contains("Use a valid email address."));
    assert!(duplicate.contains("Already on board."));
    assert!(duplicate.contains("already subscribed to Spacefaring News"));
}

#[test]
fn test_email_validation_edge_cases() {
    // Test various edge cases for email validation
    assert!(is_valid_email("a@b.co")); // Minimal valid email
    assert!(is_valid_email("test.email+tag@sub.domain.co.uk")); // Complex valid email
    
    // Test edge cases that should fail
    assert!(!is_valid_email("test@")); // Missing domain
    assert!(!is_valid_email("@domain.com")); // Missing local part
    assert!(!is_valid_email("test domain@test.com")); // Space in local part
    assert!(!is_valid_email("test@domain")); // Missing TLD
    assert!(!is_valid_email("test@domain..com")); // Double dot
}