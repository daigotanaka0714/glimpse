pub mod commands;
pub mod config;
pub mod database;
pub mod error;
pub mod image_processor;

pub use commands::AppState;
use commands::{
    clear_all_cache, clear_all_labels, clear_cache, export_adopted, get_exif, get_storage_info,
    get_system_info, open_folder, save_selection, set_label, set_thread_count,
};

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
            get_exif,
            clear_cache,
            get_system_info,
            set_thread_count,
            get_storage_info,
            clear_all_cache,
            clear_all_labels,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
