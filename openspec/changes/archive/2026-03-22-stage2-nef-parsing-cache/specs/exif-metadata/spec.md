## ADDED Requirements

### Requirement: Exif 标签解析到 ImageMetadata
系统 SHALL 使用 `kamadak-exif` 库从 JPEG 数据或 NEF 文件字节中读取 Exif 标签，并映射到已定义的 `ImageMetadata` 结构体的对应字段。

#### Scenario: 完整 Exif 数据
- **WHEN** 传入包含完整 Exif 信息的 JPEG/NEF 数据
- **THEN** SHALL 返回 `ImageMetadata`，其中 `capture_time`、`camera_make`、`camera_model`、`focal_length`、`f_number`、`exposure_time`、`iso_speed` 等字段均被正确填充

#### Scenario: 部分 Exif 数据缺失
- **WHEN** 传入仅包含部分 Exif 标签的数据（如缺少 GPS 信息、镜头序列号）
- **THEN** SHALL 将缺失字段设为 `None`，已有字段正常填充，不返回错误

#### Scenario: 无 Exif 数据
- **WHEN** 传入不包含任何 Exif 信息的 JPEG 数据
- **THEN** SHALL 返回 `AppError::ExifError` 错误

### Requirement: 拍摄时间解析
系统 SHALL 解析 Exif `DateTimeOriginal`（tag 0x9003）标签，将其从 `YYYY:MM:DD HH:MM:SS` 格式转换为 ISO 8601 格式字符串存入 `capture_time`。如果 `DateTimeOriginal` 不存在，SHALL 尝试 `DateTime`（tag 0x0132）作为后备。

#### Scenario: 标准时间格式
- **WHEN** Exif 包含 `DateTimeOriginal = "2024:03:15 14:30:00"`
- **THEN** `capture_time` SHALL 为 `"2024-03-15T14:30:00"` 格式

#### Scenario: DateTimeOriginal 缺失但 DateTime 存在
- **WHEN** Exif 不包含 `DateTimeOriginal` 但包含 `DateTime = "2024:03:15 14:30:00"`
- **THEN** `capture_time` SHALL 使用 `DateTime` 的值

#### Scenario: 时间标签全部缺失
- **WHEN** Exif 中不包含任何时间标签
- **THEN** `capture_time` SHALL 为 `None`

### Requirement: GPS 坐标转换
系统 SHALL 将 Exif GPS 标签（GPSLatitude + GPSLatitudeRef、GPSLongitude + GPSLongitudeRef、GPSAltitude）从度/分/秒格式转换为十进制度数（`f64`）。南纬和西经 SHALL 表示为负数。

#### Scenario: 北纬东经坐标
- **WHEN** Exif 包含 GPS 坐标 N 39°54'20" E 116°23'30"
- **THEN** `gps_latitude` SHALL 约等于 39.9056，`gps_longitude` SHALL 约等于 116.3917

#### Scenario: 南纬西经坐标
- **WHEN** Exif 包含 GPS 坐标 S 33°51'22" W 151°12'30"
- **THEN** `gps_latitude` SHALL 为负数约 -33.856，`gps_longitude` SHALL 为负数约 -151.208

#### Scenario: 无 GPS 数据
- **WHEN** Exif 中不包含 GPS 标签
- **THEN** `gps_latitude`、`gps_longitude`、`gps_altitude` SHALL 均为 `None`

### Requirement: 曝光参数解析
系统 SHALL 解析 Exif 中的曝光参数：`FNumber`（光圈）、`ExposureTime`（快门速度）、`ISOSpeedRatings`（ISO）、`ExposureBiasValue`（曝光补偿）、`MeteringMode`（测光模式）、`ExposureMode`（曝光模式）。

#### Scenario: 完整曝光参数
- **WHEN** Exif 包含 FNumber=2.8, ExposureTime=1/200, ISO=400
- **THEN** `f_number` SHALL 为 2.8，`exposure_time` SHALL 为 0.005（秒），`iso_speed` SHALL 为 400

#### Scenario: 曝光参数部分缺失
- **WHEN** Exif 仅包含 ISO 标签
- **THEN** `iso_speed` SHALL 被填充，其余曝光字段 SHALL 为 `None`

### Requirement: 相机和镜头信息解析
系统 SHALL 解析 Exif 中的设备信息：`Make`（相机制造商）、`Model`（相机型号）、`LensModel`（镜头型号）、`FocalLength`（焦距）。

#### Scenario: Nikon Z50_2 设备信息
- **WHEN** Exif 包含 Make="NIKON CORPORATION", Model="NIKON Z 50_2", LensModel="NIKKOR Z DX 16-50mm f/3.5-6.3 VR", FocalLength=35mm
- **THEN** 对应字段 SHALL 被正确填充，`focal_length` SHALL 为 35.0

### Requirement: 图像尺寸和方向解析
系统 SHALL 解析 Exif 中的 `ImageWidth`、`ImageLength`（高度）、`Orientation` 标签。

#### Scenario: 横向拍摄
- **WHEN** Exif 包含 ImageWidth=6016, ImageLength=4016, Orientation=1
- **THEN** `image_width` SHALL 为 6016，`image_height` SHALL 为 4016，`orientation` SHALL 为 1
