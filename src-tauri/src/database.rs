use chrono::{DateTime, Utc};
use rusqlite::{Connection, Result as SqliteResult, params};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::path::Path;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub folder_path: String,
    pub last_opened: Option<String>,
    pub last_selected_index: i32,
    pub total_files: i32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Label {
    pub session_id: String,
    pub filename: String,
    pub label: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThumbnailCacheEntry {
    pub session_id: String,
    pub filename: String,
    pub cache_path: String,
    pub original_modified: String,
    pub created_at: String,
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &Path) -> SqliteResult<Self> {
        let conn = Connection::open(db_path)?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.initialize()?;
        Ok(db)
    }

    fn initialize(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                folder_path TEXT NOT NULL,
                last_opened DATETIME,
                last_selected_index INTEGER DEFAULT 0,
                total_files INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS labels (
                session_id TEXT,
                filename TEXT,
                label TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (session_id, filename),
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS thumbnail_cache (
                session_id TEXT,
                filename TEXT,
                cache_path TEXT,
                original_modified DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (session_id, filename),
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )",
            [],
        )?;

        Ok(())
    }

    pub fn generate_session_id(folder_path: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(folder_path.as_bytes());
        let result = hasher.finalize();
        hex::encode(&result[..16])
    }

    pub fn get_or_create_session(&self, folder_path: &str, total_files: i32) -> SqliteResult<Session> {
        let session_id = Self::generate_session_id(folder_path);
        let conn = self.conn.lock().unwrap();

        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO sessions (id, folder_path, last_opened, total_files, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET last_opened = ?3, total_files = ?4",
            params![session_id, folder_path, now, total_files, now],
        )?;

        let mut stmt = conn.prepare(
            "SELECT id, folder_path, last_opened, last_selected_index, total_files, created_at
             FROM sessions WHERE id = ?1"
        )?;

        let session = stmt.query_row([&session_id], |row| {
            Ok(Session {
                id: row.get(0)?,
                folder_path: row.get(1)?,
                last_opened: row.get(2)?,
                last_selected_index: row.get(3)?,
                total_files: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;

        Ok(session)
    }

    pub fn update_last_selected_index(&self, session_id: &str, index: i32) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE sessions SET last_selected_index = ?1, last_opened = ?2 WHERE id = ?3",
            params![index, Utc::now().to_rfc3339(), session_id],
        )?;
        Ok(())
    }

    pub fn set_label(&self, session_id: &str, filename: &str, label: Option<&str>) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO labels (session_id, filename, label, updated_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(session_id, filename) DO UPDATE SET label = ?3, updated_at = ?4",
            params![session_id, filename, label, now],
        )?;
        Ok(())
    }

    pub fn get_label(&self, session_id: &str, filename: &str) -> SqliteResult<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT label FROM labels WHERE session_id = ?1 AND filename = ?2"
        )?;

        let result = stmt.query_row(params![session_id, filename], |row| {
            row.get::<_, Option<String>>(0)
        });

        match result {
            Ok(label) => Ok(label),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn get_all_labels(&self, session_id: &str) -> SqliteResult<Vec<Label>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT session_id, filename, label, updated_at FROM labels WHERE session_id = ?1"
        )?;

        let labels = stmt.query_map([session_id], |row| {
            Ok(Label {
                session_id: row.get(0)?,
                filename: row.get(1)?,
                label: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;

        labels.collect()
    }

    pub fn get_rejected_filenames(&self, session_id: &str) -> SqliteResult<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT filename FROM labels WHERE session_id = ?1 AND label = 'rejected'"
        )?;

        let filenames = stmt.query_map([session_id], |row| row.get(0))?;
        filenames.collect()
    }

    pub fn set_thumbnail_cache(&self, session_id: &str, filename: &str, cache_path: &str, original_modified: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO thumbnail_cache (session_id, filename, cache_path, original_modified, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(session_id, filename) DO UPDATE SET cache_path = ?3, original_modified = ?4",
            params![session_id, filename, cache_path, original_modified, now],
        )?;
        Ok(())
    }

    pub fn get_thumbnail_cache(&self, session_id: &str, filename: &str) -> SqliteResult<Option<ThumbnailCacheEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT session_id, filename, cache_path, original_modified, created_at
             FROM thumbnail_cache WHERE session_id = ?1 AND filename = ?2"
        )?;

        let result = stmt.query_row(params![session_id, filename], |row| {
            Ok(ThumbnailCacheEntry {
                session_id: row.get(0)?,
                filename: row.get(1)?,
                cache_path: row.get(2)?,
                original_modified: row.get(3)?,
                created_at: row.get(4)?,
            })
        });

        match result {
            Ok(entry) => Ok(Some(entry)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn get_session(&self, session_id: &str) -> SqliteResult<Option<Session>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, folder_path, last_opened, last_selected_index, total_files, created_at
             FROM sessions WHERE id = ?1"
        )?;

        let result = stmt.query_row([session_id], |row| {
            Ok(Session {
                id: row.get(0)?,
                folder_path: row.get(1)?,
                last_opened: row.get(2)?,
                last_selected_index: row.get(3)?,
                total_files: row.get(4)?,
                created_at: row.get(5)?,
            })
        });

        match result {
            Ok(session) => Ok(Some(session)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}
