use keyring::Entry;

const SERVICE: &str = "com.breim.langoneditor";
const PROBE: &str = "__availability_probe__";

fn entry(account: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, account).map_err(|error| error.to_string())
}

pub fn save(account: &str, secret: &str) -> Result<(), String> {
    entry(account)?
        .set_password(secret)
        .map_err(|error| error.to_string())
}

/// A missing entry is a normal outcome, not a failure: it is what a profile
/// whose token was never saved looks like.
pub fn load(account: &str) -> Result<Option<String>, String> {
    match entry(account)?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

pub fn delete(account: &str) -> Result<(), String> {
    match entry(account)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

/// Linux needs a running Secret Service, and headless boxes, minimal window
/// managers and some AppImage sandboxes have none. Probing lets the app fall
/// back to asking for the token each launch instead of appearing to save it and
/// silently losing it.
pub fn available() -> bool {
    let Ok(probe) = entry(PROBE) else {
        return false;
    };

    if probe.set_password("probe").is_err() {
        return false;
    }

    let readable = probe.get_password().is_ok();

    let _ = probe.delete_credential();

    readable
}
