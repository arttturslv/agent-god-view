mod agents;
mod project;
mod spool;

use std::sync::Mutex;
use tauri::{
    AppHandle, Manager, State, UserAttentionType, WebviewUrl, WebviewWindowBuilder,
};

struct ProjectState {
    project_id: String,
    project_path: std::path::PathBuf,
}

struct SpoolState {
    _watcher: Mutex<Option<spool::SpoolWatcher>>,
}

#[tauri::command]
fn get_project_info(state: State<'_, ProjectState>) -> agents::ProjectInfo {
    agents::read_project(&state.project_path, &state.project_id)
}

#[tauri::command]
fn get_snapshot(project_id: String) -> Result<String, String> {
    spool::read_snapshot(&project_id)
}

#[tauri::command]
fn open_pip(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("pip") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(&app, "pip", WebviewUrl::App("index.html".into()))
        .title("Agent God View - PiP")
        .inner_size(320.0, 200.0)
        .min_inner_size(220.0, 140.0)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(true)
        .visible(false)
        .build()
        .map_err(|error| error.to_string())?;

    use tauri_plugin_window_state::{StateFlags, WindowExt};
    let _ = window.restore_state(StateFlags::POSITION | StateFlags::SIZE);
    let _ = window.show();

    Ok(())
}

#[tauri::command]
fn notify_permission(app: AppHandle, agent_name: String, what: String) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    let _ = app.notification().request_permission();
    app.notification()
        .builder()
        .title("Agent God View")
        .body(format!("{agent_name} requests permission: {what}"))
        .show()
        .map_err(|error| error.to_string())?;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.request_user_attention(Some(UserAttentionType::Informational));
    }

    Ok(())
}

#[tauri::command]
fn clear_permission_attention(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window
            .request_user_attention(None)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn project_arg() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    let mut index = 1usize;
    while index < args.len() {
        if args[index] == "--project" {
            return args.get(index + 1).cloned();
        }
        if let Some(value) = args[index].strip_prefix("--project=") {
            return Some(value.to_string());
        }
        index += 1;
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let project_path = project::resolve_project_path(project_arg());
    let project_id = project::project_id(&project_path);
    let state = ProjectState {
        project_id: project_id.clone(),
        project_path,
    };

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(
            |app, _args, _cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            },
        ));
    }

    builder
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::SIZE,
                )
                .build(),
        )
        .manage(state)
        .on_window_event(|window, event| {
            if window.label() != "pip" {
                return;
            }
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                use tauri_plugin_window_state::{AppHandleExt, StateFlags};
                let _ = window.app_handle().save_window_state(
                    StateFlags::POSITION | StateFlags::SIZE,
                );
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_project_info,
            get_snapshot,
            open_pip,
            notify_permission,
            clear_permission_attention
        ])
        .setup(move |app| {
            let watcher = match spool::start(app.handle().clone(), project_id) {
                Ok(watcher) => Some(watcher),
                Err(error) => {
                    eprintln!("[agent-god-view] failed to watch spool: {error}");
                    None
                }
            };
            let _ = app.manage(SpoolState {
                _watcher: Mutex::new(watcher),
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running agent-god-view shell");
}
