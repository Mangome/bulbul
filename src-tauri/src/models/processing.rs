use serde::{Deserialize, Serialize};

/// 处理流水线状态枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProcessingState {
    Idle,
    Scanning,
    Processing,
    Analyzing,
    Grouping,
    FocusScoring,
    Completed,
    Cancelling,
    Cancelled,
    Error,
}

impl Default for ProcessingState {
    fn default() -> Self {
        ProcessingState::Idle
    }
}

/// 处理进度信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingProgress {
    pub state: ProcessingState,
    pub current: usize,
    pub total: usize,
    pub progress_percent: f64,
    pub message: Option<String>,
    pub current_file: Option<String>,
    pub elapsed_ms: Option<f64>,
    pub estimated_remaining_ms: Option<f64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_processing_state_snake_case_serialization() {
        let state = ProcessingState::Scanning;
        let json = serde_json::to_string(&state).unwrap();
        assert_eq!(json, "\"scanning\"");

        let idle = ProcessingState::Idle;
        let json = serde_json::to_string(&idle).unwrap();
        assert_eq!(json, "\"idle\"");

        let cancelling = ProcessingState::Cancelling;
        let json = serde_json::to_string(&cancelling).unwrap();
        assert_eq!(json, "\"cancelling\"");

        let focus_scoring = ProcessingState::FocusScoring;
        let json = serde_json::to_string(&focus_scoring).unwrap();
        assert_eq!(json, "\"focus_scoring\"");
    }

    #[test]
    fn test_processing_progress_serialization() {
        let progress = ProcessingProgress {
            state: ProcessingState::Processing,
            current: 25,
            total: 50,
            progress_percent: 50.0,
            message: Some("Processing images...".to_string()),
            current_file: Some("DSC_0001.nef".to_string()),
            elapsed_ms: Some(5000.0),
            estimated_remaining_ms: Some(5000.0),
        };

        let json = serde_json::to_string(&progress).unwrap();
        let deserialized: ProcessingProgress = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.progress_percent, 50.0);
        assert_eq!(deserialized.state, ProcessingState::Processing);
        assert_eq!(deserialized.current, 25);
        assert_eq!(deserialized.total, 50);
    }

    #[test]
    fn test_default_processing_state() {
        let state = ProcessingState::default();
        assert_eq!(state, ProcessingState::Idle);
    }
}
