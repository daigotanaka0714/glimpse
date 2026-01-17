use crate::error::{GlimpseError, Result};
use rusqlite::{params, Connection};
use std::path::PathBuf;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new() -> Result<Self> {
        let db_path = Self::get_db_path()?;

        // ディレクトリが存在しない場合は作成
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&db_path)?;
        let db = Self { conn };
        db.init_schema()?;
        Ok(db)
    }

    fn get_db_path() -> Result<PathBuf> {
        let data_dir = dirs::data_dir()
            .ok_or_else(|| GlimpseError::InvalidPath("Cannot find data directory".into()))?;
        Ok(data_dir.join("Glimpse").join("glimpse.db"))
    }

    fn init_schema(&self) -> Result<()> {
        self.conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                folder_path TEXT NOT NULL,
                last_opened DATETIME,
                last_selected_index INTEGER DEFAULT 0,
                total_files INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS labels (
                session_id TEXT,
                filename TEXT,
                label TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (session_id, filename),
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );

            CREATE TABLE IF NOT EXISTS thumbnail_cache (
                session_id TEXT,
                filename TEXT,
                cache_path TEXT,
                original_modified DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (session_id, filename),
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );

            CREATE INDEX IF NOT EXISTS idx_labels_session ON labels(session_id);
            CREATE INDEX IF NOT EXISTS idx_thumbnail_cache_session ON thumbnail_cache(session_id);
            "#,
        )?;
        Ok(())
    }

    // セッション操作
    pub fn get_session(&self, session_id: &str) -> Result<Option<Session>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, folder_path, last_opened, last_selected_index, total_files 
             FROM sessions WHERE id = ?1",
        )?;

        let session = stmt
            .query_row(params![session_id], |row| {
                Ok(Session {
                    id: row.get(0)?,
                    folder_path: row.get(1)?,
                    last_opened: row.get(2)?,
                    last_selected_index: row.get(3)?,
                    total_files: row.get(4)?,
                })
            })
            .optional()?;

        Ok(session)
    }

    pub fn upsert_session(&self, session: &Session) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT INTO sessions (id, folder_path, last_opened, last_selected_index, total_files)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(id) DO UPDATE SET
                last_opened = excluded.last_opened,
                last_selected_index = excluded.last_selected_index,
                total_files = excluded.total_files
            "#,
            params![
                session.id,
                session.folder_path,
                session.last_opened,
                session.last_selected_index,
                session.total_files
            ],
        )?;
        Ok(())
    }

    pub fn update_last_selected(&self, session_id: &str, index: i32) -> Result<()> {
        self.conn.execute(
            "UPDATE sessions SET last_selected_index = ?1, last_opened = datetime('now') WHERE id = ?2",
            params![index, session_id],
        )?;
        Ok(())
    }

    // ラベル操作
    pub fn get_labels(&self, session_id: &str) -> Result<Vec<Label>> {
        let mut stmt = self
            .conn
            .prepare("SELECT filename, label FROM labels WHERE session_id = ?1")?;

        let labels = stmt
            .query_map(params![session_id], |row| {
                Ok(Label {
                    filename: row.get(0)?,
                    label: row.get(1)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(labels)
    }

    pub fn set_label(&self, session_id: &str, filename: &str, label: Option<&str>) -> Result<()> {
        if let Some(label_value) = label {
            self.conn.execute(
                r#"
                INSERT INTO labels (session_id, filename, label, updated_at)
                VALUES (?1, ?2, ?3, datetime('now'))
                ON CONFLICT(session_id, filename) DO UPDATE SET
                    label = excluded.label,
                    updated_at = excluded.updated_at
                "#,
                params![session_id, filename, label_value],
            )?;
        } else {
            self.conn.execute(
                "DELETE FROM labels WHERE session_id = ?1 AND filename = ?2",
                params![session_id, filename],
            )?;
        }
        Ok(())
    }

    // サムネイルキャッシュ操作
    pub fn get_thumbnail_cache(&self, session_id: &str, filename: &str) -> Result<Option<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT cache_path FROM thumbnail_cache WHERE session_id = ?1 AND filename = ?2",
        )?;

        let cache_path = stmt
            .query_row(params![session_id, filename], |row| row.get(0))
            .optional()?;

        Ok(cache_path)
    }

    pub fn set_thumbnail_cache(
        &self,
        session_id: &str,
        filename: &str,
        cache_path: &str,
        original_modified: &str,
    ) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT INTO thumbnail_cache (session_id, filename, cache_path, original_modified)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(session_id, filename) DO UPDATE SET
                cache_path = excluded.cache_path,
                original_modified = excluded.original_modified
            "#,
            params![session_id, filename, cache_path, original_modified],
        )?;
        Ok(())
    }
}

// rusqlite Optional trait workaround
trait Optional<T> {
    fn optional(self) -> std::result::Result<Option<T>, rusqlite::Error>;
}

impl<T> Optional<T> for std::result::Result<T, rusqlite::Error> {
    fn optional(self) -> std::result::Result<Option<T>, rusqlite::Error> {
        match self {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Session {
    pub id: String,
    pub folder_path: String,
    pub last_opened: Option<String>,
    pub last_selected_index: i32,
    pub total_files: i32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Label {
    pub filename: String,
    pub label: Option<String>,
}
