use std::io;
use std::net::TcpListener;

const MARKER: &str = "on 127.0.0.1:";

/// Binding and immediately dropping leaves a small window in which something
/// else could take the port. That is deliberate: passing an explicit port makes
/// the failure a loud bind error we can retry, whereas `--port 0` would make
/// the server's human-readable log line the only source of truth for which port
/// it actually chose.
pub fn reserve_port() -> io::Result<u16> {
    let listener = TcpListener::bind("127.0.0.1:0")?;

    listener.local_addr().map(|address| address.port())
}

/// The line langonrock prints once it is listening. It is also the readiness
/// signal, because the first full compile happens before the bind.
pub fn parse_ready_port(line: &str) -> Option<u16> {
    let digits: String = line
        .split(MARKER)
        .nth(1)?
        .chars()
        .take_while(char::is_ascii_digit)
        .collect();

    digits.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_port_out_of_the_ready_line() {
        let line = "langonrock serving /data on 127.0.0.1:54321 (1 token, 1 writable tenant)";

        assert_eq!(parse_ready_port(line), Some(54321));
    }

    #[test]
    fn ignores_every_other_line_the_server_prints() {
        let lines = [
            "watching /src for tenant acme",
            "langonrock serving /data on /tmp/langonrock.sock (0 tokens, 1 writable tenant)",
            "3 concepts, 534 bytes, ~134 tokens",
            "warn: tables/orders.md: unresolved link \"./payments.md\"",
            "",
        ];

        for line in lines {
            assert_eq!(parse_ready_port(line), None, "{line}");
        }
    }

    #[test]
    fn refuses_a_port_that_cannot_fit_in_a_u16() {
        assert_eq!(parse_ready_port("on 127.0.0.1:99999 (x)"), None);
    }

    #[test]
    fn reserve_port_returns_a_usable_port() {
        let port = reserve_port().expect("a free loopback port");

        assert!(port > 0);
        assert!(TcpListener::bind(("127.0.0.1", port)).is_ok());
    }
}
