#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use glimpse_lib::commands::{export_adopted, open_folder, save_selection, set_label, AppState};

fn main() {
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
