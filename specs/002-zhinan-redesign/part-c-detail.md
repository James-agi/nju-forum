# Part C — 交互组件：技术细节

## C7. 回到顶部按钮

组件：`src/components/ui/scroll-to-top.tsx`（"use client"）

行为：
- 监听 scroll，当 `scrollY > 600px` 时显示
- 位置：右下角 fixed（`bottom-8 right-8`）
- 外观：圆形按钮，半透明背景，↑ 箭头图标
- 出现动画：从下方 translate-y + opacity 0 → 正常位置
- 点击动画：按钮自身 scale pulse → `window.scrollTo({ top: 0, behavior: 'smooth' })`
- 滚动过程中按钮保持可见，到顶后淡出

样式参考（图3）：
- 红色/品牌色圆圈边框
- 内部 ↑ 箭头
- 类似"剪影"的视觉重量

## C8. 命令面板

组件：`src/components/ui/command-palette.tsx`（"use client"）

触发方式：
- Ctrl+K (Windows) / ⌘K (Mac)
- 左下角浮动按钮点击

UI 结构（参考图5）：
```
┌─────────────────────────────────────┐
│ 🔍 搜索导航、文章、动作...    [ESC] │
├─────────────────────────────────────┤
│ 导航                                │
│  # 精选热帖          /hot           │
│  # 实时动态          /realtime      │
│  # 卡片视图          /cards         │
│  # 标签视图          /tags          │
│  # 主题视图          /topics        │
│  # 知识库            /knowledge     │
├─────────────────────────────────────┤
│ 动作                                │
│  ◐ 切换主题          dark/light     │
│  + 发布新帖          /new           │
│  ⚙ 个人设置          /profile       │
├─────────────────────────────────────┤
│ [↑] [↓] 选择  [↵] 执行  [esc] 关闭 │
└─────────────────────────────────────┘
```

功能：
- 搜索框实时过滤列表项
- 键盘上下选择 + Enter 执行
- 导航项：router.push 对应路由
- 动作项：执行 JS（切换主题、跳转）
- 打开/关闭有 scale + opacity 动画
- 背景有 backdrop-blur 遮罩

## C9. 左下浮动按钮

组件：集成在 command-palette 内

- 位置：`fixed bottom-6 left-6`
- 外观：48px 圆形，半透明深色背景，图标（类似图4 的剪影 icon）
- hover：scale 1.1 + glow
- 状态：命令面板打开时隐藏或变成 X

## C10. 移除 footer

- 删除现有 footer 组件（如果有）
- 将 footer 中的有用链接迁移到命令面板的导航列表中
