const LATEST_ISSUE: &[u8] = br#"<article class="issue-card blog-card" data-testid="latest-issue"><p class="tagline">Latest issue</p><h3>Orbital industry, lunar logistics, and deep-space signals</h3><p>A short-form editorial briefing for readers tracking the spacefaring economy without the mission-control noise.</p><small>@spacefaringnews</small></article>"#;
const SUBSCRIBE_SUCCESS: &[u8] = br#"<div class="notice success blog-card" data-testid="signup-success"><strong>You are on the list.</strong><span>The first Spacefaring News dispatch will find you when launch cadence begins.</span></div>"#;
const SUBSCRIBE_INVALID: &[u8] = br#"<div class="notice error blog-card" data-testid="signup-error"><strong>Check that email.</strong><span>Use a valid address so the newsletter has somewhere to land.</span></div>"#;

#[no_mangle]
pub extern "C" fn latest_issue_ptr() -> *const u8 {
    LATEST_ISSUE.as_ptr()
}

#[no_mangle]
pub extern "C" fn latest_issue_len() -> usize {
    LATEST_ISSUE.len()
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_newsletter_fragments() {
        let latest = std::str::from_utf8(LATEST_ISSUE).expect("fragment is valid utf-8");
        let success = std::str::from_utf8(SUBSCRIBE_SUCCESS).expect("fragment is valid utf-8");
        let invalid = std::str::from_utf8(SUBSCRIBE_INVALID).expect("fragment is valid utf-8");

        assert!(latest.contains("@spacefaringnews"));
        assert!(success.contains("Spacefaring News"));
        assert!(invalid.contains("valid address"));
    }
}
