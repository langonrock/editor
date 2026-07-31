use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use rand::RngCore;
use sha2::{Digest, Sha256};

/// A tenant id must match `^[a-z0-9][a-z0-9_-]{0,63}$`, and a folder path
/// matches nothing of the sort. Hashing it gives a legal id that is stable for
/// a given folder, so returning to a folder reuses the snapshots already
/// compiled for it instead of starting from nothing.
pub fn tenant_id(folder: &Path) -> String {
    let mut hasher = Sha256::new();

    hasher.update(folder.to_string_lossy().as_bytes());

    let hex: String = hasher
        .finalize()
        .iter()
        .take(8)
        .map(|byte| format!("{byte:02x}"))
        .collect();

    format!("f{hex}")
}

pub fn generate_token() -> String {
    let mut bytes = [0u8; 32];

    rand::thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// The token grants write access over loopback TCP, so the file holding it is
/// readable only by its owner. On Windows the containing directory under
/// LOCALAPPDATA already restricts access, and there is no mode to set.
fn write_private(path: &Path, contents: &str) -> io::Result<()> {
    fs::write(path, contents)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }

    Ok(())
}

pub struct LocalConfig {
    pub store: PathBuf,
    pub tenant: String,
    pub token: String,
}

/// Writes into a store this app owns, never into the user's own langonrock
/// data directory: adding our token there would make their store writable over
/// TCP, would not take effect in a server they already have running, and would
/// overwrite a file they maintain.
///
/// Exactly one tenant is registered. `langonrock serve` starts a watcher for
/// every entry in sources.json and a stale one takes the process down before it
/// binds, so switching folders rewrites this file and restarts the sidecar.
pub fn prepare(app_data: &Path, folder: &Path) -> io::Result<LocalConfig> {
    let store = app_data.join("store");

    fs::create_dir_all(&store)?;

    let tenant = tenant_id(folder);
    let token = generate_token();
    let grant = serde_json::json!({ &token: { "tenant": &tenant, "write": true } });
    let source = serde_json::json!({ &tenant: folder.to_string_lossy() });

    write_private(&store.join("tokens.json"), &grant.to_string())?;
    write_private(&store.join("sources.json"), &source.to_string())?;

    Ok(LocalConfig {
        store,
        tenant,
        token,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn is_legal_tenant(id: &str) -> bool {
        let mut chars = id.chars();

        matches!(chars.next(), Some(c) if c.is_ascii_alphanumeric())
            && id.len() <= 64
            && !id.is_empty()
            && chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    }

    #[test]
    fn tenant_id_is_legal_for_pathological_folders() {
        let cases = [
            "/Users/me/My Knowledge Base",
            "/tmp/../etc",
            "/Users/me/Área de Trabalho/ünïcode 😀",
            "C:\\Users\\me\\docs",
            "/",
            &"/very/long".repeat(80),
        ];

        for case in cases {
            let id = tenant_id(Path::new(case));

            assert!(is_legal_tenant(&id), "{case} produced {id}");
        }
    }

    #[test]
    fn tenant_id_is_stable_and_distinguishes_folders() {
        let a = tenant_id(Path::new("/a"));

        assert_eq!(a, tenant_id(Path::new("/a")));
        assert_ne!(a, tenant_id(Path::new("/b")));
    }

    #[test]
    fn token_is_thirty_two_random_bytes_in_hex() {
        let token = generate_token();

        assert_eq!(token.len(), 64);
        assert!(token.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(token, generate_token());
    }
}
