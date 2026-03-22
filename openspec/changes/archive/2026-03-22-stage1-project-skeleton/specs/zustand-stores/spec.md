## ADDED Requirements

### Requirement: useAppStore 应用主 Store
系统 SHALL 提供 `useAppStore` Zustand Store，包含状态：currentFolder (string | null)、folderInfo (FolderInfo | null)、groups (GroupData[])、totalImages (number)、selectedGroupId (number | null)、processingState (ProcessingState)、progress (ProcessingProgress | null)。SHALL 提供 actions：setFolder、setGroups、selectGroup、navigateGroup（prev/next 循环切换）、setProcessingState、updateProgress、reset。

#### Scenario: 初始状态
- **WHEN** useAppStore 首次创建
- **THEN** currentFolder SHALL 为 null，groups SHALL 为空数组，processingState SHALL 为 "idle"，progress SHALL 为 null

#### Scenario: setFolder 更新状态
- **WHEN** 调用 setFolder("/path/to/folder", folderInfo)
- **THEN** currentFolder SHALL 为 "/path/to/folder"，folderInfo SHALL 为传入的值

#### Scenario: navigateGroup 循环切换
- **WHEN** 有 3 个分组且 selectedGroupId 为 2（最后一个），调用 navigateGroup("next")
- **THEN** selectedGroupId SHALL 回到 0（第一个）

#### Scenario: reset 恢复初始状态
- **WHEN** 调用 reset()
- **THEN** 所有状态 SHALL 恢复为初始值

### Requirement: useCanvasStore 画布状态 Store
系统 SHALL 提供 `useCanvasStore` Zustand Store，包含状态：zoomLevel (number, 初始 1.0)、viewportX (number, 初始 0)、viewportY (number, 初始 0)。SHALL 提供 actions：setZoom（限制范围 0.1~3.0）、setViewport、zoomIn（+0.1 步进）、zoomOut（-0.1 步进）、fitToWindow、resetZoom（重置为 1.0）。

#### Scenario: 缩放范围限制
- **WHEN** 调用 setZoom(5.0)
- **THEN** zoomLevel SHALL 被限制为 3.0（最大值）

#### Scenario: 缩放范围下限
- **WHEN** 调用 setZoom(0.01)
- **THEN** zoomLevel SHALL 被限制为 0.1（最小值）

#### Scenario: zoomIn 步进
- **WHEN** zoomLevel 为 1.0 时调用 zoomIn()
- **THEN** zoomLevel SHALL 变为 1.1

### Requirement: useSelectionStore 选中状态 Store
系统 SHALL 提供 `useSelectionStore` Zustand Store，包含状态：selectedHashes (Set<string>)、selectedCount (number)。SHALL 提供 actions：toggleSelection（切换单个 hash 的选中态）、clearSelection（清空所有选中）、getSelectedInGroup（返回指定分组中已选中的数量）。

#### Scenario: toggleSelection 切换
- **WHEN** 对未选中的 hash 调用 toggleSelection("abc123")
- **THEN** selectedHashes SHALL 包含 "abc123"，selectedCount SHALL +1

#### Scenario: toggleSelection 取消选中
- **WHEN** 对已选中的 hash 调用 toggleSelection("abc123")
- **THEN** selectedHashes SHALL 不包含 "abc123"，selectedCount SHALL -1

#### Scenario: clearSelection 清空
- **WHEN** 有 5 个已选中项时调用 clearSelection()
- **THEN** selectedHashes SHALL 为空，selectedCount SHALL 为 0

#### Scenario: getSelectedInGroup 计数
- **WHEN** selectedHashes 包含 "a" 和 "b"，调用 getSelectedInGroup(["a", "b", "c"])
- **THEN** SHALL 返回 2
