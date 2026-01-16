mod commands;
mod database;
mod image_processor;

use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::open_folder,
            commands::get_images,
            commands::generate_thumbnails,
            commands::get_thumbnail_path,
            commands::set_label,
            commands::get_label,
            commands::get_all_labels,
            commands::update_selected_index,
            commands::get_session,
            commands::load_full_image,
            commands::export_approved_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
