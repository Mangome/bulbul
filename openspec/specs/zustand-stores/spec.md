## ADDED Requirements

### Requirement: useAppStore 应用主 Store
系统 SHALL 提供 `useAppStore` Zustand Store，包含状态：currentFolder (string | null)、folderInfo (FolderInfo | null)、groups (GroupData[])、totalImages (number)、selectedGroupId (number | null)、processingState (ProcessingState)、progress (ProcessingProgress | null)。SHALL 提供 actions：setFolder、setGroups、selectGroup、navigateGroup（prev/next 循环切换）、setProcessingState、updateProgress、reset。

#### Scenario: 初始状态
- **WHEN** useAppStore 首次创建
- **THEN** currentFolder SHALL 为 null，groups SHALL 为空数组，processingState SHALL 为 "idle"，progress SHALL 为 null

#### Scenario: setFolder 更新状态
- **WHEN** 调用 setFolder("/path/to/folder", folderInfo)
- **THEN** currentFolder SHALL 为 "/path/to/folder"，folderInfo SHALL 为传入的值

#### Scenario: 设置分组数据
- **WHEN** 调用 `setGroups(groups, totalImages)`
- **THEN** `groups` 被设为传入的分组数据，`totalImages` 被设为传入值，`processingState` 变为 `completed`

#### Scenario: navigateGroup 循环切换
- **WHEN** 有 3 个分组且 selectedGroupId 为 2（最后一个），调用 navigateGroup("next")
- **THEN** selectedGroupId SHALL 回到 0（第一个）

#### Scenario: navigateGroup 上一个循环
- **WHEN** 当前在第一个分组，调用 navigateGroup('prev')
- **THEN** 循环到最后一个分组

#### Scenario: reset 恢复初始状态
- **WHEN** 调用 reset()
- **THEN** 所有状态 SHALL 恢复为初始值，groups 清空，totalImages 置 0，selectedGroupId 置 null

### Requirement: useCanvasStore 画布状态 Store
系统 SHALL 提供 `useCanvasStore` Zustand Store，包含状态：viewportX (number, 初始 0)、viewportY (number, 初始 0)、showDetectionOverlay (boolean, 初始 false)、showImageInfo (boolean, 初始 true)、showHistogram (boolean, 初始 false)。SHALL 提供 actions：setViewport、toggleDetectionOverlay（切换 showDetectionOverlay）、toggleImageInfo（切换 showImageInfo）、toggleHistogram（切换 showHistogram）。SHALL 提供分组导航状态和 actions：currentGroupIndex、groupCount、setGroupCount、goToGroup、nextGroup、prevGroup。showImageInfo 和 showHistogram SHALL 持久化到 settings.json。

#### Scenario: toggleDetectionOverlay 切换为 true
- **WHEN** showDetectionOverlay 为 false，调用 toggleDetectionOverlay()
- **THEN** showDetectionOverlay SHALL 变为 true

#### Scenario: toggleDetectionOverlay 切换为 false
- **WHEN** showDetectionOverlay 为 true，调用 toggleDetectionOverlay()
- **THEN** showDetectionOverlay SHALL 变为 false

#### Scenario: toggleImageInfo 切换为 false
- **WHEN** showImageInfo 为 true，调用 toggleImageInfo()
- **THEN** showImageInfo SHALL 变为 false，画布图片信息覆盖层立即隐藏

#### Scenario: toggleImageInfo 切换为 true
- **WHEN** showImageInfo 为 false，调用 toggleImageInfo()
- **THEN** showImageInfo SHALL 变为 true，画布图片信息覆盖层立即显示

#### Scenario: toggleHistogram 切换为 true
- **WHEN** showHistogram 为 false，调用 toggleHistogram()
- **THEN** showHistogram SHALL 变为 true，画布直方图立即显示

#### Scenario: toggleHistogram 切换为 false
- **WHEN** showHistogram 为 true，调用 toggleHistogram()
- **THEN** showHistogram SHALL 变为 false，画布直方图立即隐藏

#### Scenario: showImageInfo 持久化
- **WHEN** 用户切换 showImageInfo 后关闭应用
- **THEN** 下次启动时 showImageInfo SHALL 恢复为上次设置的值

#### Scenario: showHistogram 持久化
- **WHEN** 用户切换 showHistogram 后关闭应用
- **THEN** 下次启动时 showHistogram SHALL 恢复为上次设置的值

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
