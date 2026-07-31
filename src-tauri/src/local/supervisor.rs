use std::fs;
use std::net::TcpStream;
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::async_runtime::Receiver;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

use super::{config, port};

/// The first full compile happens before the server binds, so startup latency
/// scales with the size of the folder rather than being constant.
const READY_TIMEOUT: Duration = Duration::from_secs(120);
const PID_FILE: &str = "sidecar.pid";
const LOG_EVENT: &str = "sidecar-log";

#[derive(Default)]
pub struct Sidecar(Mutex<Option<CommandChild>>);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocalHandle {
    pub port: u16,
    pub token: String,
    pub tenant: String,
    pub store: String,
}

fn failed(error: impl std::fmt::Display) -> String {
    error.to_string()
}

/// A pid alone is not enough to kill on: the number may have been recycled by
/// an unrelated process. Requiring that the recorded port also still accepts a
/// connection makes a wrong kill far less likely, while still cleaning up the
/// orphan a hard crash leaves behind.
fn reap_orphan(data: &Path) {
    let path = data.join(PID_FILE);
    let Ok(contents) = fs::read_to_string(&path) else {
        return;
    };

    let mut parts = contents.split_whitespace();
    let pid = parts.next().and_then(|value| value.parse::<u32>().ok());
    let listening = parts
        .next()
        .and_then(|value| value.parse::<u16>().ok())
        .is_some_and(|orphan| TcpStream::connect(("127.0.0.1", orphan)).is_ok());

    if let (Some(pid), true) = (pid, listening) {
        kill(pid);
    }

    let _ = fs::remove_file(&path);
}

#[cfg(unix)]
fn kill(pid: u32) {
    let _ = std::process::Command::new("kill")
        .args(["-9", &pid.to_string()])
        .status();
}

#[cfg(windows)]
fn kill(pid: u32) {
    let _ = std::process::Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/F"])
        .status();
}

async fn wait_for_port(app: &AppHandle, rx: &mut Receiver<CommandEvent>) -> Option<u16> {
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(bytes) => {
                let line = String::from_utf8_lossy(&bytes).to_string();

                let _ = app.emit(LOG_EVENT, line.clone());

                if let Some(found) = port::parse_ready_port(&line) {
                    return Some(found);
                }
            }
            CommandEvent::Terminated(_) => return None,
            _ => {}
        }
    }

    None
}

/// Draining continues for the life of the process. A full stderr pipe would
/// block the server mid-compile, and the lines are the only channel carrying
/// watcher errors and compile progress to the window.
fn drain(app: AppHandle, mut rx: Receiver<CommandEvent>) {
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            if let CommandEvent::Stderr(bytes) = event {
                let _ = app.emit(LOG_EVENT, String::from_utf8_lossy(&bytes).to_string());
            }
        }
    });
}

pub fn stop(app: &AppHandle) {
    if let Some(child) = app
        .state::<Sidecar>()
        .0
        .lock()
        .ok()
        .and_then(|mut held| held.take())
    {
        let _ = child.kill();
    }

    if let Ok(data) = app.path().app_local_data_dir() {
        let _ = fs::remove_file(data.join(PID_FILE));
    }
}

pub async fn start(app: AppHandle, folder: String) -> Result<LocalHandle, String> {
    stop(&app);

    let data = app.path().app_local_data_dir().map_err(failed)?;

    fs::create_dir_all(&data).map_err(failed)?;
    reap_orphan(&data);

    let settings = config::prepare(&data, Path::new(&folder)).map_err(failed)?;
    let reserved = port::reserve_port().map_err(failed)?;
    let store = settings.store.to_string_lossy().to_string();
    let (mut rx, child) = app
        .shell()
        .sidecar("langonrock")
        .map_err(failed)?
        .args(["serve", "--data", &store, "--port", &reserved.to_string()])
        .spawn()
        .map_err(failed)?;

    let _ = fs::write(data.join(PID_FILE), format!("{} {}", child.pid(), reserved));

    if let Ok(mut held) = app.state::<Sidecar>().0.lock() {
        *held = Some(child);
    }

    let ready = tauri::async_runtime::spawn({
        let app = app.clone();

        async move {
            let found = tokio::time::timeout(READY_TIMEOUT, wait_for_port(&app, &mut rx)).await;

            (found, rx)
        }
    });
    let (found, rx) = ready.await.map_err(failed)?;

    drain(app.clone(), rx);

    match found {
        Err(_) => Err("the sidecar did not report a port in time".into()),
        Ok(None) => Err("the sidecar exited before it was ready".into()),
        Ok(Some(port)) => Ok(LocalHandle {
            port,
            token: settings.token,
            tenant: settings.tenant,
            store,
        }),
    }
}
