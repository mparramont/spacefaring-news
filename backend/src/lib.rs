const SUBSCRIBE_SUCCESS: &[u8] = br#"<div class="notice success blog-card" data-testid="signup-success"><strong>You've joined the manifest.</strong><span>Spacefaring News dispatch coming soon.</span></div>"#;
const SUBSCRIBE_INVALID: &[u8] = br#"<div class="notice error blog-card" data-testid="signup-error"><strong>Use a valid email address.</strong></div>"#;

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
        let success = std::str::from_utf8(SUBSCRIBE_SUCCESS).expect("fragment is valid utf-8");
        let invalid = std::str::from_utf8(SUBSCRIBE_INVALID).expect("fragment is valid utf-8");

        assert!(success.contains("You've joined the manifest."));
        assert!(success.contains("Spacefaring News dispatch coming soon."));
        assert!(invalid.contains("Use a valid email address."));
    }
}
