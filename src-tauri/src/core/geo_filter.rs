use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::path::Path;

use flate2::read::GzDecoder;
use lazy_static::lazy_static;
use log::{debug, warn};
use std::sync::Mutex;

lazy_static! {
    static ref GRID_DATA: Mutex<Option<HashMap<String, Vec<u16>>>> = Mutex::new(None);
}

/// 从 gzip 压缩的 JSON 文件加载网格数据
pub fn load_grid_data(grid_path: &Path) -> Result<HashMap<String, Vec<u16>>, String> {
    let file = std::fs::File::open(grid_path)
        .map_err(|e| format!("无法打开网格数据文件 {:?}: {}", grid_path, e))?;

    let mut decoder = GzDecoder::new(file);
    let mut json_str = String::new();
    decoder
        .read_to_string(&mut json_str)
        .map_err(|e| format!("解压网格数据失败: {}", e))?;

    let grid: HashMap<String, Vec<u16>> = serde_json::from_str(&json_str)
        .map_err(|e| format!("解析网格数据 JSON 失败: {}", e))?;

    Ok(grid)
}

/// 确保网格数据已加载到缓存中，返回克隆的数据引用
fn ensure_grid_loaded(grid_path: &Path) -> Option<HashMap<String, Vec<u16>>> {
    // 先检查是否已缓存
    {
        let cache = GRID_DATA.lock().unwrap();
        if cache.is_some() {
            return cache.clone();
        }
    }

    // 加载数据
    match load_grid_data(grid_path) {
        Ok(grid) => {
            let mut cache = GRID_DATA.lock().unwrap();
            *cache = Some(grid);
            cache.clone()
        }
        Err(e) => {
            warn!("加载网格数据失败: {}", e);
            None
        }
    }
}

/// 根据 GPS 坐标查询当地可能出现的物种 cls 索引列表
///
/// # 参数
/// - `lat`: 纬度（十进制度数，正值北半球，负值南半球）
/// - `lng`: 经度（十进制度数，正值东半球，负值西半球）
/// - `grid_path`: 网格数据文件路径
///
/// # 返回
/// - `Some(Vec<u16>)`: 该位置的物种 cls 索引列表
/// - `None`: 该位置无网格数据或加载失败
pub fn query_local_species(
    lat: f64,
    lng: f64,
    grid_path: &Path,
) -> Option<Vec<u16>> {
    let grid = ensure_grid_loaded(grid_path)?;

    // 将经纬度转为网格 key（floor 取整度数）
    let lat_idx = lat.floor() as i32;
    let lng_idx = lng.floor() as i32;
    let key = format!("{},{}", lat_idx, lng_idx);

    grid.get(&key).cloned()
}

/// 对概率向量应用地理过滤
///
/// 将不在 `local_species` 列表中的物种概率置零，再重新归一化使概率和为 1.0。
///
/// # 参数
/// - `probs`: 概率向量（softmax 输出），会被原地修改
/// - `local_species`: 当地可能出现的物种 cls 索引列表
///
/// # 边界情况
/// - `local_species` 为空时：不过滤
/// - 所有非零概率对应的 cls 均不在 `local_species` 中时：保留原结果
pub fn apply_geo_filter(probs: &mut [f32], local_species: &[u16]) {
    if local_species.is_empty() {
        return;
    }

    let local_set: HashSet<u16> = local_species.iter().copied().collect();

    // 计算保留物种的概率总和
    let mut sum = 0.0f32;
    for (idx, prob) in probs.iter().enumerate() {
        if local_set.contains(&(idx as u16)) {
            sum += *prob;
        }
    }

    // 所有保留物种的概率和为零，保留原结果
    if sum <= 0.0 {
        debug!(
            "地理过滤：所有非零概率对应的 cls 均不在当地物种列表中，保留原结果"
        );
        return;
    }

    // 将不在当地物种列表中的概率置零，保留的重新归一化
    for (idx, prob) in probs.iter_mut().enumerate() {
        if local_set.contains(&(idx as u16)) {
            *prob /= sum;
        } else {
            *prob = 0.0;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    /// 创建一个最小的测试用 gzip JSON 网格数据
    fn create_test_grid() -> Vec<u8> {
        let grid: HashMap<String, Vec<u16>> = {
            let mut g = HashMap::new();
            g.insert("39,116".to_string(), vec![0, 5, 10, 100]);
            g.insert("-34,151".to_string(), vec![1, 2, 3]);
            g.insert("40,-74".to_string(), vec![50, 51, 52, 53]);
            g
        };
        let json = serde_json::to_string(&grid).unwrap();

        let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        encoder.write_all(json.as_bytes()).unwrap();
        encoder.finish().unwrap()
    }

    #[test]
    fn test_query_local_species_beijing() {
        let grid_data = create_test_grid();
        let temp_dir = tempfile::tempdir().unwrap();
        let grid_path = temp_dir.path().join("test_grid.json.gz");
        std::fs::write(&grid_path, &grid_data).unwrap();

        // 清除全局缓存
        {
            let mut cache = GRID_DATA.lock().unwrap();
            *cache = None;
        }

        let result = query_local_species(39.9, 116.4, &grid_path);
        assert!(result.is_some());
        let species = result.unwrap();
        assert_eq!(species, vec![0, 5, 10, 100]);
    }

    #[test]
    fn test_query_local_species_negative_coords() {
        let grid_data = create_test_grid();
        let temp_dir = tempfile::tempdir().unwrap();
        let grid_path = temp_dir.path().join("test_grid.json.gz");
        std::fs::write(&grid_path, &grid_data).unwrap();

        // 清除全局缓存
        {
            let mut cache = GRID_DATA.lock().unwrap();
            *cache = None;
        }

        // 悉尼 (-33.9, 151.2) -> floor -> (-34, 151)
        let result = query_local_species(-33.9, 151.2, &grid_path);
        assert!(result.is_some());
        let species = result.unwrap();
        assert_eq!(species, vec![1, 2, 3]);
    }

    #[test]
    fn test_query_local_species_ocean() {
        let grid_data = create_test_grid();
        let temp_dir = tempfile::tempdir().unwrap();
        let grid_path = temp_dir.path().join("test_grid.json.gz");
        std::fs::write(&grid_path, &grid_data).unwrap();

        // 清除全局缓存
        {
            let mut cache = GRID_DATA.lock().unwrap();
            *cache = None;
        }

        // 海洋坐标（无数据）
        let result = query_local_species(0.0, 0.0, &grid_path);
        assert!(result.is_none());
    }

    #[test]
    fn test_query_local_species_boundary() {
        let grid_data = create_test_grid();
        let temp_dir = tempfile::tempdir().unwrap();
        let grid_path = temp_dir.path().join("test_grid.json.gz");
        std::fs::write(&grid_path, &grid_data).unwrap();

        // 清除全局缓存
        {
            let mut cache = GRID_DATA.lock().unwrap();
            *cache = None;
        }

        // 边界值：恰好整数度 (40.0, -74.0) -> floor(40.0) = 40
        let result = query_local_species(40.0, -74.0, &grid_path);
        assert!(result.is_some());
        let species = result.unwrap();
        assert_eq!(species, vec![50, 51, 52, 53]);
    }

    #[test]
    fn test_apply_geo_filter_normal() {
        // 10 维概率向量
        let mut probs = vec![0.1, 0.05, 0.3, 0.05, 0.1, 0.1, 0.05, 0.05, 0.1, 0.1];
        let local_species: Vec<u16> = vec![0, 2, 5, 8, 9]; // 保留这 5 个

        apply_geo_filter(&mut probs, &local_species);

        // 被过滤的置零
        assert_eq!(probs[1], 0.0);
        assert_eq!(probs[3], 0.0);
        assert_eq!(probs[4], 0.0);
        assert_eq!(probs[6], 0.0);
        assert_eq!(probs[7], 0.0);

        // 保留的重新归一化
        // 原始和 = 0.1 + 0.3 + 0.1 + 0.1 + 0.1 = 0.7
        assert!((probs[0] - 0.1 / 0.7).abs() < 1e-6);
        assert!((probs[2] - 0.3 / 0.7).abs() < 1e-6);

        // 总和应为 1.0
        let sum: f32 = probs.iter().sum();
        assert!((sum - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_apply_geo_filter_empty_species() {
        let mut probs = vec![0.3, 0.3, 0.4];
        let local_species: Vec<u16> = vec![];

        apply_geo_filter(&mut probs, &local_species);

        // 不应修改
        assert!((probs[0] - 0.3).abs() < 1e-6);
        assert!((probs[1] - 0.3).abs() < 1e-6);
        assert!((probs[2] - 0.4).abs() < 1e-6);
    }

    #[test]
    fn test_apply_geo_filter_all_masked() {
        // 所有非零概率对应的 cls 均不在 local_species 中
        let mut probs = vec![0.3, 0.3, 0.4];
        let local_species: Vec<u16> = vec![10, 11, 12]; // 这些 cls 超出范围

        apply_geo_filter(&mut probs, &local_species);

        // 应保留原结果
        assert!((probs[0] - 0.3).abs() < 1e-6);
        assert!((probs[1] - 0.3).abs() < 1e-6);
        assert!((probs[2] - 0.4).abs() < 1e-6);
    }

    #[test]
    fn test_apply_geo_filter_single_species() {
        let mut probs = vec![0.2, 0.3, 0.5];
        let local_species: Vec<u16> = vec![2]; // 只保留 cls 2

        apply_geo_filter(&mut probs, &local_species);

        assert_eq!(probs[0], 0.0);
        assert_eq!(probs[1], 0.0);
        assert!((probs[2] - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_load_grid_data_invalid_path() {
        let result = load_grid_data(Path::new("/nonexistent/path.json.gz"));
        assert!(result.is_err());
    }

    #[test]
    fn test_load_grid_data_invalid_gzip() {
        let temp_dir = tempfile::tempdir().unwrap();
        let grid_path = temp_dir.path().join("bad.json.gz");
        std::fs::write(&grid_path, b"not valid gzip data").unwrap();

        let result = load_grid_data(&grid_path);
        assert!(result.is_err());
    }
}
