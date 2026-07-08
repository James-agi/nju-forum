"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ChevronDown, ChevronUp, ExternalLink, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkifiedText, MarkdownText, SourceExcerptBlock } from "@/components/knowledge/source-excerpt";
import { UnsolvedButton } from "@/components/knowledge/unsolved-button";
import {
  SOURCE_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
  type DirectCardDTO,
} from "@/lib/knowledge/types";

// —— 布局常数 ——
const CARD_WIDTH = 288; // 18rem，所有卡片同宽——根治「太胖/太瘦」
const EDGE_INSET = 20; // 软边界内缩（肉眼不可见的墙）
const CARD_GAP = 20; // 卡片盒子间最小间隙
const FIELD_MAX_WIDTH = 1440; // 播放区最大有效宽度
const EST_CARD_HEIGHT = 380; // 高度实测前的估计（真实折叠卡约 370-420）
const BOTTOM_PAD = 48; // 容器底部留白
const MIN_FIELD_HEIGHT = 300;

// —— 物理常数（对着 dev 手调的起始值，可再调）——
const MAX_DT = 1 / 30; // dt 上限，防切屏回来爆冲
const DRIFT_ACC = 18; // 漂移加速度幅值 px/s²
const REPULSION_K = 85; // 斥力刚度（穿透弹簧）1/s²——防重叠的主导力，须打得过漂移
const BOUNDARY_K = 42; // 边界回推刚度
const ROW_GAP = 46; // 装箱时的行间距（比列间距大，给漂移留余量，避免邻行相撞）
const HOME_K = 1.4; // 归位弱弹簧，防无限漂
const MAX_SPEED = 240; // 速度上限 px/s
const DAMP_IDLE = 1.1; // 闲置阻尼（每秒对数衰减系数）
const DAMP_HOLD = 9; // 「伸手去读」时的强阻尼→快速静止

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number; // 实测宽（恒为 CARD_WIDTH）
  h: number; // 实测高（展开会变大→斥力更强）
  baseH: number; // 折叠基准高（首测得到，重排用它，展开不改）
  homeX: number;
  homeY: number;
  jx: number; // 归位点的固定抖动量（保证重排稳定、不每次跳）
  jy: number;
  phaseX: number;
  phaseY: number;
  freqX: number;
  freqY: number;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// 物理场需要 ≥3 列才有展开腾挪的横向空间（3×卡宽 ≈ 976px）；
// 更窄的桌面/平板退回静态堆叠，否则展开的高卡会把邻居挤出软边界
const STATIC_MAX_WIDTH = 1023;

function detectStatic() {
  if (typeof window === "undefined") return true;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrow = window.matchMedia(`(max-width: ${STATIC_MAX_WIDTH}px)`).matches;
  return reduce || narrow;
}

export function FloatingCardsField({
  message,
  cards,
  questionId,
}: {
  message: string;
  cards: DirectCardDTO[];
  questionId: string;
}) {
  const [isStatic, setIsStatic] = useState<boolean>(detectStatic);

  // 播放区容器（卡片的定位父级）
  const areaRef = useRef<HTMLDivElement | null>(null);
  // 每张卡的 DOM 节点，供物理循环直接写 transform
  const cardEls = useRef<(HTMLElement | null)[]>([]);

  // 「伸手去读→定住」的三个来源
  const pointerRef = useRef(false);
  const focusRef = useRef(false);
  const expandedCountRef = useRef(0);
  const holdRef = useRef(false);
  const syncHold = () => {
    holdRef.current =
      pointerRef.current || focusRef.current || expandedCountRef.current > 0;
  };

  const onExpandedChange = (expanded: boolean) => {
    expandedCountRef.current = Math.max(
      0,
      expandedCountRef.current + (expanded ? 1 : -1)
    );
    syncHold();
  };

  // 媒体查询：reduced-motion 或窄屏 → 静态降级；变化时热切换
  useEffect(() => {
    const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrowMq = window.matchMedia(`(max-width: ${STATIC_MAX_WIDTH}px)`);
    const update = () => setIsStatic(reduceMq.matches || narrowMq.matches);
    reduceMq.addEventListener("change", update);
    narrowMq.addEventListener("change", update);
    update();
    return () => {
      reduceMq.removeEventListener("change", update);
      narrowMq.removeEventListener("change", update);
    };
  }, []);

  // 物理场：仅在非静态时启动
  useEffect(() => {
    if (isStatic) return;
    const area = areaRef.current;
    if (!area) return;

    const count = cards.length;
    let width = Math.min(area.clientWidth || FIELD_MAX_WIDTH, FIELD_MAX_WIDTH);

    const bodies: Body[] = cards.map(() => ({
      x: 0,
      y: 0,
      vx: rand(-10, 10),
      vy: rand(-10, 10),
      w: CARD_WIDTH,
      h: EST_CARD_HEIGHT,
      baseH: 0,
      homeX: 0,
      homeY: 0,
      jx: rand(-22, 22),
      jy: rand(-16, 16),
      phaseX: rand(0, Math.PI * 2),
      phaseY: rand(0, Math.PI * 2),
      freqX: rand(0.18, 0.42),
      freqY: rand(0.18, 0.42),
    }));

    // —— 按实测折叠高度逐行装箱，算出无重叠的归位点 ——
    const relayout = () => {
      const usableW = Math.max(CARD_WIDTH, width - 2 * EDGE_INSET);
      const colStep = CARD_WIDTH + CARD_GAP;
      const cols = Math.max(1, Math.floor((usableW + CARD_GAP) / colStep));
      const gridW = cols * CARD_WIDTH + (cols - 1) * CARD_GAP;
      const startX = Math.max(EDGE_INSET, (width - gridW) / 2);
      const maxHomeX = Math.max(EDGE_INSET, width - EDGE_INSET - CARD_WIDTH);
      let rowY = EDGE_INSET;
      for (let start = 0; start < count; start += cols) {
        const end = Math.min(count, start + cols);
        let rowH = 0;
        for (let k = start; k < end; k++) {
          rowH = Math.max(rowH, bodies[k].baseH || EST_CARD_HEIGHT);
        }
        for (let k = start; k < end; k++) {
          const col = k - start;
          bodies[k].homeX = Math.min(
            Math.max(startX + col * colStep + bodies[k].jx, EDGE_INSET),
            maxHomeX
          );
          bodies[k].homeY = rowY + bodies[k].jy;
        }
        rowY += rowH + ROW_GAP;
      }
    };

    const writeTransform = (i: number) => {
      const el = cardEls.current[i];
      if (el) {
        el.style.transform = `translate3d(${bodies[i].x}px, ${bodies[i].y}px, 0)`;
      }
    };

    // 首测前用估计高度先摆一版，随后实测重排时吸附归位
    relayout();
    for (const b of bodies) {
      b.x = b.homeX;
      b.y = b.homeY;
    }
    bodies.forEach((_, i) => writeTransform(i));

    // 容器高度 = 最深卡底 + 留白（absolute 子元素不撑高父级，必须显式设）
    let lastHeight = 0;
    const applyHeight = () => {
      let maxBottom = 0;
      for (const b of bodies) maxBottom = Math.max(maxBottom, b.y + b.h);
      const h = Math.max(MIN_FIELD_HEIGHT, maxBottom + BOTTOM_PAD);
      if (Math.abs(h - lastHeight) > 6) {
        lastHeight = h;
        area.style.height = `${h}px`;
      }
    };
    applyHeight();

    // 实测卡片盒子尺寸：折叠基准高（baseH）只记首测，用于装箱；
    // 实时高度 h 随展开变化，喂给斥力去挤开邻居
    let measured = 0;
    const ro = new ResizeObserver((entries) => {
      let needRelayout = false;
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const idx = cardEls.current.indexOf(el);
        if (idx < 0 || !bodies[idx]) continue;
        // 用 offsetWidth/Height 拿完整边框盒；contentRect 会漏掉 padding+border（每边约 17px），
        // 那样斥力低估高度→行间残留视觉重叠→永不静止
        const bh = el.offsetHeight || EST_CARD_HEIGHT;
        bodies[idx].w = el.offsetWidth || CARD_WIDTH;
        bodies[idx].h = bh;
        if (bodies[idx].baseH === 0 && bh > 0) {
          bodies[idx].baseH = bh;
          measured++;
          if (measured === count) needRelayout = true;
        }
      }
      // 全部量完→按真实高度重排一次并吸附归位（此时入场淡入尚未结束，看不到跳变）
      if (needRelayout) {
        relayout();
        for (let i = 0; i < count; i++) {
          bodies[i].x = bodies[i].homeX;
          bodies[i].y = bodies[i].homeY;
          bodies[i].vx = 0;
          bodies[i].vy = 0;
          writeTransform(i);
        }
        applyHeight();
      }
    });
    cardEls.current.slice(0, count).forEach((el) => el && ro.observe(el));

    // 交互监听（定住）
    const onFocusIn = () => {
      focusRef.current = true;
      syncHold();
    };
    const onFocusOut = () => {
      focusRef.current = false;
      syncHold();
    };
    area.addEventListener("focusin", onFocusIn);
    area.addEventListener("focusout", onFocusOut);

    const onResize = () => {
      width = Math.min(area.clientWidth || FIELD_MAX_WIDTH, FIELD_MAX_WIDTH);
      relayout(); // 列数随宽度变→重排归位点，弹簧会把卡片平滑带过去
    };
    window.addEventListener("resize", onResize);

    // —— 积分循环 ——
    let raf = 0;
    let last = 0;
    const ax = new Array<number>(count).fill(0);
    const ay = new Array<number>(count).fill(0);

    const step = (now: number) => {
      if (!last) last = now;
      const dt = Math.min(MAX_DT, Math.max(0, (now - last) / 1000));
      last = now;
      const t = now / 1000;
      const hold = holdRef.current;

      for (let i = 0; i < count; i++) {
        ax[i] = 0;
        ay[i] = 0;
      }

      // 两两斥力：盒子重叠时沿最小穿透轴弹开
      for (let i = 0; i < count; i++) {
        const bi = bodies[i];
        for (let j = i + 1; j < count; j++) {
          const bj = bodies[j];
          const dx = bi.x + bi.w / 2 - (bj.x + bj.w / 2);
          const dy = bi.y + bi.h / 2 - (bj.y + bj.h / 2);
          const overlapX = (bi.w + bj.w) / 2 + CARD_GAP - Math.abs(dx);
          const overlapY = (bi.h + bj.h) / 2 + CARD_GAP - Math.abs(dy);
          if (overlapX > 0 && overlapY > 0) {
            if (overlapX < overlapY) {
              const dir = dx === 0 ? (i % 2 ? 1 : -1) : Math.sign(dx);
              const f = REPULSION_K * overlapX * dir;
              ax[i] += f;
              ax[j] -= f;
            } else {
              const dir = dy === 0 ? 1 : Math.sign(dy);
              const f = REPULSION_K * overlapY * dir;
              ay[i] += f;
              ay[j] -= f;
            }
          }
        }
      }

      for (let i = 0; i < count; i++) {
        const b = bodies[i];
        // 漂移 + 归位弱弹簧：仅在闲置时施加。
        // 「伸手去读→定住」时全部关掉，只留斥力+边界——
        // 这样卡片真正静止（无残余归位蠕动），但展开仍能推开邻居、越界仍被兜回。
        if (!hold) {
          ax[i] += HOME_K * (b.homeX - b.x);
          ay[i] += HOME_K * (b.homeY - b.y);
          ax[i] += DRIFT_ACC * Math.sin(t * b.freqX + b.phaseX);
          ay[i] += DRIFT_ACC * Math.cos(t * b.freqY + b.phaseY);
        }
        // 软边界：左/右/上有墙，下方无限延展
        const leftPen = EDGE_INSET - b.x;
        if (leftPen > 0) ax[i] += BOUNDARY_K * leftPen;
        const rightPen = b.x + b.w - (width - EDGE_INSET);
        if (rightPen > 0) ax[i] -= BOUNDARY_K * rightPen;
        const topPen = EDGE_INSET - b.y;
        if (topPen > 0) ay[i] += BOUNDARY_K * topPen;
      }

      const damp = Math.exp(-(hold ? DAMP_HOLD : DAMP_IDLE) * dt);
      for (let i = 0; i < count; i++) {
        const b = bodies[i];
        b.vx = (b.vx + ax[i] * dt) * damp;
        b.vy = (b.vy + ay[i] * dt) * damp;
        // 定住时低速直接吸附到 0，保证真正「静止」而非无限逼近
        if (hold && Math.hypot(b.vx, b.vy) < 3) {
          b.vx = 0;
          b.vy = 0;
        }
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > MAX_SPEED) {
          const k = MAX_SPEED / sp;
          b.vx *= k;
          b.vy *= k;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        // 硬边界钳制：软弹簧扛不住大斥力时的兜底，保证卡片绝不飞出场外被裁。
        // 容不下整张卡（极窄）就靠左钉住；下方无墙（无限延展）。
        const maxX = width - EDGE_INSET - b.w;
        if (maxX <= EDGE_INSET) {
          b.x = EDGE_INSET;
          b.vx = 0;
        } else if (b.x < EDGE_INSET) {
          b.x = EDGE_INSET;
          if (b.vx < 0) b.vx = 0;
        } else if (b.x > maxX) {
          b.x = maxX;
          if (b.vx > 0) b.vx = 0;
        }
        if (b.y < EDGE_INSET) {
          b.y = EDGE_INSET;
          if (b.vy < 0) b.vy = 0;
        }
        writeTransform(i);
      }

      applyHeight();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      area.removeEventListener("focusin", onFocusIn);
      area.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("resize", onResize);
    };
    // questionId 变→父级已用 key 强制重挂载，这里跟随 cards 引用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStatic, cards]);

  return (
    <section
      className="relative overflow-x-clip px-4 py-6 md:py-8"
      style={{ width: "100vw", maxWidth: "100vw", marginLeft: "calc(50% - 50vw)" }}
      aria-label="不思考 · 相关卡片"
    >
      <div className="mx-auto" style={{ maxWidth: FIELD_MAX_WIDTH }}>
        <div className="mx-auto mb-6 max-w-md px-2 text-center">
          <Badge variant="secondary" className="mb-3">
            <Search className="mr-1 h-3 w-3" />
            不思考
          </Badge>
          <p className="text-sm leading-6 text-muted-foreground">{message}</p>
        </div>

        {isStatic ? (
          <div className="flex flex-wrap justify-center gap-4">
            {cards.map((card, index) => (
              <DirectCardBubble
                key={card.cardId}
                card={card}
                index={index}
                floating={false}
              />
            ))}
          </div>
        ) : (
          <div
            ref={areaRef}
            className="relative mx-auto"
            style={{ height: MIN_FIELD_HEIGHT }}
            onPointerEnter={() => {
              pointerRef.current = true;
              syncHold();
            }}
            onPointerLeave={() => {
              pointerRef.current = false;
              syncHold();
            }}
          >
            {cards.map((card, index) => (
              <DirectCardBubble
                key={card.cardId}
                ref={(el) => {
                  cardEls.current[index] = el;
                }}
                card={card}
                index={index}
                floating
                onExpandedChange={onExpandedChange}
              />
            ))}
          </div>
        )}

        <div className="mx-auto mt-6 max-w-2xl px-2">
          <UnsolvedButton key={questionId} questionId={questionId} />
        </div>
      </div>
    </section>
  );
}

function getCardPreview(body: string) {
  const text = body
    .replace(/[#*_>`\-\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 150 ? `${text.slice(0, 150)}...` : text;
}

const DirectCardBubble = forwardRef<
  HTMLElement,
  {
    card: DirectCardDTO;
    index: number;
    floating: boolean;
    onExpandedChange?: (expanded: boolean) => void;
  }
>(function DirectCardBubble({ card, index, floating, onExpandedChange }, ref) {
  const [expanded, setExpanded] = useState(false);
  const visibleTerms = card.matchedTerms.slice(0, 4);

  const toggle = () => {
    setExpanded((value) => {
      const next = !value;
      onExpandedChange?.(next);
      return next;
    });
  };

  return (
    <article
      ref={ref}
      className={`knowledge-card-bubble border bg-background/90 p-4 shadow-sm backdrop-blur ${
        floating ? "absolute left-0 top-0 will-change-transform" : ""
      }`}
      style={{ width: CARD_WIDTH, "--bubble-index": index } as CSSProperties}
    >
      <div className="mb-2 flex flex-wrap gap-2">
        <Badge variant="outline">{card.domainTag}</Badge>
        <Badge variant="outline">{SOURCE_TYPE_LABELS[card.sourceType]}</Badge>
        <Badge>{VERIFICATION_STATUS_LABELS[card.verificationStatus]}</Badge>
      </div>

      <h2 className="break-words text-sm font-semibold leading-6">
        <LinkifiedText text={card.summary} />
      </h2>
      <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
        <LinkifiedText text={getCardPreview(card.body)} />
      </p>

      {visibleTerms.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visibleTerms.map((term) => (
            <span
              key={term}
              className="border border-border px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground"
            >
              {term}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={toggle}>
          {expanded ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
          {expanded ? "收起卡片" : "展开卡片"}
        </Button>
        {card.sourceUrl && (
          <Button asChild variant="ghost" size="sm">
            <a href={card.sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              查看来源
            </a>
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <MarkdownText
            text={card.body}
            className="rounded-md bg-muted/40 p-3 text-sm leading-6"
          />
          {card.sourceExcerpt && (
            <SourceExcerptBlock sourceExcerpt={card.sourceExcerpt} />
          )}
          <p className="break-words text-sm text-muted-foreground">
            <LinkifiedText text={card.sourceDescription} />
          </p>
        </div>
      )}
    </article>
  );
});
