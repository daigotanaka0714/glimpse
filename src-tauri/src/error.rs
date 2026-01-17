use thiserror::Error;

#[derive(Error, Debug)]
pub enum GlimpseError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Image processing error: {0}")]
    Image(#[from] image::ImageError),

    #[error("RAW processing error: {0}")]
    RawProcessing(String),

    #[error("Session not found")]
    SessionNotFound,

    #[error("Invalid path: {0}")]
    InvalidPath(String),
}

impl serde::Serialize for GlimpseError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type Result<T> = std::result::Result<T, GlimpseError>;
