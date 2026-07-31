use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::local::supervisor::{self, LocalHandle};
use crate::secrets;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickedFile {
    pub name: String,
    pub bytes: Vec<u8>,
}

#[tauri::command]
pub async fn local_start(app: AppHandle, folder: String) -> Result<LocalHandle, String> {
    supervisor::start(app, folder).await
}

#[tauri::command]
pub fn local_stop(app: AppHandle) {
    supervisor::stop(&app);
}

#[tauri::command]
pub async fn pick_folder(app: AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|picked| picked.into_path().ok())
        .map(|path| path.to_string_lossy().to_string())
}

/// The dialog and the read happen in one call, so the app only ever touches a
/// path the user just chose in that same gesture. That is both simpler than
/// managing a filesystem scope and harder to get wrong.
#[tauri::command]
pub async fn pick_and_read(
    app: AppHandle,
    extensions: Vec<String>,
) -> Result<Option<PickedFile>, String> {
    let borrowed: Vec<&str> = extensions.iter().map(String::as_str).collect();
    let Some(picked) = app
        .dialog()
        .file()
        .add_filter("supported", &borrowed)
        .blocking_pick_file()
    else {
        return Ok(None);
    };

    let path = picked.into_path().map_err(|error| error.to_string())?;
    let name = path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_default();
    let bytes = std::fs::read(&path).map_err(|error| error.to_string())?;

    Ok(Some(PickedFile { name, bytes }))
}

#[tauri::command]
pub async fn pick_and_write(app: AppHandle, name: String, bytes: Vec<u8>) -> Result<bool, String> {
    let Some(picked) = app
        .dialog()
        .file()
        .set_file_name(&name)
        .blocking_save_file()
    else {
        return Ok(false);
    };

    let path = picked.into_path().map_err(|error| error.to_string())?;

    std::fs::write(path, bytes).map_err(|error| error.to_string())?;

    Ok(true)
}

#[tauri::command]
pub fn secret_save(account: String, secret: String) -> Result<(), String> {
    secrets::save(&account, &secret)
}

#[tauri::command]
pub fn secret_load(account: String) -> Result<Option<String>, String> {
    secrets::load(&account)
}

#[tauri::command]
pub fn secret_delete(account: String) -> Result<(), String> {
    secrets::delete(&account)
}

#[tauri::command]
pub fn secret_available() -> bool {
    secrets::available()
}
