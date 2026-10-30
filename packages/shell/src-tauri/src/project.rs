use sha1::{Digest, Sha1};
use std::fmt::Write;
use std::path::{Path, PathBuf};

pub fn resolve_project_path(arg: Option<String>) -> PathBuf {
    let raw = arg
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    let absolute = raw.canonicalize().unwrap_or(raw);
    let root = find_project_root(&absolute);
    normalize_path(root)
}

fn find_project_root(start: &Path) -> PathBuf {
    start
        .ancestors()
        .find(|ancestor| ancestor.join(".opencode").exists())
        .map(Path::to_path_buf)
        .unwrap_or_else(|| start.to_path_buf())
}

fn normalize_path(path: PathBuf) -> PathBuf {
    let text = path.to_string_lossy();
    let normalized = text.strip_prefix(r"\\?\").unwrap_or(&text).to_string();
    PathBuf::from(normalized)
}

pub fn project_id(path: &Path) -> String {
    let mut hasher = Sha1::new();
    hasher.update(path.to_string_lossy().as_bytes());
    let digest = hasher.finalize();
    let mut hex = String::with_capacity(40);
    for byte in digest {
        let _ = write!(hex, "{byte:02x}");
    }
    hex[..12].to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn project_id_matches_node_sha1_prefix() {
        let id = project_id(Path::new("C:\\projects\\demo"));
        assert_eq!(id, "aef79c9216fd");
    }

    #[test]
    fn finds_nearest_opencode_root() {
        let base = std::env::temp_dir().join(format!("agv-project-{}", std::process::id()));
        let nested = base.join("packages").join("app");
        fs::create_dir_all(base.join(".opencode")).unwrap();
        fs::create_dir_all(&nested).unwrap();

        assert_eq!(find_project_root(&nested), base);

        let _ = fs::remove_dir_all(&base);
    }
}
