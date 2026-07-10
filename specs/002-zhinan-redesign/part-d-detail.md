# Part D — 帖子详情增强 + 动效：技术细节

## D11. 帖子详情页退出键

位置：左上角 fixed 或 sticky

样式：
- 小圆形按钮（32px），← 箭头或 × 图标
- 半透明背景，hover 时实心
- 点击 → router.back() 或 router.push('/forum')

行为：
- 滚动时保持可见（sticky top）
- 有 hover scale 效果

## D12. 相关帖子推荐

位置：帖子正文结束后，评论区之前

布局（参考图2）：
```
──────────────────────────────────
相关阅读
┌──────────┐ ┌──────────┐ ┌──────────┐
│ 标签名    │ │ 标签名    │ │ 标签名    │
│ 帖子标题  │ │ 帖子标题  │ │ 帖子标题  │
│           │ │           │ │           │
│ 阅读 ↗   │ │ 阅读 ↗   │ │ 阅读 ↗   │
└──────────┘ └──────────┘ └──────────┘
  [←]                            [→]
```

推荐算法：
```typescript
// 1. 取当前帖子的 tags
// 2. 查询其他帖子中 tag 重叠数最多的
const related = await db.post.findMany({
  where: {
    id: { not: currentPostId },
    tags: { some: { id: { in: currentTagIds } } }
  },
  orderBy: { createdAt: 'desc' },
  take: 6 // 取6条，前端显示3，可左右滑动
});
// 3. 若 tags 为空，fallback 到同 section 最新帖子
```

交互：
- 横向滚动或左右箭头切换
- 卡片 hover 有 frame-card 边角效果（复用已有）

## D13. 全局动效升级

### 列表项入场
```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
```
每个列表项带 stagger delay：`animation-delay: calc(var(--index) * 60ms)`

### Hover 效果增强
- 卡片：hover 时 `scale(1.02)` + `box-shadow: 0 0 20px hsl(var(--foreground)/0.1)`
- 列表行：hover 时左侧序号变亮 + 微微 translateX(4px)
- 按钮：hover 时 glow ring `ring-2 ring-foreground/20`

### 视图切换动画
```css
@keyframes fadeScale {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}
```
每次切换视图时，内容区域播放 fadeScale（150ms ease-out）

### 页面跳转过渡
- 利用 Next.js `loading.tsx` 显示骨架屏 + 淡入
- 或用 `framer-motion` 的 `AnimatePresence`（如果用户接受新依赖）

### 主题切换动画
- 切换时 body 加 `transition: background-color 0.3s, color 0.3s`
- 可选：圆形扩散效果（clip-path circle 从切换按钮位置展开）

## 依赖评估

| 依赖 | 用途 | 是否新增 |
|------|------|----------|
| next-auth | session 检测（登录门槛） | 已有 |
| framer-motion | 页面过渡动画 | 新增（可选，CSS 也能做） |
| cmdk | 命令面板 | 新增（或纯手写） |

建议：命令面板用 `cmdk`（shadcn/ui 已内置 Command 组件基于它），动画优先用 CSS + Tailwind `animate-*`，只在需要 layout animation 时引入 framer-motion。
