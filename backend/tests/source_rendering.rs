use spacefaring_news_backend::{render_sources_fragment, render_sources_page, SourceView};

fn sample_sources() -> Vec<SourceView> {
    vec![
        SourceView {
            id: "nasa-news-releases".to_string(),
            title: "NASA News Releases".to_string(),
            url: "https://www.nasa.gov/news-release/feed/".to_string(),
            homepage: "https://www.nasa.gov/news-release/".to_string(),
            category: "agency".to_string(),
            language: "en".to_string(),
            region: "us".to_string(),
            latest_item_title: Some("Artemis update".to_string()),
            latest_item_url: Some("https://example.com/artemis".to_string()),
            latest_item_published_at: Some("2026-06-14T09:00:00.000Z".to_string()),
            latest_item_fetched_at: Some("2026-06-14T10:00:00.000Z".to_string()),
        },
        SourceView {
            id: "x-isro".to_string(),
            title: "ISRO on X".to_string(),
            url: "https://x.com/isro".to_string(),
            homepage: "https://www.isro.gov.in/".to_string(),
            category: "agency".to_string(),
            language: "en".to_string(),
            region: "india".to_string(),
            latest_item_title: None,
            latest_item_url: None,
            latest_item_published_at: None,
            latest_item_fetched_at: None,
        },
    ]
}

#[test]
fn renders_all_sources_with_latest_info() {
    let html = render_sources_fragment(&sample_sources(), "");

    assert!(html.contains("2 of 2 active sources"));
    assert!(html.contains("NASA News Releases"));
    assert!(html.contains("href=\"https://example.com/artemis\""));
    assert!(html.contains("Artemis update"));
    assert!(html.contains("2026-06-14"));
    assert!(html.contains("ISRO on X"));
    assert!(html.contains("Latest: none stored yet"));
}

#[test]
fn filters_sources_by_region_title_category_language_and_latest_title() {
    let html = render_sources_fragment(&sample_sources(), "india");

    assert!(html.contains("1 of 2 active sources"));
    assert!(html.contains("ISRO on X"));
    assert!(!html.contains("NASA News Releases"));
}

#[test]
fn renders_sources_page_with_htmx_fragment_loading() {
    let html = render_sources_page("https://example.com/sources-fragment");

    assert!(html.contains("<title>Sources - Spacefaring News</title>"));
    assert!(html.contains(r#"<link rel="stylesheet" href="/src/styles.css" />"#));
    assert!(html.contains("<h1>Sources</h1>"));
    assert!(html.contains("hx-get=\"https://example.com/sources-fragment\""));
    assert!(html.contains("hx-trigger=\"load, input changed delay:250ms from:#source-search\""));
    assert!(html.contains("hx-include=\"#source-search\""));
    assert!(html.contains("id=\"sources-results\""));
    assert!(!html.contains("/src/sources.ts"));
}
