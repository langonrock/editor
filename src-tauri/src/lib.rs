mod commands;
mod local;
mod secrets;

use local::supervisor::Sidecar;
use tauri::{Manager, RunEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Sidecar::default())
        .invoke_handler(tauri::generate_handler![
            commands::local_start,
            commands::local_stop,
            commands::pick_folder,
            commands::pick_and_read,
            commands::pick_and_write,
            commands::secret_save,
            commands::secret_load,
            commands::secret_delete,
            commands::secret_available
        ]);

    // Two windows would rewrite the same tokens.json and fight over the pid
    // file, and the second one's reap would kill the first one's sidecar.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.set_focus();
        }
    }));

    builder
        .build(tauri::generate_context!())
        .expect("error while building the application")
        .run(|app, event| {
            // The shell plugin is not relied on to reap the child. An orphaned
            // watcher would keep holding the user's folder after the window is
            // gone, which is worse than an extra kill that does nothing.
            if matches!(event, RunEvent::Exit) {
                local::supervisor::stop(app);
            }
        });
}
