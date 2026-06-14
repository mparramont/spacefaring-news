const SUBSCRIBE_SUCCESS: &[u8] = br#"<div class="notice success blog-card" data-testid="signup-success"><strong>You've joined the manifest.</strong><span>Spacefaring News dispatch coming soon.</span></div>"#;
const SUBSCRIBE_INVALID: &[u8] = br#"<div class="notice error blog-card" data-testid="signup-error"><strong>Use a valid email address.</strong></div>"#;

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

        assert!(success.contains("You've joined the manifest."));
        assert!(success.contains("Spacefaring News dispatch coming soon."));
        assert!(invalid.contains("Use a valid email address."));
    }
}
