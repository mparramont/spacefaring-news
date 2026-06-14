use spacefaring_news_backend::{
    ingest_feed_documents, post_to_news_item, FeedFetch, FeedSource, XPost, XSource,
};

fn feed_source(id: &str, url: &str) -> FeedSource {
    FeedSource {
        id: id.to_string(),
        title: format!("{id} title"),
        url: url.to_string(),
        homepage: "https://example.com/".to_string(),
        category: "agency".to_string(),
        language: "en".to_string(),
        region: "global".to_string(),
        cadence_minutes: 30,
    }
}

#[test]
fn ingests_multiple_feed_documents_and_records_failures() {
    let sources = vec![
        feed_source("rss-source", "https://example.com/rss.xml"),
        feed_source("atom-source", "https://example.com/atom.xml"),
        feed_source("bad-source", "https://example.com/bad.xml"),
    ];
    let documents = vec![
        FeedFetch::Fetched {
            source_id: "rss-source".to_string(),
            xml: r#"<rss><channel><item><title>Launch update</title><link>https://example.com/launch</link><guid>launch-1</guid><pubDate>Sun, 14 Jun 2026 00:00:00 GMT</pubDate></item></channel></rss>"#.to_string(),
        },
        FeedFetch::Fetched {
            source_id: "atom-source".to_string(),
            xml: r#"<feed><entry><title>Policy update</title><id>policy-1</id><link rel="alternate" href="https://example.com/policy" /><updated>2026-06-14T01:00:00Z</updated></entry></feed>"#.to_string(),
        },
        FeedFetch::Failed {
            source_id: "bad-source".to_string(),
            message: "HTTP 503".to_string(),
        },
    ];

    let run = ingest_feed_documents(&sources, &documents, "2026-06-14T02:00:00.000Z");

    assert_eq!(run.source_count, 3);
    assert_eq!(run.fetched_count, 2);
    assert_eq!(run.failed_count, 1);
    assert_eq!(run.errors[0].source_id, "bad-source");
    let mut titles: Vec<&str> = run.items.iter().map(|item| item.title.as_str()).collect();
    titles.sort_unstable();
    assert_eq!(titles, vec!["Launch update", "Policy update"]);
}

#[test]
fn normalizes_x_posts_into_news_items() {
    let source = XSource {
        id: "x-isro".to_string(),
        title: "ISRO on X".to_string(),
        username: "isro".to_string(),
        url: "https://x.com/isro".to_string(),
        homepage: "https://www.isro.gov.in/".to_string(),
        category: "agency".to_string(),
        language: "en".to_string(),
        region: "india".to_string(),
        cadence_minutes: 1440,
    };
    let post = XPost {
        id: "200".to_string(),
        text: "Mission Drishti has launched successfully.".to_string(),
        created_at: Some("2026-06-14T01:30:00Z".to_string()),
        lang: Some("en".to_string()),
    };

    let item = post_to_news_item(&post, &source, "2026-06-14T03:00:00.000Z");

    assert_eq!(item.id, "x:200");
    assert_eq!(item.source_id, "x-isro");
    assert_eq!(item.url, "https://x.com/isro/status/200");
    assert_eq!(
        item.summary.as_deref(),
        Some("Mission Drishti has launched successfully.")
    );
    assert_eq!(
        item.published_at.as_deref(),
        Some("2026-06-14T01:30:00.000Z")
    );
}
