use serde::{Deserialize, Serialize};

/// 单个分组的数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupData {
    pub id: u32,
    pub name: String,
    pub image_count: usize,
    pub avg_similarity: f64,
    pub representative_hash: String,
    pub picture_hashes: Vec<String>,
    pub picture_names: Vec<String>,
    pub picture_paths: Vec<String>,
}

/// 分组处理的完整结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupResult {
    pub groups: Vec<GroupData>,
    pub total_images: usize,
    pub total_groups: usize,
    pub processed_files: usize,
    pub performance: PerformanceMetrics,
}

/// 性能指标
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceMetrics {
    pub total_time_ms: f64,
    pub scan_time_ms: f64,
    pub process_time_ms: f64,
    pub similarity_time_ms: f64,
    pub grouping_time_ms: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_group_data_serialize_roundtrip() {
        let group = GroupData {
            id: 1,
            name: "Group 1".to_string(),
            image_count: 5,
            avg_similarity: 0.95,
            representative_hash: "abc123".to_string(),
            picture_hashes: vec!["h1".to_string(), "h2".to_string()],
            picture_names: vec!["img1.nef".to_string(), "img2.nef".to_string()],
            picture_paths: vec!["/path/img1.nef".to_string(), "/path/img2.nef".to_string()],
        };

        let json = serde_json::to_string(&group).unwrap();
        let deserialized: GroupData = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.id, 1);
        assert_eq!(deserialized.name, "Group 1");
        assert_eq!(deserialized.image_count, 5);
        assert_eq!(deserialized.picture_hashes.len(), 2);
    }

    #[test]
    fn test_group_result_field_consistency() {
        let result = GroupResult {
            groups: vec![
                GroupData {
                    id: 0,
                    name: "G0".to_string(),
                    image_count: 3,
                    avg_similarity: 0.9,
                    representative_hash: "h0".to_string(),
                    picture_hashes: vec![],
                    picture_names: vec![],
                    picture_paths: vec![],
                },
                GroupData {
                    id: 1,
                    name: "G1".to_string(),
                    image_count: 2,
                    avg_similarity: 0.85,
                    representative_hash: "h1".to_string(),
                    picture_hashes: vec![],
                    picture_names: vec![],
                    picture_paths: vec![],
                },
            ],
            total_images: 5,
            total_groups: 2,
            processed_files: 5,
            performance: PerformanceMetrics {
                total_time_ms: 1000.0,
                scan_time_ms: 200.0,
                process_time_ms: 500.0,
                similarity_time_ms: 200.0,
                grouping_time_ms: 100.0,
            },
        };

        assert_eq!(result.total_groups, result.groups.len());
        assert!(result.performance.total_time_ms >= 0.0);
        assert!(result.performance.scan_time_ms >= 0.0);
        assert!(result.performance.process_time_ms >= 0.0);
        assert!(result.performance.similarity_time_ms >= 0.0);
        assert!(result.performance.grouping_time_ms >= 0.0);
    }
}
