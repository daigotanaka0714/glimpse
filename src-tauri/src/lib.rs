pub mod commands;
pub mod database;
pub mod error;
pub mod image_processor;

pub use commands::AppState;
use commands::{export_adopted, open_folder, save_selection, set_label};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::new().expect("Failed to initialize app state"))
        .invoke_handler(tauri::generate_handler![
            open_folder,
            set_label,
            save_selection,
            export_adopted,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
