use spacefaring_news_backend::{parse_feed, FeedSource};

fn source() -> FeedSource {
    FeedSource {
        id: "test-source".to_string(),
        title: "Test Source".to_string(),
        url: "https://example.com/feed.xml".to_string(),
        homepage: "https://example.com/".to_string(),
        category: "industry".to_string(),
        language: "en".to_string(),
        region: "global".to_string(),
        cadence_minutes: 30,
    }
}

#[test]
fn parses_rss_items_into_normalized_news_items() {
    let items = parse_feed(
        r#"<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>Launch window opens</title>
              <link>https://example.com/launch</link>
              <guid>launch-1</guid>
              <pubDate>Sat, 13 Jun 2026 12:00:00 GMT</pubDate>
              <description><![CDATA[<p>Vehicle is vertical.</p>]]></description>
              <dc:creator>Mission Desk</dc:creator>
            </item>
          </channel>
        </rss>"#,
        &source(),
        "2026-06-14T00:00:00.000Z",
    )
    .expect("feed parses");

    assert_eq!(items.len(), 1);
    assert_eq!(items[0].source_id, "test-source");
    assert_eq!(items[0].title, "Launch window opens");
    assert_eq!(items[0].url, "https://example.com/launch");
    assert_eq!(items[0].summary.as_deref(), Some("Vehicle is vertical."));
    assert_eq!(items[0].author.as_deref(), Some("Mission Desk"));
    assert_eq!(
        items[0].published_at.as_deref(),
        Some("2026-06-13T12:00:00.000Z")
    );
}

#[test]
fn parses_atom_entries_with_alternate_links() {
    let items = parse_feed(
        r#"<?xml version="1.0"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <title>Station crew update</title>
            <id>tag:example.com,2026:station</id>
            <link rel="alternate" href="https://example.com/station" />
            <updated>2026-06-14T01:30:00Z</updated>
            <summary>Docking complete.</summary>
            <author><name>Orbit Desk</name></author>
          </entry>
        </feed>"#,
        &source(),
        "2026-06-14T02:00:00.000Z",
    )
    .expect("feed parses");

    assert_eq!(items.len(), 1);
    assert_eq!(items[0].title, "Station crew update");
    assert_eq!(items[0].url, "https://example.com/station");
    assert_eq!(items[0].summary.as_deref(), Some("Docking complete."));
    assert_eq!(items[0].author.as_deref(), Some("Orbit Desk"));
    assert_eq!(
        items[0].published_at.as_deref(),
        Some("2026-06-14T01:30:00.000Z")
    );
}
