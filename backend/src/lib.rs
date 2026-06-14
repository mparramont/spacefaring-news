const HELLO_FRAGMENT: &[u8] = br#"<article class="brief-card" data-testid="hello-brief"><h3>Hello from Spacefaring News</h3><p>Rust rendered this briefing fragment for an htmx request on Cloudflare Pages.</p><small>@spacefaringnews</small></article>"#;

#[no_mangle]
pub extern "C" fn hello_fragment_ptr() -> *const u8 {
    HELLO_FRAGMENT.as_ptr()
}

#[no_mangle]
pub extern "C" fn hello_fragment_len() -> usize {
    HELLO_FRAGMENT.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_spacefaring_brand_and_handle() {
        let fragment = std::str::from_utf8(HELLO_FRAGMENT).expect("fragment is valid utf-8");

        assert!(fragment.contains("Spacefaring News"));
        assert!(fragment.contains("@spacefaringnews"));
    }
}
