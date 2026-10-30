use serde::Serialize;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentDef {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub project_id: String,
    pub name: String,
    pub path: String,
    pub agents: Vec<AgentDef>,
}

pub fn read_project(project_path: &Path, project_id: &str) -> ProjectInfo {
    let name = project_path
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| project_path.display().to_string());

    let mut agents = BTreeMap::new();
    if let Some(opencode_dir) = find_opencode_dir(project_path) {
        for subdirectory in ["agent", "agents"] {
            collect_agents(&opencode_dir.join(subdirectory), &mut agents);
        }
    }

    ProjectInfo {
        project_id: project_id.to_string(),
        name,
        path: project_path.display().to_string(),
        agents: agents.into_values().collect(),
    }
}

fn find_opencode_dir(start: &Path) -> Option<PathBuf> {
    start
        .ancestors()
        .map(|ancestor| ancestor.join(".opencode"))
        .find(|candidate| candidate.is_dir())
}

fn collect_agents(directory: &Path, agents: &mut BTreeMap<String, AgentDef>) {
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        if path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("md"))
            != Some(true)
        {
            continue;
        }

        let Some(id) = path
            .file_stem()
            .and_then(|value| value.to_str())
            .filter(|value| !value.is_empty())
            .map(str::to_string)
        else {
            continue;
        };

        let content = fs::read_to_string(&path).unwrap_or_default();
        let fields = parse_frontmatter(&content);
        let agent_name = field(&fields, "name").unwrap_or(id.as_str()).to_string();
        let description = field(&fields, "description").map(str::to_string);
        let model = field(&fields, "model").map(str::to_string);

        agents.insert(
            id.clone(),
            AgentDef {
                id,
                name: agent_name,
                description,
                model,
            },
        );
    }
}

fn parse_frontmatter(content: &str) -> Vec<(String, String)> {
    let mut lines = content.lines();
    if lines.next().map(str::trim_end) != Some("---") {
        return Vec::new();
    }

    let mut fields = Vec::new();
    for line in lines {
        let trimmed = line.trim_end();
        if trimmed == "---" {
            break;
        }
        let Some((key, value)) = trimmed.split_once(':') else {
            continue;
        };
        let key = key.trim();
        if key.is_empty() {
            continue;
        }
        let mut value = value.trim().to_string();
        if value.len() >= 2 {
            let quoted = (value.starts_with('"') && value.ends_with('"'))
                || (value.starts_with('\'') && value.ends_with('\''));
            if quoted {
                value = value[1..value.len() - 1].to_string();
            }
        }
        if !value.is_empty() {
            fields.push((key.to_string(), value));
        }
    }
    fields
}

fn field<'a>(fields: &'a [(String, String)], key: &str) -> Option<&'a str> {
    fields
        .iter()
        .find(|(field_key, _)| field_key.as_str() == key)
        .map(|(_, value)| value.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_frontmatter_values() {
        let fields = parse_frontmatter("---\nname: Coder\ndescription: \"Writes code\"\n---\nbody");
        assert_eq!(field(&fields, "name"), Some("Coder"));
        assert_eq!(field(&fields, "description"), Some("Writes code"));
    }

    #[test]
    fn ignores_missing_frontmatter() {
        assert!(parse_frontmatter("# just markdown").is_empty());
    }
}
