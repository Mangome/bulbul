use std::collections::HashMap;

use crate::core::bird_detection::DetectionBox;
use crate::core::focus_score::FocusScoringMethod;

/// 缓存单张照片的检测结果，供 reclassify 命令复用
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DetectionCacheEntry {
    pub score: Option<u32>,
    pub method: FocusScoringMethod,
    pub bboxes: Vec<DetectionBox>,
}

/// 检测结果缓存，key 为照片 hash
pub type DetectionCache = HashMap<String, DetectionCacheEntry>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detection_cache_entry_serialize_deserialize() {
        let entry = DetectionCacheEntry {
            score: Some(4),
            method: FocusScoringMethod::BirdRegion,
            bboxes: vec![DetectionBox::new(0.1, 0.2, 0.8, 0.9, 0.95)],
        };

        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: DetectionCacheEntry = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.score, Some(4));
        assert_eq!(deserialized.method, FocusScoringMethod::BirdRegion);
        assert_eq!(deserialized.bboxes.len(), 1);
        assert!((deserialized.bboxes[0].x1 - 0.1).abs() < f32::EPSILON);
    }

    #[test]
    fn test_detection_cache_entry_with_species() {
        let mut bbox = DetectionBox::new(0.1, 0.2, 0.8, 0.9, 0.95);
        bbox.species_name = Some("Silver Pheasant".to_string());
        bbox.species_confidence = Some(0.85);

        let entry = DetectionCacheEntry {
            score: Some(5),
            method: FocusScoringMethod::BirdRegion,
            bboxes: vec![bbox],
        };

        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: DetectionCacheEntry = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.bboxes[0].species_name, Some("Silver Pheasant".to_string()));
        assert_eq!(deserialized.bboxes[0].species_confidence, Some(0.85));
    }

    #[test]
    fn test_detection_cache_entry_none_score() {
        let entry = DetectionCacheEntry {
            score: None,
            method: FocusScoringMethod::Undetected,
            bboxes: vec![],
        };

        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: DetectionCacheEntry = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.score, None);
        assert_eq!(deserialized.method, FocusScoringMethod::Undetected);
        assert!(deserialized.bboxes.is_empty());
    }

    #[test]
    fn test_detection_cache_hashmap() {
        let mut cache: DetectionCache = HashMap::new();

        cache.insert("hash_a".to_string(), DetectionCacheEntry {
            score: Some(3),
            method: FocusScoringMethod::FullImage,
            bboxes: vec![],
        });
        cache.insert("hash_b".to_string(), DetectionCacheEntry {
            score: Some(5),
            method: FocusScoringMethod::BirdRegion,
            bboxes: vec![DetectionBox::new(0.2, 0.3, 0.7, 0.8, 0.88)],
        });

        assert_eq!(cache.len(), 2);
        assert_eq!(cache.get("hash_a").unwrap().score, Some(3));
        assert_eq!(cache.get("hash_b").unwrap().score, Some(5));
        assert!(cache.get("hash_c").is_none());
    }
}
