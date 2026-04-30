//! 图像分组引擎
//!
//! 基于相似度和时间间隔将已按 (capture_time, filename) 排序的图像聚合为分组。
//! 使用顺序扫描 + 早期终止策略。

use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

use crate::core::similarity;
use crate::models::GroupData;

/// 默认相似度阈值（百分比）
const DEFAULT_SIMILARITY_THRESHOLD: f64 = 90.0;
/// 默认时间间隔（秒）
const DEFAULT_TIME_GAP_SECONDS: i64 = 10;

/// 使用 pHash 值计算的分组判断
///
/// 在分组阶段，pHash 已经计算完毕，直接基于存储的 pHash 值做汉明距离
fn should_group_with_phash(
    a_phash: u64,
    b_phash: u64,
    a_time: Option<&NaiveDateTime>,
    b_time: Option<&NaiveDateTime>,
    threshold: f64,
    time_gap_seconds: i64,
) -> bool {
    // 时间检查
    if let (Some(t1), Some(t2)) = (a_time, b_time) {
        let diff = (*t2 - *t1).num_seconds().abs();
        if diff > time_gap_seconds {
            return false;
        }
    }

    // 相似度检查
    let sim = similarity::similarity(a_phash, b_phash);
    sim >= threshold
}

/// 分组算法的输入（含 pHash 值），用于 Grouping 阶段
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageInfoWithPhash {
    /// 文件路径 hash（MD5）
    pub hash: String,
    /// pHash 感知哈希值
    pub phash: u64,
    /// 文件名
    pub filename: String,
    /// 原始文件路径
    pub file_path: String,
    /// 拍摄时间（可为 None）
    #[serde(with = "naive_datetime_opt")]
    pub capture_time: Option<NaiveDateTime>,
}

mod naive_datetime_opt {
    use chrono::NaiveDateTime;
    use serde::{self, Deserialize, Deserializer, Serializer};

    const FORMAT: &str = "%Y-%m-%dT%H:%M:%S";

    pub fn serialize<S>(date: &Option<NaiveDateTime>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match date {
            Some(d) => serializer.serialize_str(&d.format(FORMAT).to_string()),
            None => serializer.serialize_none(),
        }
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<NaiveDateTime>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let opt: Option<String> = Option::deserialize(deserializer)?;
        match opt {
            Some(s) => NaiveDateTime::parse_from_str(&s, FORMAT)
                .map(Some)
                .map_err(serde::de::Error::custom),
            None => Ok(None),
        }
    }
}

/// 对已排序且已计算 pHash 的图片列表执行分组
///
/// 这是主要的分组入口，在 Analyzing 阶段后调用
pub fn group_images_with_phash(
    images: &[ImageInfoWithPhash],
    similarity_threshold: Option<f64>,
    time_gap_seconds: Option<i64>,
) -> Vec<GroupData> {
    if images.is_empty() {
        return Vec::new();
    }

    let threshold = similarity_threshold.unwrap_or(DEFAULT_SIMILARITY_THRESHOLD);
    let time_gap = time_gap_seconds.unwrap_or(DEFAULT_TIME_GAP_SECONDS);

    let mut groups: Vec<Vec<usize>> = Vec::new();
    let mut assigned = vec![false; images.len()];

    for i in 0..images.len() {
        if assigned[i] {
            continue;
        }

        let mut current_group = vec![i];
        assigned[i] = true;

        for j in (i + 1)..images.len() {
            if assigned[j] {
                continue;
            }

            let last_in_group = *current_group.last().unwrap();
            if should_group_with_phash(
                images[last_in_group].phash,
                images[j].phash,
                images[last_in_group].capture_time.as_ref(),
                images[j].capture_time.as_ref(),
                threshold,
                time_gap,
            ) {
                current_group.push(j);
                assigned[j] = true;
            } else {
                break; // 早期终止
            }
        }

        groups.push(current_group);
    }

    groups
        .into_iter()
        .enumerate()
        .map(|(idx, member_indices)| {
            build_group_data_with_phash(idx as u32, images, &member_indices)
        })
        .collect()
}
fn build_group_data_with_phash(
    group_id: u32,
    images: &[ImageInfoWithPhash],
    members: &[usize],
) -> GroupData {
    let picture_hashes: Vec<String> = members.iter().map(|&i| images[i].hash.clone()).collect();
    let picture_names: Vec<String> = members
        .iter()
        .map(|&i| images[i].filename.clone())
        .collect();
    let picture_paths: Vec<String> = members
        .iter()
        .map(|&i| images[i].file_path.clone())
        .collect();

    // 计算组内相邻图片对的平均相似度
    let avg_similarity = if members.len() <= 1 {
        100.0
    } else {
        let mut total_sim = 0.0;
        let pair_count = members.len() - 1;
        for w in members.windows(2) {
            total_sim += similarity::similarity(images[w[0]].phash, images[w[1]].phash);
        }
        let raw = total_sim / pair_count as f64;
        (raw * 100.0).round() / 100.0
    };

    GroupData {
        id: group_id,
        name: format!("分组 {}", group_id + 1),
        image_count: members.len(),
        avg_similarity,
        representative_hash: picture_hashes.first().cloned().unwrap_or_default(),
        picture_hashes,
        picture_names,
        picture_paths,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_image(phash: u64, filename: &str, time: Option<&str>) -> ImageInfoWithPhash {
        ImageInfoWithPhash {
            hash: format!("hash_{}", filename),
            phash,
            filename: filename.to_string(),
            file_path: format!("/photos/{}", filename),
            capture_time: time
                .map(|t| NaiveDateTime::parse_from_str(t, "%Y-%m-%d %H:%M:%S").unwrap()),
        }
    }

    #[test]
    fn test_consecutive_similar_images_grouped() {
        // 3 张图片：相同 pHash，时间间隔 5 秒
        let images = vec![
            make_image(0xAAAAAAAAAAAAAAAA, "a.nef", Some("2024-01-01 12:00:00")),
            make_image(0xAAAAAAAAAAAAAAAA, "b.nef", Some("2024-01-01 12:00:05")),
            make_image(0xAAAAAAAAAAAAAAAA, "c.nef", Some("2024-01-01 12:00:10")),
        ];

        let groups = group_images_with_phash(&images, Some(90.0), Some(10));
        assert_eq!(groups.len(), 1, "应归为 1 组");
        assert_eq!(groups[0].image_count, 3);
    }

    #[test]
    fn test_time_gap_splits_group() {
        // 2 张相似图片但时间间隔 > 10 秒
        let images = vec![
            make_image(0xAAAAAAAAAAAAAAAA, "a.nef", Some("2024-01-01 12:00:00")),
            make_image(0xAAAAAAAAAAAAAAAA, "b.nef", Some("2024-01-01 12:01:00")),
        ];

        let groups = group_images_with_phash(&images, Some(90.0), Some(10));
        assert_eq!(groups.len(), 2, "时间断裂应分为 2 组");
    }

    #[test]
    fn test_low_similarity_splits_group() {
        // 2 张时间相近但完全不同的图片
        let images = vec![
            make_image(0x0000000000000000, "a.nef", Some("2024-01-01 12:00:00")),
            make_image(0xFFFFFFFFFFFFFFFF, "b.nef", Some("2024-01-01 12:00:05")),
        ];

        let groups = group_images_with_phash(&images, Some(90.0), Some(10));
        assert_eq!(groups.len(), 2, "相似度不足应分为 2 组");
    }

    #[test]
    fn test_single_image_own_group() {
        let images = vec![
            make_image(0xAAAAAAAAAAAAAAAA, "a.nef", Some("2024-01-01 12:00:00")),
            make_image(0x0000000000000000, "b.nef", Some("2024-01-01 12:00:05")),
            make_image(0xBBBBBBBBBBBBBBBB, "c.nef", Some("2024-01-01 12:00:10")),
        ];

        let groups = group_images_with_phash(&images, Some(90.0), Some(10));
        // 每张图片都与相邻图片不相似，各自成组
        assert_eq!(groups.len(), 3);
        for g in &groups {
            assert_eq!(g.image_count, 1);
        }
    }

    #[test]
    fn test_empty_list() {
        let groups = group_images_with_phash(&[], Some(90.0), Some(10));
        assert!(groups.is_empty());
    }

    #[test]
    fn test_no_capture_time_fallback() {
        // 没有时间信息，仅靠相似度分组
        let images = vec![
            make_image(0xAAAAAAAAAAAAAAAA, "a.nef", None),
            make_image(0xAAAAAAAAAAAAAAAA, "b.nef", None),
        ];

        let groups = group_images_with_phash(&images, Some(90.0), Some(10));
        assert_eq!(groups.len(), 1, "无时间信息时仅基于相似度分组");
        assert_eq!(groups[0].image_count, 2);
    }

    #[test]
    fn test_early_termination() {
        // A 和 B 相似，B 和 C 不相似 → C 和 D 不应被检查与 A 的关系
        let images = vec![
            make_image(0xAAAAAAAAAAAAAAAA, "a.nef", Some("2024-01-01 12:00:00")),
            make_image(0xAAAAAAAAAAAAAAAA, "b.nef", Some("2024-01-01 12:00:05")),
            make_image(0x0000000000000000, "c.nef", Some("2024-01-01 12:00:10")),
            make_image(0xAAAAAAAAAAAAAAAA, "d.nef", Some("2024-01-01 12:00:15")),
        ];

        let groups = group_images_with_phash(&images, Some(90.0), Some(10));
        // A+B 一组, C 独立, D 独立（因为早期终止，C 挡住了 D）
        assert!(groups.len() >= 2);
        assert_eq!(groups[0].image_count, 2); // A + B
    }

    #[test]
    fn test_all_similar_single_group() {
        let images = vec![
            make_image(0xAAAAAAAAAAAAAAAA, "a.nef", Some("2024-01-01 12:00:00")),
            make_image(0xAAAAAAAAAAAAAAAA, "b.nef", Some("2024-01-01 12:00:03")),
            make_image(0xAAAAAAAAAAAAAAAA, "c.nef", Some("2024-01-01 12:00:06")),
            make_image(0xAAAAAAAAAAAAAAAA, "d.nef", Some("2024-01-01 12:00:09")),
        ];

        let groups = group_images_with_phash(&images, Some(90.0), Some(10));
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].image_count, 4);
    }

    #[test]
    fn test_group_data_consistency() {
        let images = vec![
            make_image(0xAAAAAAAAAAAAAAAA, "a.nef", Some("2024-01-01 12:00:00")),
            make_image(0xAAAAAAAAAAAAAAAA, "b.nef", Some("2024-01-01 12:00:05")),
        ];

        let groups = group_images_with_phash(&images, Some(90.0), Some(10));
        let g = &groups[0];

        assert_eq!(g.image_count, g.picture_hashes.len());
        assert_eq!(g.picture_hashes.len(), g.picture_names.len());
        assert_eq!(g.picture_names.len(), g.picture_paths.len());
    }

    #[test]
    fn test_group_naming() {
        let images = vec![
            make_image(0xAAAAAAAAAAAAAAAA, "a.nef", Some("2024-01-01 12:00:00")),
            make_image(0x0000000000000000, "b.nef", Some("2024-01-01 12:01:00")),
        ];

        let groups = group_images_with_phash(&images, Some(90.0), Some(10));
        assert_eq!(groups[0].name, "分组 1");
        assert_eq!(groups[1].name, "分组 2");
        assert_eq!(groups[0].id, 0);
        assert_eq!(groups[1].id, 1);
    }

    #[test]
    fn test_avg_similarity_single_image() {
        let images = vec![make_image(
            0xAAAAAAAAAAAAAAAA,
            "a.nef",
            Some("2024-01-01 12:00:00"),
        )];

        let groups = group_images_with_phash(&images, Some(90.0), Some(10));
        assert_eq!(groups[0].avg_similarity, 100.0);
    }

    #[test]
    fn test_avg_similarity_calculation() {
        // 3 张相同 hash 的图片 → 平均相似度 100%
        let images = vec![
            make_image(0xAAAAAAAAAAAAAAAA, "a.nef", Some("2024-01-01 12:00:00")),
            make_image(0xAAAAAAAAAAAAAAAA, "b.nef", Some("2024-01-01 12:00:03")),
            make_image(0xAAAAAAAAAAAAAAAA, "c.nef", Some("2024-01-01 12:00:06")),
        ];

        let groups = group_images_with_phash(&images, Some(90.0), Some(10));
        assert_eq!(groups[0].avg_similarity, 100.0);
    }
}
