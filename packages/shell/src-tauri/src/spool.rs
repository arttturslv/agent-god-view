use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpoolLinePayload {
    pub project_id: String,
    pub line: String,
    pub offset: u64,
}

pub struct SpoolWatcher {
    _watcher: RecommendedWatcher,
}

struct TailState {
    offset: u64,
    buffer_start: u64,
    buffer: Vec<u8>,
}

impl TailState {
    fn from_file(path: &Path) -> Self {
        let content = fs::read(path).unwrap_or_default();
        let buffer_start = content
            .iter()
            .rposition(|byte| *byte == b'\n')
            .map(|position| position as u64 + 1)
            .unwrap_or(0);
        let buffer = content
            .get(buffer_start as usize..)
            .map(|slice| slice.to_vec())
            .unwrap_or_default();

        Self {
            offset: content.len() as u64,
            buffer_start,
            buffer,
        }
    }

    fn reset(&mut self) {
        self.offset = 0;
        self.buffer_start = 0;
        self.buffer.clear();
    }

    fn consume(&mut self) -> Vec<(u64, String)> {
        let mut lines = Vec::new();
        let mut consumed = 0usize;

        while let Some(position) = self.buffer[consumed..]
            .iter()
            .position(|byte| *byte == b'\n')
        {
            let end = consumed + position;
            let line_offset = self.buffer_start + consumed as u64;
            let line = String::from_utf8_lossy(&self.buffer[consumed..end])
                .trim_end_matches('\r')
                .to_string();
            if !line.is_empty() {
                lines.push((line_offset, line));
            }
            consumed = end + 1;
        }

        if consumed > 0 {
            self.buffer.drain(..consumed);
            self.buffer_start += consumed as u64;
        }

        lines
    }
}

pub fn spool_directory() -> PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        if !appdata.trim().is_empty() {
            return PathBuf::from(appdata)
                .join("agent-god-view")
                .join("spool");
        }
    }

    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home)
        .join(".agent-god-view")
        .join("spool")
}

pub fn is_valid_project_id(project_id: &str) -> bool {
    !project_id.is_empty()
        && project_id.len() <= 64
        && project_id.chars().all(|character| character.is_ascii_hexdigit())
}

pub fn spool_file(project_id: &str) -> Result<PathBuf, String> {
    if !is_valid_project_id(project_id) {
        return Err("invalid project id".to_string());
    }
    Ok(spool_directory().join(format!("{project_id}.ndjson")))
}

pub fn read_snapshot(project_id: &str) -> Result<String, String> {
    let path = spool_file(project_id)?;
    match fs::read_to_string(&path) {
        Ok(content) => Ok(content),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(error) => Err(error.to_string()),
    }
}

pub fn start(app: AppHandle, project_id: String) -> Result<SpoolWatcher, String> {
    let path = spool_file(&project_id)?;
    let directory = path
        .parent()
        .ok_or_else(|| "invalid spool path".to_string())?
        .to_path_buf();
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;

    let tail = Arc::new(Mutex::new(TailState::from_file(&path)));
    let watched_path = path.clone();
    let watched_project_id = project_id.clone();
    let watched_tail = Arc::clone(&tail);

    let mut watcher = notify::recommended_watcher(
        move |result: notify::Result<notify::Event>| {
            let Ok(event) = result else {
                return;
            };
            let watched_name = watched_path.file_name();
            if !event
                .paths
                .iter()
                .any(|event_path| event_path.file_name() == watched_name)
            {
                return;
            }
            read_new_lines(&app, &watched_project_id, &watched_path, &watched_tail);
        },
    )
    .map_err(|error| error.to_string())?;

    watcher
        .watch(&directory, RecursiveMode::NonRecursive)
        .map_err(|error| error.to_string())?;

    Ok(SpoolWatcher { _watcher: watcher })
}

fn read_new_lines(
    app: &AppHandle,
    project_id: &str,
    path: &Path,
    tail: &Arc<Mutex<TailState>>,
) {
    let size = match fs::metadata(path) {
        Ok(metadata) => metadata.len(),
        Err(_) => return,
    };

    let mut state = match tail.lock() {
        Ok(state) => state,
        Err(_) => return,
    };

    if size < state.offset {
        state.reset();
    }
    if size == state.offset {
        return;
    }

    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(_) => return,
    };
    if file.seek(SeekFrom::Start(state.offset)).is_err() {
        return;
    }

    let mut chunk = Vec::new();
    if file.read_to_end(&mut chunk).is_err() {
        return;
    }

    state.offset += chunk.len() as u64;
    state.buffer.extend_from_slice(&chunk);

    for (offset, line) in state.consume() {
        let _ = app.emit(
            "spool-line",
            SpoolLinePayload {
                project_id: project_id.to_string(),
                line,
                offset,
            },
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_path_traversal_project_ids() {
        assert!(spool_file("../escape").is_err());
        assert!(spool_file("C:\\absolute").is_err());
        assert!(spool_file("").is_err());
    }

    #[test]
    fn accepts_hex_project_ids() {
        assert!(is_valid_project_id("abcdef123456"));
        assert!(!is_valid_project_id("not-hex"));
    }

    #[test]
    fn keeps_partial_lines_for_the_next_append() {
        let mut tail = TailState {
            offset: 8,
            buffer_start: 0,
            buffer: b"{\"a\":1}\n{\"b\":2".to_vec(),
        };

        let lines = tail.consume();

        assert_eq!(lines, vec![(0, "{\"a\":1}".to_string())]);
        assert_eq!(tail.buffer_start, 8);
        assert_eq!(tail.buffer, b"{\"b\":2".to_vec());
    }

    #[test]
    fn strips_carriage_returns_and_skips_empty_lines() {
        let mut tail = TailState {
            offset: 0,
            buffer_start: 0,
            buffer: b"one\r\n\r\ntwo\n".to_vec(),
        };

        let lines = tail.consume();

        assert_eq!(
            lines,
            vec![(0, "one".to_string()), (7, "two".to_string())]
        );
        assert!(tail.buffer.is_empty());
    }
}
