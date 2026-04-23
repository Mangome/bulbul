## MODIFIED Requirements

### Requirement: 对检测到的鸟类区域执行物种分类

系统后端 SHALL 在鸟类检测完成后，对每个检测框裁剪区域执行全球鸟种分类，填充 DetectionBox 的 species_name 和 species_confidence。分类模型从 YOLOv8s-cls (373类中国鸟类) 替换为 ResNet34/MetaFGNet (10,964类全球鸟类)，置信度阈值从 0.25 调整为 0.10。

#### Scenario: 单只鸟分类成功

- **WHEN** 检测到一只鸟且分类置信度 ≥ 0.10
- **THEN** DetectionBox 的 species_name 为物种中文名或英文名，species_confidence 为 softmax 后的概率

#### Scenario: 分类置信度过低

- **WHEN** 分类置信度 < 0.10
- **THEN** DetectionBox 的 species_name 保持 None，不标注物种

#### Scenario: 多只鸟分别分类

- **WHEN** 检测到 3 只鸟
- **THEN** 对每个检测框独立裁剪和分类，各自得到 species_name 和 species_confidence

#### Scenario: 分类失败不影响主流程

- **WHEN** 分类过程中出现任何错误（模型加载失败、图片无法读取等）
- **THEN** 仅记录 warn 日志，不阻断检测和合焦评分流程
