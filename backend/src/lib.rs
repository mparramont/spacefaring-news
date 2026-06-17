pub const SUBSCRIBE_SUCCESS: &[u8] = br#"<div class="notice success blog-card" data-testid="signup-success"><strong>You've joined the manifest.</strong><span>Spacefaring News dispatch coming soon.</span></div>"#;
pub const SUBSCRIBE_INVALID: &[u8] = br#"<div class="notice error blog-card" data-testid="signup-error"><strong>Use a valid email address.</strong></div>"#;
pub const SUBSCRIBE_DUPLICATE: &[u8] = br#"<div class="notice info blog-card" data-testid="signup-duplicate"><strong>Already on board.</strong><span>This email is already subscribed to Spacefaring News.</span></div>"#;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedSource {
    pub id: String,
    pub title: String,
    pub url: String,
    pub homepage: String,
    pub category: String,
    pub language: String,
    pub region: String,
    pub cadence_minutes: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewsItem {
    pub id: String,
    pub source_id: String,
    pub source_title: String,
    pub title: String,
    pub url: String,
    pub summary: Option<String>,
    pub author: Option<String>,
    pub published_at: Option<String>,
    pub fetched_at: String,
    pub guid: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct XSource {
    pub id: String,
    pub title: String,
    pub username: String,
    pub url: String,
    pub homepage: String,
    pub category: String,
    pub language: String,
    pub region: String,
    pub cadence_minutes: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct XPost {
    pub id: String,
    pub text: String,
    pub created_at: Option<String>,
    pub lang: Option<String>,
}

// Newsletter data structures
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewsletterSubscriber {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
    pub subscribed_at: String,
    pub unsubscribe_token: String,
    pub is_active: bool,
    pub source: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewsletterIssue {
    pub id: String,
    pub issue_number: u32,
    pub title: String,
    pub content_html: String,
    pub content_text: String,
    pub sent_at: Option<String>,
    pub recipient_count: u32,
    pub sent_count: u32,
    pub bounce_count: u32,
    pub unsubscribe_count: u32,
    pub status: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewsletterSend {
    pub id: String,
    pub issue_id: String,
    pub subscriber_id: String,
    pub sent_at: String,
    pub status: String,
    pub bounce_reason: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FeedFetch {
    Fetched { source_id: String, xml: String },
    Failed { source_id: String, message: String },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IngestionError {
    pub source_id: String,
    pub message: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedIngestionRun {
    pub source_count: usize,
    pub fetched_count: usize,
    pub failed_count: usize,
    pub errors: Vec<IngestionError>,
    pub items: Vec<NewsItem>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SourceView {
    pub id: String,
    pub title: String,
    pub url: String,
    pub homepage: String,
    pub category: String,
    pub language: String,
    pub region: String,
    pub latest_item_title: Option<String>,
    pub latest_item_url: Option<String>,
    pub latest_item_published_at: Option<String>,
    pub latest_item_fetched_at: Option<String>,
}

pub fn render_sources_fragment(sources: &[SourceView], query: &str) -> String {
    let normalized_query = query.trim().to_lowercase();
    let filtered: Vec<&SourceView> = sources
        .iter()
        .filter(|source| {
            normalized_query.is_empty()
                || [
                    source.id.as_str(),
                    source.title.as_str(),
                    source.region.as_str(),
                    source.language.as_str(),
                    source.category.as_str(),
                    source.latest_item_title.as_deref().unwrap_or(""),
                ]
                .join(" ")
                .to_lowercase()
                .contains(&normalized_query)
        })
        .collect();

    let mut html = String::new();
    html.push_str(&format!(
        r#"<section id="source-summary" class="source-summary" aria-live="polite">{} of {} active sources</section>"#,
        filtered.len(),
        sources.len()
    ));
    html.push_str(r#"<section id="source-list" class="source-list" aria-live="polite">"#);

    for source in filtered {
        html.push_str(r#"<article class="source-card">"#);
        html.push_str(r#"<div class="source-card-header">"#);
        html.push_str("<h2>");
        html.push_str(&format!(
            r#"<a href="{}" rel="noopener noreferrer">{}</a>"#,
            escape_attr(&source.homepage),
            escape_html(&source.title)
        ));
        html.push_str("</h2>");
        html.push_str(&format!(
            r#"<p class="source-meta">{} / {} / {}</p>"#,
            escape_html(&source.region),
            escape_html(&source.language),
            escape_html(&source.category)
        ));
        html.push_str("</div>");
        html.push_str(r#"<p class="source-latest">"#);

        match (&source.latest_item_title, &source.latest_item_url) {
            (Some(title), Some(url)) => {
                html.push_str("Latest: ");
                html.push_str(&format!(
                    r#"<a href="{}" rel="noopener noreferrer">{}</a>"#,
                    escape_attr(url),
                    escape_html(title)
                ));

                if let Some(date) = source_latest_date(source) {
                    html.push_str(" (");
                    html.push_str(&escape_html(date));
                    html.push(')');
                }
            }
            _ => html.push_str("Latest: none stored yet"),
        }

        html.push_str("</p>");
        html.push_str(&format!(
            r#"<p class="source-detail">{}</p>"#,
            escape_html(&source.url)
        ));
        html.push_str("</article>");
    }

    html.push_str("</section>");
    html
}

pub fn render_sources_page(fragment_endpoint: &str) -> String {
    format!(
        r##"<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <meta name="htmx-config" content='{{"selfRequestsOnly":false}}' />
    <link rel="stylesheet" href="/src/styles.css" />
    <title>Sources - Spacefaring News</title>
  </head>
  <body>
    <div class="wrap sources-wrap">
      <header class="site">
        <p><a class="brand" href="/">Spacefaring News</a></p>
      </header>

      <main>
        <p class="eyebrow">OPERATIONS</p>
        <h1>Sources</h1>

        <section class="source-controls" aria-label="Source filters">
          <label for="source-search">Search</label>
          <input
            id="source-search"
            name="q"
            type="search"
            autocomplete="off"
            hx-get="{fragment_endpoint}"
            hx-trigger="load, input changed delay:250ms from:#source-search"
            hx-target="#sources-results"
            hx-include="#source-search"
            hx-swap="innerHTML"
          />
        </section>

        <div id="sources-results">
          <section id="source-summary" class="source-summary" aria-live="polite">Loading sources.</section>
          <section id="source-list" class="source-list" aria-live="polite"></section>
        </div>
      </main>
    </div>
    <script src="/htmx.min.js"></script>
  </body>
</html>
"##,
        fragment_endpoint = escape_attr(fragment_endpoint)
    )
}

pub fn parse_feed(
    xml: &str,
    source: &FeedSource,
    fetched_at: &str,
) -> Result<Vec<NewsItem>, String> {
    let normalized_xml = normalize_prefixed_tags(xml);
    let document = roxmltree::Document::parse(&normalized_xml).map_err(|error| error.to_string())?;
    let root = document.root_element();
    let item_tag = if root.tag_name().name() == "feed" {
        "entry"
    } else {
        "item"
    };

    let items = document
        .descendants()
        .filter(|node| node.is_element() && node.tag_name().name() == item_tag)
        .filter_map(|node| parse_feed_node(node, source, fetched_at, item_tag == "entry"))
        .collect();

    Ok(items)
}

pub fn ingest_feed_documents(
    sources: &[FeedSource],
    documents: &[FeedFetch],
    fetched_at: &str,
) -> FeedIngestionRun {
    let mut items = Vec::new();
    let mut errors = Vec::new();

    for document in documents {
        match document {
            FeedFetch::Fetched { source_id, xml } => {
                if let Some(source) = sources.iter().find(|source| source.id == *source_id) {
                    match parse_feed(xml, source, fetched_at) {
                        Ok(parsed_items) => items.extend(parsed_items),
                        Err(error) => errors.push(IngestionError {
                            source_id: source_id.clone(),
                            message: error,
                        }),
                    }
                } else {
                    errors.push(IngestionError {
                        source_id: source_id.clone(),
                        message: "Unknown source".to_string(),
                    });
                }
            }
            FeedFetch::Failed { source_id, message } => errors.push(IngestionError {
                source_id: source_id.clone(),
                message: message.clone(),
            }),
        }
    }

    FeedIngestionRun {
        source_count: sources.len(),
        fetched_count: items.len(),
        failed_count: errors.len(),
        errors,
        items,
    }
}

pub fn post_to_news_item(post: &XPost, source: &XSource, fetched_at: &str) -> NewsItem {
    NewsItem {
        id: format!("x:{}", post.id),
        source_id: source.id.clone(),
        source_title: source.title.clone(),
        title: first_line(&post.text),
        url: format!("https://x.com/{}/status/{}", source.username, post.id),
        summary: Some(post.text.clone()),
        author: Some(source.title.clone()),
        published_at: post
            .created_at
            .as_deref()
            .and_then(normalize_date),
        fetched_at: fetched_at.to_string(),
        guid: Some(post.id.clone()),
    }
}

fn first_line(value: &str) -> String {
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");

    if normalized.len() > 120 {
        format!("{}...", &normalized[..117])
    } else {
        normalized
    }
}

fn normalize_prefixed_tags(xml: &str) -> String {
    xml.replace("<dc:creator", "<creator")
        .replace("</dc:creator>", "</creator>")
}

fn parse_feed_node(
    node: roxmltree::Node,
    source: &FeedSource,
    fetched_at: &str,
    is_atom: bool,
) -> Option<NewsItem> {
    let title = child_text(node, "title")?;
    let url = if is_atom {
        atom_link(node).or_else(|| child_text(node, "link"))?
    } else {
        child_text(node, "link")?
    };
    let guid = child_text(node, "guid").or_else(|| child_text(node, "id"));
    let published_at = child_text(node, "pubDate")
        .or_else(|| child_text(node, "published"))
        .or_else(|| child_text(node, "updated"))
        .and_then(|value| normalize_date(&value));
    let summary = child_text(node, "description")
        .or_else(|| child_text(node, "summary"))
        .map(|value| strip_html(&value))
        .filter(|value| !value.is_empty());
    let author = child_text(node, "creator")
        .or_else(|| child_text(node, "author"))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let stable_id = guid.as_deref().unwrap_or(&url);

    Some(NewsItem {
        id: format!("{}:{}", source.id, short_hash(stable_id)),
        source_id: source.id.clone(),
        source_title: source.title.clone(),
        title: title.trim().to_string(),
        url: url.trim().to_string(),
        summary,
        author,
        published_at,
        fetched_at: fetched_at.to_string(),
        guid,
    })
}

fn child_text(node: roxmltree::Node, tag_name: &str) -> Option<String> {
    let child = node
        .children()
        .find(|child| child.is_element() && child.tag_name().name() == tag_name)?;

    if tag_name == "author" {
        if let Some(name) = child
            .children()
            .find(|nested| nested.is_element() && nested.tag_name().name() == "name")
            .and_then(|nested| nested.text())
        {
            return Some(name.to_string());
        }
    }

    child.text().map(|value| value.to_string())
}

fn atom_link(node: roxmltree::Node) -> Option<String> {
    node.children()
        .find(|child| {
            child.is_element()
                && child.tag_name().name() == "link"
                && child.attribute("href").is_some()
                && child.attribute("rel").unwrap_or("alternate") == "alternate"
        })
        .and_then(|child| child.attribute("href"))
        .map(|value| value.to_string())
}

fn normalize_date(value: &str) -> Option<String> {
    chrono::DateTime::parse_from_rfc2822(value)
        .or_else(|_| chrono::DateTime::parse_from_rfc3339(value))
        .ok()
        .map(|date| date.to_utc().format("%Y-%m-%dT%H:%M:%S.000Z").to_string())
}

fn strip_html(value: &str) -> String {
    let mut output = String::new();
    let mut in_tag = false;

    for character in value.chars() {
        match character {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => output.push(character),
            _ => {}
        }
    }

    output.trim().to_string()
}

fn short_hash(value: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;

    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }

    format!("{hash:016x}")
}

// Email validation for newsletter subscribers
pub fn is_valid_email(email: &str) -> bool {
    // Simple but practical email validation
    // This validates the basic structure without being overly restrictive
    if email.is_empty() {
        return false;
    }
    
    // Must contain exactly one @ symbol
    let at_count = email.matches('@').count();
    if at_count != 1 {
        return false;
    }
    
    // Must not contain spaces
    if email.contains(' ') {
        return false;
    }
    
    // Split on @ and validate both parts
    let parts: Vec<&str> = email.split('@').collect();
    let local_part = parts[0];
    let domain_part = parts[1];
    
    // Both parts must be non-empty
    if local_part.is_empty() || domain_part.is_empty() {
        return false;
    }
    
    // Domain must contain at least one dot
    if !domain_part.contains('.') {
        return false;
    }
    
    // Domain cannot end with a dot
    if domain_part.ends_with('.') {
        return false;
    }
    
    // Domain cannot start with a dot
    if domain_part.starts_with('.') {
        return false;
    }
    
    // Domain cannot have consecutive dots
    if domain_part.contains("..") {
        return false;
    }
    
    // Local part and domain part must have valid characters
    // This is a simplified check - in practice, we'd use a proper email validation library
    let valid_local_chars = |c: char| -> bool {
        c.is_ascii_alphanumeric() || 
        ".!#$%&'*+/=?^_`{|}~-".contains(c)
    };
    
    if !local_part.chars().all(valid_local_chars) {
        return false;
    }
    
    let valid_domain_chars = |c: char| -> bool {
        c.is_ascii_alphanumeric() || c == '-' || c == '.'
    };
    
    if !domain_part.chars().all(valid_domain_chars) {
        return false;
    }
    
    // Must have at least one valid character after the last dot
    let last_dot_pos = domain_part.rfind('.').unwrap();
    if last_dot_pos == domain_part.len() - 1 {
        return false; // Already checked above, but being safe
    }
    
    let tld = &domain_part[last_dot_pos + 1..];
    if tld.is_empty() || !tld.chars().all(|c| c.is_ascii_alphabetic()) {
        return false;
    }
    
    true
}

// Generate a simple UUID-like string for testing purposes
pub fn generate_test_id(prefix: &str) -> String {
    format!("{}-{}", prefix, short_hash(&format!("{:?}", std::time::SystemTime::now())))
}

// Create test data for newsletter functionality
pub fn create_test_subscriber(email: &str) -> NewsletterSubscriber {
    NewsletterSubscriber {
        id: generate_test_id("sub"),
        email: email.to_string(),
        name: Some("Test User".to_string()),
        subscribed_at: "2026-01-01T00:00:00.000Z".to_string(),
        unsubscribe_token: generate_test_id("token"),
        is_active: true,
        source: "test".to_string(),
    }
}

pub fn create_test_issue(issue_number: u32) -> NewsletterIssue {
    NewsletterIssue {
        id: generate_test_id("issue"),
        issue_number,
        title: format!("Test Issue #{}", issue_number),
        content_html: "<html><body><h1>Test Content</h1></body></html>".to_string(),
        content_text: "Test Content".to_string(),
        sent_at: None,
        recipient_count: 0,
        sent_count: 0,
        bounce_count: 0,
        unsubscribe_count: 0,
        status: "draft".to_string(),
    }
}

#[no_mangle]
pub extern "C" fn subscribe_success_ptr() -> *const u8 {
    SUBSCRIBE_SUCCESS.as_ptr()
}

#[no_mangle]
pub extern "C" fn subscribe_success_len() -> usize {
    SUBSCRIBE_SUCCESS.len()
}

#[no_mangle]
pub extern "C" fn subscribe_invalid_ptr() -> *const u8 {
    SUBSCRIBE_INVALID.as_ptr()
}

#[no_mangle]
pub extern "C" fn subscribe_invalid_len() -> usize {
    SUBSCRIBE_INVALID.len()
}

#[no_mangle]
pub extern "C" fn subscribe_duplicate_ptr() -> *const u8 {
    SUBSCRIBE_DUPLICATE.as_ptr()
}

#[no_mangle]
pub extern "C" fn subscribe_duplicate_len() -> usize {
    SUBSCRIBE_DUPLICATE.len()
}

fn source_latest_date(source: &SourceView) -> Option<&str> {
    source
        .latest_item_published_at
        .as_deref()
        .or(source.latest_item_fetched_at.as_deref())
        .and_then(|value| value.get(0..10))
}

fn escape_html(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());

    for character in value.chars() {
        match character {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&#39;"),
            _ => escaped.push(character),
        }
    }

    escaped
}

fn escape_attr(value: &str) -> String {
    escape_html(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_newsletter_fragments() {
        let success = std::str::from_utf8(SUBSCRIBE_SUCCESS).expect("fragment is valid utf-8");
        let invalid = std::str::from_utf8(SUBSCRIBE_INVALID).expect("fragment is valid utf-8");
        let duplicate = std::str::from_utf8(SUBSCRIBE_DUPLICATE).expect("fragment is valid utf-8");

        assert!(success.contains("You've joined the manifest."));
        assert!(success.contains("Spacefaring News dispatch coming soon."));
        assert!(invalid.contains("Use a valid email address."));
        assert!(duplicate.contains("Already on board."));
        assert!(duplicate.contains("already subscribed to Spacefaring News"));
    }
}
