# 正文结构化修复计划

> 扫描时间：2026-06-26
> 候选卡片：316 张（扫描脚本：`prisma/tools/scan-unstructured-cards.ts`）
> 目标：将正文从"一大段纯文本"改为"空行分段 + 列表 + 步骤编号"的纯文本结构化格式，不引入 Markdown 渲染依赖。

## 执行约束

1. **改写范围**：只改 `body` 字段，不碰 `summary`、`sourceExcerpt` 等其他字段
2. **信息保真**：不编造来源外信息，不丢失原文事实，语气保持"学长聊天"
3. **格式规范**：空行分段、`- ` 列表、`1. 2. 3.` 步骤编号，禁止【】标签和 Markdown `##` `**`
4. **写库策略**：每批改写后设 `verificationStatus: "NEEDS_REVIEW"`
5. **dry-run 优先**：每批先输出 `exports/restructure-dry-run.json`，确认后再写库

## 批次规划

共 16 个 domainTag，按卡片数分 14 批。每批控制在 20-40 张以内，便于人工抽检。

### Batch 01 — 选课规则-高优先（22 张）
命中 2+ 规则的卡片，结构化需求最迫切。

| # | ID | 字数 | 规则数 | summary |
|---|-----|------|-------|---------|
| 1 | cmpv76cyg000nr6pomc5tm9xk | 382 | 3 | 英语四六级/雅思托福怎么准备 |
| 2 | cmpv76cy5000lr6po11mmpjoa | 1138 | 2 | 南京大学数学通修课程怎么选（2025级） |
| 3 | cmq4ol5jk0007r6o4qybo57hs | 951 | 2 | 转CS五门专业课选哪门？ |
| 4 | cmpz7puvr0015r600iskc8lrw | 860 | 2 | 双学士学位是什么？ |
| 5 | cmq5dmt5k001jr6bchec5kw61 | 747 | 2 | 缓考怎么申请？ |
| 6 | cmpz7puv60013r600qlat038r | 649 | 2 | 在南大怎样才能顺利拿到学士学位证？ |
| 7 | cmpz3yb3m000xr600g18lhi91 | 583 | 2 | 挂科了怎么办？ |
| 8 | cmpwifo7d0001r6kwnhzwrjvl | 493 | 2 | 什么是学分？学分怎么获得？ |
| 9 | cmq5dmt5r001lr6bcid9yp9qx | 468 | 2 | 缓修是什么？ |
| 10 | cmpsdf9ka0001r6qw27i0ayme | 398 | 2 | 通识课总学分要求与推荐组成方案（2025级） |
| 11 | cmpz3yb2i000jr6009oe7lsp4 | 349 | 2 | 形势与政策和国家安全教育怎么上？ |
| 12 | cmpwiae6m0005r6m4yz1pze7n | 341 | 2 | 劳动教育实践课怎么修？ |
| 13 | cmpytxd000005r600eqo3kypd | 336 | 2 | 暑期学校多数人可不上 |
| 14 | cmq4tt13z0003r6d071cpwtp0 | 326 | 2 | 化生大类大一上有哪些课？ |
| 15 | cmpz3yb1m000br600073l3xty | 320 | 2 | 英语分层是怎么定的？ |
| 16 | cmpz3yb2n000lr600nrmtgs6r | 240 | 2 | 南京大学军事课是什么？ |
| 17 | cmpwiae7y000dr6m41xwo5hwj | 181 | 2 | 人工智能通识和普通通识课是什么？ |
| 18 | cmq4tt1450007r6d0h979crxi | 160 | 2 | 化生大类大一下分流进化学，有哪些课？ |
| 19 | cmq5dmt20000br6bcn0dm95aj | 2123 | 1 | 智科大一核心课怎么学？ |
| 20 | cmpytxd090007r600pr745nip | 1487 | 1 | 新生第一次选课怎么进系统？ |
| 21 | cmpytxd0k0009r60055yieyxy | 1465 | 1 | 退补选前怎么排课表？ |
| 22 | cmq91hkgj0001r6qkto9y50b2 | 1298 | 1 | 英语分级考试是什么？ |

### Batch 02 — 选课规则-中优先（20 张）

| # | ID | 字数 | summary |
|---|-----|------|---------|
| 1 | cmq5dmt53001fr6bcex832mxz | 1182 | 新生选课前怎么比较老师和课程？ |
| 2 | cmq5dmt2p000lr6bcnarp9rrv | 1180 | 集成电路专业大一课程有哪些？ |
| 3 | cmpz3yb3s000zr600zsiwj9s7 | 920 | 课程时间冲突了怎么办？ |
| 4 | cmq5dmt5c001hr6bc0su30g2a | 837 | 挂科了怎么办？补考和重修怎么选？ |
| 5 | cmpwifo7w0005r6kwzug7cfnl | 750 | 南京大学本科课程有哪些类型？ |
| 6 | cmpz3yb2y000pr600mc7lrhqt | 646 | 专业必修课和专业选修课有什么区别？ |
| 7 | cmpz3yb1w000dr60033yttib4 | 607 | 英语课的选课流程是什么？ |
| 8 | cmpzhm0o6000vr6vcqd192mi8 | 597 | 学业预警是什么？ |
| 9 | cmpz3yb2a000hr600mo89bxfb | 594 | 南京大学政治课有哪些？ |
| 10 | cmq4tt1430005r6d0yagq85q7 | 577 | 化生大类大一下分流进生科，有哪些课？ |
| 11 | cmpz3yb2s000nr600vg9z8rnq | 553 | 港澳台同学不上政治课怎么补？ |
| 12 | cmq4ol5je0005r6o494sut1v4 | 548 | 转CS数学课怎么选？ |
| 13 | cmpz3yb36000rr600oif5juuu | 496 | 选专业课前要避开哪些坑？ |
| 14 | cmpzj7o5j0003r6xchf89nhu3 | 383 | 一二课堂融通学分怎么换？ |
| 15 | cmpz3yb3c000tr600ks98pb7k | 367 | 跨专业课是什么？怎么选？ |
| 16 | cmq0um08z0009r62c2lwxb22j | 338 | 新生军训怎么安排？ |
| 17 | cmpwiae4h0001r6m467gdwybq | 330 | 南京大学通识课总共要修多少学分？ |
| 18 | cmpz3yb24000fr600vdthuef7 | 302 | 四六级考试最早什么时候能考？ |
| 19 | cmpsdf9l0000br6qwnlq7fzrk | 300 | 悦读课程怎么修？ |
| 20 | cmpwifo7s0003r6kwmwcavcmn | 300 | 什么是学分绩（GPA）？ |

### Batch 03 — 选课规则-低优先（17 张）

| # | ID | 字数 | summary |
|---|-----|------|---------|
| 1 | cmpz3yb3h000vr600iwq5wbhm | 298 | 公选课是什么？ |
| 2 | cmpwj4v3p0005r64s13nfx3cq | 293 | 体测测什么？ |
| 3 | cmpwifo800007r6kwg33w9i7p | 265 | 怎么查询自己专业的培养方案？ |
| 4 | cmpz3yb3x0011r600fyqfpdre | 257 | 缓考是什么？ |
| 5 | cmpwj4v2x0001r64safnlmqyk | 253 | 南大体育课要上几个学期？ |
| 6 | cmq1zen2e000nr6yg9cm9wejn | 245 | 免修不免考是什么？ |
| 7 | cmpwiae7o000br6m4oil2xp48 | 240 | 悦读课程怎么拿学分？ |
| 8 | cmpwj4v3b0003r64salfyylzk | 221 | 体育课成绩怎么算？ |
| 9 | cmpsdf9l7000fr6qwvsmkgbzd | 209 | 普通通识课与新生研讨课 |
| 10 | cmpsdf9kx0009r6qwmkubiqtj | 176 | 科学之光课程怎么修？ |
| 11 | cmpsdf9l4000dr6qwr0hytj0i | 148 | 人工智能通识课程要求 |
| 12 | cmpsdf9kh0003r6qw1dlhsx4u | 146 | 劳动教育理论课程怎么修 |
| 13 | cmpwiae7d0009r6m4xvjl7mca | 138 | 科学之光课程怎么选？ |
| 14 | cmpwifo840009r6kwa75ysxl0 | 135 | 大一该选多少学分？ |
| 15 | cmpsdf9kq0007r6qwwydb39e9 | 127 | 美育课程要求 |
| 16 | cmpwiae5v0003r6m4r5n7b9tw | 125 | 劳动教育理论课怎么上？ |
| 17 | cmpwiae6x0007r6m4hmf2q18d | 90 | 美育课程是什么？ |

### Batch 04 — 校园服务-高优先（30 张）
命中 2+ 规则的卡片。

| # | ID | 字数 | 规则数 | summary |
|---|-----|------|-------|---------|
| 1 | cmq24ya1j0001r6o0l8jd8ilj | 718 | 3 | 腾讯会议SSO登录获得企业版权益 |
| 2 | cmpvfb57f0001r6z03kn79ps2 | 561 | 3 | 新生怎么买学生票？ |
| 3 | cmq0um09l000dr62c4kmxe1uo | 938 | 2 | 本科生怎么网上借教室？ |
| 4 | cmq2hqg8o0005r6pookrnwycl | 653 | 2 | 第一次逛鼓楼校区，哪些历史建筑最值得看？ |
| 5 | cmq22z2fp0003r6rws2bh8blm | 643 | 2 | 南大学生邮箱如何保障安全？ |
| 6 | cmpw2pp2q0007r680cc2bvd55 | 626 | 2 | 从苏州各火车站怎么到苏州校区？ |
| 7 | cmq26fle9001fr6yg2er7m56x | 511 | 2 | Eduroam是什么？ |
| 8 | cmq26fla7000vr6ygij16r40d | 463 | 2 | 第一次登录校内系统，统一身份认证怎么用？ |
| 9 | cmpvfb57z0007r6z0daev4yay | 431 | 2 | 学生票乘车区间有什么限制？ |
| 10 | cmq1s79na0001r688rsv9kqmy | 420 | 2 | 毕业后如何办理学历学位证明？ |
| 11 | cmq23j0dz000fr6h0vczk61yi | 394 | 2 | 校园网常见问题和故障报修 |
| 12 | cmq0xjuqy0007r6tsc08e1x42 | 391 | 2 | 团组织干部工作证明丢了怎么开？ |
| 13 | cmq1zemzt000dr6yg6l2guh3c | 380 | 2 | 怎么通过南大APP查空闲教室？ |
| 14 | cmq23j0d20003r6h0eapoxxk6 | 377 | 2 | 校园网无线接入和有线接入方法 |
| 15 | cmpzhm0nn000nr6vcbansahhg | 376 | 2 | 国际交流处项目有哪些类别？ |
| 16 | cmq0xjuqh0001r6tsgavii4fj | 373 | 2 | 团员证丢了怎么补办？ |
| 17 | cmq24ya2g0007r6o0pv6s05mz | 341 | 2 | Adobe全家桶安装激活的邮箱区别 |
| 18 | cmq0xhq0f0001r6x0wucea3oa | 339 | 2 | 南京大学图书馆借书的基本流程是什么？ |
| 19 | cmq23j0df0007r6h0nzhcd7ih | 319 | 2 | 校园网内网可以访问哪些资源 |
| 20 | cmq23j0du000dr6h0qoyouqr6 | 319 | 2 | Eduroam服务是什么，怎么用 |
| 21 | cmq0xhq0w0005r6x0qhi8y41b | 314 | 2 | 南京大学跨校区借书怎么操作？ |
| 22 | cmq1zemvu0001r6yg4b4a0yvi | 310 | 2 | 提前入组硕博生如何申请自管号？ |
| 23 | cmq0xjuqs0005r6tstdezq8oy | 308 | 2 | 在团组织里评奖评优获奖的证明丢了怎么开？ |
| 24 | cmq1zen0q000fr6ygxftw6px1 | 261 | 2 | 社团再注册在哪个平台办理？ |
| 25 | cmq26fld20013r6yg9agyl7ro | 261 | 2 | 新生如何领取校园卡？ |
| 26 | cmpvd9q1b0009r6vob6yj3d68 | 254 | 2 | 南大有哪些地区同乡群？ |
| 27 | cmq23j0cm0001r6h03rikunou | 230 | 2 | 校园网资费收费标准和充值方法 |
| 28 | cmpzhm0n9000hr6vcry4erfg6 | 182 | 2 | 为什么要参加交换项目？ |
| 29 | cmpzhm0ne000jr6vc9i2pzejx | 170 | 2 | 国内交换项目有哪些？ |
| 30 | cmq1zen35000tr6yg8rzg2oa7 | 942 | 1 | 出国交换怎么报名？ |

### Batch 05 — 校园服务-中优先 A（30 张）

| # | ID | 字数 | summary |
|---|-----|------|---------|
| 1 | cmq1zemxf0009r6yg4jyv12g8 | 913 | 校外临时访客怎么申请进校？ |
| 2 | cmq4m1wle0007r6zk6arb2azf | 831 | 如何在校外访问知网等学术资源？ |
| 3 | cmq2eabfy0001r6fcywlbujy6 | 820 | 浦口校区和仙林校区之间怎么通勤？ |
| 4 | cmpvd9q100007r6voma6tilie | 746 | 南大有哪些社团和兴趣类QQ群？ |
| 5 | cmq26flbi000xr6ygpzy3hbld | 738 | 学生邮箱如何开通？ |
| 6 | cmq26fled001hr6ygmb2iptyy | 718 | 校外VPN怎么用？ |
| 7 | cmpwc2vb10001r6dk8qqz4bzc | 717 | 鼓楼校区学习及办公设施有哪些？ |
| 8 | cmpwd3yv2000br6sw5lukc333 | 688 | 大学生门诊大病/大病保险/异地就医医保怎么报？ |
| 9 | cmpvfb57u0005r6z0kuc8ydsy | 679 | 学生票票价怎么算？ |
| 10 | cmpw2pp2e0005r680qhkvhckg | 675 | 从南京站/南京南站/禄口机场怎么到浦口校区？ |
| 11 | cmpwhx2gs0007r6jku1dlfkvr | 640 | 学生手册在哪看、有什么内容？ |
| 12 | cmpw46h7f0005r6hoywoi8xrf | 632 | 鼓楼到浦口校区怎么通勤？ |
| 13 | cmpvwde4y0003r6lssc7m9doz | 615 | 南京交通卡怎么办理？ |
| 14 | cmq22z2fy0005r6rwyse1dd5j | 611 | 南大学生邮箱如何设置客户端？ |
| 15 | cmq1s79nu0003r68849jz7k60 | 603 | 毕业生生源信息上报和就业推荐表怎么办理？ |
| 16 | cmpw46h7k0007r6houiibj3w5 | 570 | 鼓楼到苏州校区怎么通勤？ |
| 17 | cmq4m1wkg0001r6zkbfrtuy66 | 569 | 仙林和鼓楼校区有哪些适合自习的地点？ |
| 18 | cmpw2pp1s0001r680kmydjobt | 516 | 从南京站/南京南站/禄口机场怎么到鼓楼校区？ |
| 19 | cmpwc2vc60009r6dkbi2kjqbd | 506 | 鼓楼校区生活服务怎么用？ |
| 20 | cmq0um096000br62cj7j4jr21 | 498 | 校园卡丢了怎么补办？ |
| 21 | cmpwd3yuf0001r6swdwxasg6c | 497 | 大学生医保怎么参保？ |
| 22 | cmq26fldw0019r6ygnix83a7q | 492 | 校园网资费怎么算？ |
| 23 | cmpzhm0o2000tr6vce8cjcjbn | 483 | 交换学分如何认定？ |
| 24 | cmq4m1wl60005r6zk404sg6fi | 481 | 仙林校区有哪些面试地点？ |
| 25 | cmpvbocn4000br67o7fw2bnn7 | 470 | 提问的进阶经验 |
| 26 | cmpwhx2gx0009r6jkwm9hq7mb | 468 | 教务员怎么找？ |
| 27 | cmpw2pp210003r6805ivpnt58 | 462 | 从南京站/南京南站/禄口机场怎么到仙林校区？ |
| 28 | cmpvd9pzu0001r6vohj29moj5 | 455 | 南大有哪些书院/专业类QQ群？ |
| 29 | cmpwd3yuu0007r6swmbstmyki | 453 | 校医院各科室什么时候开门？ |
| 30 | cmq23j0d80005r6h03tisbf3c | 450 | 校园网登录方式和无感知认证设置 |

### Batch 06 — 校园服务-中优先 B（30 张）

| # | ID | 字数 | summary |
|---|-----|------|---------|
| 1 | cmq23j0dp000br6h072wd7ttu | 450 | 南大VPN使用方法和注意事项 |
| 2 | cmpvbocm00001r67o1wr7xx0l | 434 | 提问前先自己找答案 |
| 3 | cmq26flds0017r6yg22nkyp1f | 432 | 无感知认证是什么？怎么设置？ |
| 4 | cmpw46h6x0001r6hosk21u16f | 422 | 鼓楼北园到仙林校区怎么通勤？ |
| 5 | cmq22z2f50001r6rwlnttmg9j | 420 | 南大学生邮箱如何开通和使用？ |
| 6 | cmq2eabgl0003r6fc1og8oo4y | 411 | 浦口校区报到怎么去？ |
| 7 | cmpvfb57o0003r6z0z1r2l2qy | 404 | 学生票优惠次数怎么用和管理？ |
| 8 | cmpwd3yup0005r6swakcg360x | 401 | 社保卡怎么申领和补办？ |
| 9 | cmpvwde4n0001r6lsog5chyzw | 400 | 南京交通卡有什么乘车优惠？ |
| 10 | cmpwhx2g80001r6jkgmferi8k | 396 | 教务信息有哪些查询渠道？ |
| 11 | cmq26flcy0011r6yg2oa2x89t | 391 | 入学后怎么自助打印成绩单？ |
| 12 | cmq4m1wky0003r6zkxu0xsthf | 387 | 鼓楼校区有哪些适合晨读的地方？ |
| 13 | cmq26s7ty001nr6ygb16ya61q | 384 | 新生收到的「校园信息卡」是什么？ |
| 14 | cmpwd3yul0003r6sw0b6fqrzq | 371 | 去校医院看病要注意什么？ |
| 15 | cmq0xhq120007r6x06vsxjy6u | 356 | 南京大学图书馆座位怎么预约？ |
| 16 | cmpwd3yuy0009r6swd4iel953 | 354 | 大学生门诊医保能报销多少？ |
| 17 | cmpwhx2go0005r6jk7py7gjme | 350 | ehall办事服务大厅有什么本科生功能？ |
| 18 | cmq26fldo0015r6ygypv8vjrr | 348 | 南大校园网怎么接入？ |
| 19 | cmq24ya2w000br6o0ukg1vjx6 | 331 | 全能扫描王和微信读书学生认证福利 |
| 20 | cmpvbocmk0005r67ooi05espq | 328 | 联系老师的三种方式 |
| 21 | cmpwc2vby0007r6dk0sh6pw1y | 328 | 鼓楼校区食堂和餐厅有哪些推荐？ |
| 22 | cmpzj7o5e0001r6xc3h83vxs3 | 326 | 五育项目和敦行成绩单是什么？ |
| 23 | cmpvbocms0007r67orcb3zv1r | 320 | 校园邮箱有什么用 |
| 24 | cmq1zen1b000jr6ygr64v4vvx | 318 | 因公出国报销需要哪些材料？ |
| 25 | cmpwc2vbh0003r6dkpr3lk3kp | 317 | 仙林校区体育馆和运动场地怎么预约？ |
| 26 | cmq0xhq0r0003r6x0f0vq6zly | 311 | 南京大学图书馆还书需要注意什么？ |
| 27 | cmpvd9q080003r6vo6a316f8r | 310 | 南大有哪些辩论队招新群？ |
| 28 | cmq1zen0x000hr6ygy0dokf29 | 307 | 社会实践和志愿服务有什么区别？ |
| 29 | cmpwc2vbt0005r6dkpv6f53ca | 304 | 鼓楼和浦口校区有哪些运动场地？ |
| 30 | cmpwhx2gi0003r6jkvb4ej5zp | 304 | 本科生院官网怎么用？ |

### Batch 07 — 校园服务-低优先（24 张）

| # | ID | 字数 | summary |
|---|-----|------|---------|
| 1 | cmq23j0dl0009r6h0djgbs5x4 | 302 | 校园网可以享受哪些学术和软件资源 |
| 2 | cmq0x31qv0003r6v8sp7ymjyl | 293 | 火车优惠卡怎么用？ |
| 3 | cmq26fle1001br6yg2eakvg6o | 293 | 校园网设备保持功能是什么？ |
| 4 | cmpw46h780003r6ho3y11asem | 289 | 鼓楼南园到仙林校区怎么通勤？ |
| 5 | cmq24ya290005r6o0ntn41bfp | 287 | Notion教育Plus版怎么认证 |
| 6 | cmq0x31qm0001r6v888rr4f9l | 279 | 学生证补办流程和费用 |
| 7 | cmq2hqg8s0007r6potjsxtcbg | 277 | 自驾到仙林校区怎么走？ |
| 8 | cmq26fle5001dr6ygkhv84gl2 | 275 | 校园网出问题了怎么报障？ |
| 9 | cmpvd9q0f0005r6vop09q0n4z | 272 | 南大有哪些学习类QQ群？ |
| 10 | cmpvbocmy0009r67oaq25ixsu | 264 | 怎么提问才有效 |
| 11 | cmpvd9q1i000br6vochlyb4d2 | 261 | 南大有哪些游戏类QQ群？ |
| 12 | cmq1s79nz0005r6886vnafvgq | 246 | 图书馆毕业离校手续怎么办？ |
| 13 | cmpzhm0nx000rr6vcs651qae0 | 243 | 交换的要求是什么？ |
| 14 | cmq24ya210003r6o091bmioew | 242 | GitHub Education和JetBrains学生认证 |
| 15 | cmpzhm0ns000pr6vcv2zglsr0 | 241 | 暑研是什么？ |
| 16 | cmq24ya2p0009r6o0f0m6xsto | 231 | Apple Music和网易云音乐学生订阅优惠 |
| 17 | cmpvbocmd0003r67obv3td4sp | 224 | 找谁问问题 |
| 18 | cmq1zen2v000rr6yg1ur7el4t | 222 | 出国用成绩单等材料怎么办？ |
| 19 | cmq1zen25000lr6ygsuqgjaqt | 219 | 大学生医疗费用零星报销需要什么材料？ |
| 20 | cmq1zemwk0003r6ygovowleh6 | 200 | 在南京大学入党的基本资格条件是什么？ |
| 21 | cmq0xjuqn0003r6tsjk9snf6x | 199 | 智慧团建系统密码忘了怎么重置？ |
| 22 | cmpzhm0nj000lr6vc5fc2awwr | 162 | 国外交换有哪两种方式？ |
| 23 | cmpwc2vce000br6dkqu0m3xl4 | 152 | 仙林校区快递站地址怎么填？ |
| 24 | cmpzhm0n5000fr6vcp05f23we | 147 | 交换生是什么？ |

### Batch 08 — 保研转专业-高优先（20 张）

| # | ID | 字数 | 规则数 | summary |
|---|-----|------|-------|---------|
| 1 | cmpytxczm0003r6004bfjhhh1 | 737 | 3 | 南京大学有哪些课程替代体系？ |
| 2 | cmpz8ochv001tr6005z1m6i4q | 2970 | 2 | 各二次选拔项目考什么？ |
| 3 | cmpz8ochl001rr600oxkqgt7e | 1235 | 2 | 什么是二次选拔？ |
| 4 | cmpzhm0m60003r6vcyz31g1jc | 961 | 2 | 保研机会时间线 |
| 5 | cmpz8oci4001vr600v4uenrma | 833 | 2 | 南京大学转专业有哪些限制？ |
| 6 | cmpz7puwb001br600hc9vrj9s | 749 | 2 | 辅修怎么选课、怎么申请？ |
| 7 | cmq4uk1hh000hr6twppe3nd2i | 662 | 2 | 想进数学学院，大一要达到什么水平？ |
| 8 | cmpz8ocgc001hr600nt90qmkl | 515 | 2 | 大类分流有哪些选择 |
| 9 | cmpzhm0lr0001r6vcuxnaatd8 | 512 | 2 | 推免名额是什么？ |
| 10 | cmpzhm0mc0005r6vcohxb7m3q | 495 | 2 | 保研去向怎么选？ |
| 11 | cmq4uk1hf000fr6tw6ngv07x9 | 470 | 2 | 2024级数理大类分流名额 |
| 12 | cmpz8ocgu001lr600p4gnmnjp | 382 | 2 | 分流志愿怎么填 |
| 13 | cmq4uk1hj000jr6twoba3gigh | 334 | 2 | 数理大类转热门工科有什么注意事项？ |
| 14 | cmpz7puwi001dr600n1w20l0a | 333 | 2 | 辅修学士学位在学信网上怎么显示？ |
| 15 | cmq3icb0u000dr6ewf6bswq4a | 273 | 2 | 南京大学工科试验班分流到哪些学院？ |
| 16 | cmpz8ocfz001fr600degmsp0w | 236 | 2 | 哪些学生需要参加大类分流 |
| 17 | cmpz8ocgm001jr60046mxgdbw | 214 | 2 | 二次分流什么时候进行 |
| 18 | cmq4tt162001pr6d0en13pkib | 173 | 2 | 软件工程转入条件是什么？ |
| 19 | cmq4tt160001nr6d0inluh73l | 127 | 2 | 电子信息类转入难不难？ |
| 20 | cmq4tt15u001hr6d0jbmqor4p | 63 | 2 | 化学、生物、天文等拔尖班难不难考？ |

### Batch 09 — 保研转专业-中优先（20 张）

| # | ID | 字数 | summary |
|---|-----|------|---------|
| 1 | cmpz7puvz0017r600krjct4dd | 1051 | 第二学士学位是什么？ |
| 2 | cmq3icazg0009r6ewa4mmux36 | 920 | 南京大学法学转专业的准入门槛 |
| 3 | cmq4ol5jw000br6o44jsoprtu | 863 | 转CS机试怎么准备？ |
| 4 | cmq4tt14f000fr6d0z0h4dgbf | 846 | 大一和大二转电子分别要满足哪些要求？ |
| 5 | cmpytxcyy0001r6003rszrak0 | 762 | 保研课是什么？ |
| 6 | cmq4tt14i000hr6d0g7sklqq5 | 707 | 转电子的课程怎么学？ |
| 7 | cmq4tt14c000dr6d03ph3d850 | 692 | 转电子难度大不大？ |
| 8 | cmq3iowx60005r6z44q1ri1ks | 634 | 地学大类转专业有哪些策略？ |
| 9 | cmq3icayd0007r6ewvyio0kh4 | 613 | 如何通过二次拔尖进入光电实验班？ |
| 10 | cmq4ol5j90003r6o4j9fc4zbu | 599 | 转CS的官方流程和准入标准是什么？ |
| 11 | cmq5dmt3v000zr6bcrgkjct3c | 576 | 技术科学试验班转专业限制 |
| 12 | cmq4ol5jr0009r6o4u43ynq7f | 568 | 转CS笔试考什么？ |
| 13 | cmq4tt16a001vr6d09nko3u1f | 558 | 转数学有几种途径？ |
| 14 | cmpz7puw60019r6001kiockz8 | 543 | 辅修值不值得修？ |
| 15 | cmq3iowwy0003r6z4uyfp1ckk | 535 | 地学大类四个院系的分流难度 |
| 16 | cmq4ol5iv0001r6o4znkc3d1u | 519 | 转CS难不难？ |
| 17 | cmq3imyvo000fr6ew4pej6c2l | 493 | 转软件工程机试考什么？ |
| 18 | cmq4tt167001tr6d0ynx763vg | 433 | 智能科学与技术转入条件是什么？ |
| 19 | cmq4tt15x001lr6d0av67im9i | 428 | 计算机科学与技术转入条件是什么？ |
| 20 | cmpz8oci9001xr600zba5n5on | 406 | 什么是跨专业准出？ |

### Batch 10 — 保研转专业-低优先（17 张）

| # | ID | 字数 | summary |
|---|-----|------|---------|
| 1 | cmq4tt14k000jr6d0bis2hbc5 | 396 | 转电子面试考什么？ |
| 2 | cmq4ol5k6000fr6o48genwo1r | 393 | 转CS对原专业课有什么影响？ |
| 3 | cmq4tt15o0019r6d0gagbub7x | 346 | 匡亚明学院拔尖班考什么？ |
| 4 | cmq4tt148000br6d0zdor6pg0 | 341 | 化生大类转专业有什么具体建议？ |
| 5 | cmq4tt15r001dr6d0j7t9fqyz | 326 | 数学拔尖班考什么？ |
| 6 | cmq4tt15m0017r6d0ilojyn6f | 324 | 哪些学生不能参加拔尖计划选拔？ |
| 7 | cmpz8ochd001pr600fz1d9yj6 | 303 | 转专业对分流有什么影响 |
| 8 | cmq4tt15i0013r6d0yxg6bd6b | 298 | 南京大学一共有几次转专业机会？ |
| 9 | cmq4tt164001rr6d01tznm0e5 | 296 | 人工智能转入条件是什么？ |
| 10 | cmpz8och5001nr600ktwv6plg | 265 | 特殊招生类型怎么分流 |
| 11 | cmq4tt15l0015r6d0sq4dc91y | 260 | 转专业之前需要了解什么课程体系知识？ |
| 12 | cmq4tt15p001br6d0re446t7q | 242 | 计算机拔尖班考什么？ |
| 13 | cmq4tt16c001xr6d08q71pp7y | 197 | 法学转入条件是什么？ |
| 14 | cmq4tt15w001jr6d03bahrk3v | 168 | 大一结束跨大类准入的整体情况 |
| 15 | cmq4ol5kb000hr6o4km4l7c5i | 164 | 转CS还是转AI？ |
| 16 | cmq4ol5k1000dr6o4q4nlmehv | 159 | 转CS面试需要准备什么？ |
| 17 | cmq4tt15t001fr6d0davjeke5 | 79 | 物理学拔尖班考什么？ |

### Batch 11 — 校园服务大卡（苏州校区9张 + 院系结构20张 + 生活指南25张）

合并为 3 个子批次：

**Batch 11a — 苏州校区（9 张）**

| # | ID | 字数 | summary |
|---|-----|------|---------|
| 1 | cmq2ef52i0003r6g8pnao4zlz | 150 | 苏州校区可以点外卖吗？ |
| 2 | cmq2ef5450009r6g8ke8pzdle | 561 | 苏州校区校外出行怎么走？ |
| 3 | cmq2ef5270001r6g8u9a7ibop | 211 | 苏州校区食堂有哪些？ |
| 4 | cmq2ef54d000br6g8hp9det18 | 207 | 苏州校区附近有哪些大型商圈？ |
| 5 | cmq2ef53v0007r6g8b9kym2ky | 132 | 苏州校区校内出行方便吗？ |
| 6 | cmq2ef53e0005r6g8hkucp6m7 | 123 | 苏州校区有便利店、打印店和理发店吗？ |
| 7 | cmq2ef54w000fr6g8mg7snf20 | 120 | 苏州校区校内就医怎么走？ |
| 8 | cmq2ef54j000dr6g8w7wu0wpr | 113 | 苏州校区网购快递地址是什么？ |
| 9 | cmq2ef55d000hr6g8iwsi8gpe | 84 | 苏州校区校外就医去哪里？ |

**Batch 11b — 院系结构（20 张）**

| # | ID | 字数 | 规则数 | summary |
|---|-----|------|-------|---------|
| 1 | cmq3ad9br0001r6e44fvpc9p8 | 279 | 3 | 马克思主义学院是什么？ |
| 2 | cmq5dmt3j000vr6bcymwb7i8o | 1746 | 2 | 集电方向学什么？ |
| 3 | cmq5dmt3c000tr6bc3shtoq4t | 1689 | 2 | 智软和传统软工有什么不同？ |
| 4 | cmq3f4q530003r6ew99ihij1d | 747 | 2 | 南京大学各院系分别在哪个校区？ |
| 5 | cmq3ad9c30003r6e471o4if34 | 346 | 2 | 马克思主义理论专业学什么？ |
| 6 | cmq3ad9c80005r6e4qvo2wevk | 294 | 2 | 马克思主义理论专业保研率怎么样？ |
| 7 | cmq4tt13o0001r6d046axdeod | 196 | 2 | 化生大类包含哪些学科方向？ |
| 8 | cmq5dmt34000rr6bcplxs3hb6 | 1767 | 1 | 想分流到智科，大一要重点准备哪些课？ |
| 9 | cmq5dmt2g000hr6bcu73o9i60 | 1403 | 1 | 智能软件工程CPL等课程怎么学？ |
| 10 | cmq5dmt3q000xr6bcjsn8076b | 1193 | 1 | 技科里的数经适合谁？ |
| 11 | cmq5dmt2b000fr6bcjyhjwa7w | 1100 | 1 | 智能软件工程和传统软件工程有什么区别？ |
| 12 | cmq5dmt0w0001r6bc8ptsl8c6 | 1067 | 1 | 要不要报技术科学试验班？ |
| 13 | cmq5dmt1e0003r6bc4y1txdbe | 959 | 1 | 技科大一上预分流怎么影响方向选择？ |
| 14 | cmpzhm0mn0009r6vcfmnpuoey | 925 | 1 | 南京大学有哪些学院和本科专业？（中篇） |
| 15 | cmq5dmt1u0009r6bc2zzmbm5a | 806 | 1 | 智能科学与技术是什么专业？ |
| 16 | cmq5dmt26000dr6bc7wh9qetm | 640 | 1 | 智科值不值得报？ |
| 17 | cmq5dmt2l000jr6bc7sb9byvl | 558 | 1 | 集成电路设计与集成系统专业学什么？ |
| 18 | cmpzhm0ms000br6vcgp6bmxr6 | 537 | 1 | 南京大学有哪些学院和本科专业？（下篇） |
| 19 | cmpzhm0mh0007r6vchzxvysyy | 414 | 1 | 南京大学有哪些学院和本科专业？（上篇） |
| 20 | cmq4uk1hb000dr6twe9wiynjq | 370 | 1 | 数理大类包括哪些学院？ |

**Batch 11c — 生活指南（25 张）**

| # | ID | 字数 | 规则数 | summary |
|---|-----|------|-------|---------|
| 1 | cmpwb6d420003r6oo1s7whnmx | 961 | 2 | 南大宿舍生活设施怎么样？ |
| 2 | cmpwb6d4c0007r6ooi88smm1m | 414 | 2 | 仙林校区宿舍条件怎么样？ |
| 3 | cmq3f4q5h0005r6ew46izcrba | 369 | 2 | 大气科学学院本科有哪些专业？ |
| 4 | cmq2hqg840003r6po4jmtdkee | 116 | 2 | 鼓楼校区周边有哪些地铁站？ |
| 5 | cmpwb6d480005r6oo3hda4qm2 | 1562 | 1 | 鼓楼校区各宿舍楼条件怎么样？ |
| 6 | cmq2hqg900009r6po8pl7g2oq | 753 | 1 | 仙林校区一组团附近有哪些商铺？ |
| 7 | cmq26flgn001lr6yg3ch1wojq | 621 | 1 | 南大新生如何选择笔记本电脑？ |
| 8 | cmq39j73z0001r6ewcyvu9b9a | 615 | 1 | 鼓楼校区校外有哪些觅食推荐？ |
| 9 | cmq1zemwx0005r6ygz3bio54v | 482 | 1 | 新生是否需要迁户口？ |
| 10 | cmq0um08s0007r62coon0ynhk | 474 | 1 | 拿到教材书名后，怎么找电子版？ |
| 11 | cmq5dmt4g0019r6bcvxftnzdf | 461 | 1 | 大学社团整体是什么样的？ |
| 12 | cmq5dmt4u001dr6bcb0xsywuv | 454 | 1 | 五育时长是什么？ |
| 13 | cmq5dmt4n001br6bcbc4r2pxk | 386 | 1 | 志愿时长每学期要求多少小时？ |
| 14 | cmpwb6d3t0001r6ooa1rblb1i | 379 | 1 | 南大新生宿舍怎么分配？ |
| 15 | cmpwcy6iz0007r668q79oqwri | 358 | 1 | 南大有哪些食堂福利和餐券？ |
| 16 | cmq26flcd000zr6ygopdtjjkx | 351 | 1 | 收到邮件时，怎么核实发件人？ |
| 17 | cmpwb6d4g0009r6oo7mx9wooo | 332 | 1 | 苏州校区和浦口校区宿舍条件怎么样？ |
| 18 | cmq2hqg9b000br6poqz2npx24 | 319 | 1 | 仙林宿舍：电费充值注意事项 |
| 19 | cmpwcy6ik0001r668xndq36i8 | 299 | 1 | 新生入学有哪些免费吃饭的机会？ |
| 20 | cmpwcy6iw0005r668e8da3ajb | 227 | 1 | 怎么通过劳育或义工岗在食堂吃饭？ |
| 21 | cmpwcy6io0003r668jd4jji02 | 215 | 1 | 怎么通过学术活动蹭饭？ |
| 22 | cmq1zemxz000br6ygv5x6g31p | 212 | 1 | 宿舍分配的时间线是怎样的？ |
| 23 | cmq2hqg7b0001r6po2brtcnea | 172 | 1 | 新生报到当天怎么去鼓楼校区？ |
| 24 | cmq2hqg9f000dr6po940ne7e2 | 115 | 1 | 浦口校区食堂就餐指南 |
| 25 | cmq0um08j0005r62cf5kloxsl | 58 | 1 | 新生报到要带什么材料？ |

### Batch 12 — 其他 + 新生入学（22 张）

| # | ID | 字数 | 规则数 | summary |
|---|-----|------|-------|---------|
| 1 | cmq26flge001jr6ygntk9gyoj | 863 | 3 | 南大紫荆PT站是什么？ |
| 2 | cmpzhm0oi000zr6vcb1d9i0qz | 803 | 2 | 什么情况下会被退学？ |
| 3 | cmq0um07x0003r62c4h7z2mgu | 663 | 2 | 出国读硕士，授课型和研究型有什么区别？ |
| 4 | cmpzhm0ob000xr6vcgweib895 | 777 | 1 | 什么情况下可能被开除学籍？ |
| 5 | cmq3imyx5000hr6ewrdhkt3i0 | 671 | 1 | 如何判断AI给出的答案是否可靠？ |
| 6 | cmpzhm0oo0011r6vcdfw6gfuv | 552 | 1 | 退学警示期、退学影响和取消学籍有什么区别？ |
| 7 | cmpuwnly00001r6zor27efwkw | 326 | 1 | 南哪助手是什么组织？ |
| 8 | cmq0um06k0001r62c5fz6z0xl | 298 | 1 | 学术不端包括哪些行为？ |
| 9 | cmpuwnlya0005r6zoeu9c4kjv | 281 | 1 | 如何加入南哪助手团队 |
| 10 | cmq3iowxw000br6z49dn99uir | 273 | 1 | 地学大类就业前景如何？ |
| 11 | cmpuwnly80003r6zowvkxfjqz | 207 | 1 | 如何向南哪助手投稿 |
| 12 | cmpv76cx10009r6potthsebu9 | 301 | 2 | 兼职诈骗有哪些常见套路 |
| 13 | cmpv76cwi0005r6po8i8f4wap | 230 | 2 | 如何识别和防范电话诈骗 |
| 14 | cmpv76cxx000jr6po599u4mby | 112 | 2 | 到付快递诈骗怎么识别 |
| 15 | cmpv76cv80001r6potimgqndi | 359 | 1 | 如何识别和防范校园推销诈骗 |
| 16 | cmq90hq8u0001r63osjjwgxvx | 357 | 1 | 新生入学困难补助在哪里申请？ |
| 17 | cmpv76cxl000fr6pocl8thuut | 279 | 1 | QQ盗号诈骗怎么识别和应对 |
| 18 | cmpv76cwp0007r6po48hdp714 | 223 | 1 | 校园贷有什么危害 |
| 19 | cmpv76cxr000hr6po7s8zpvyu | 223 | 1 | 网恋/感情诈骗有哪些特征 |
| 20 | cmpv76cx9000br6po4kfib3s3 | 220 | 1 | "免费学技能"类诈骗怎么识别 |
| 21 | cmpv76cxf000dr6po0uyox5xd | 166 | 1 | 如何防范针对家长的诈骗 |
| 22 | cmpv76cvs0003r6ponydhi282 | 140 | 1 | 如何验证对方是否是南大学长学姐 |

### Batch 13 — 零散小 tag（7 张）

| # | ID | 字数 | tag | summary |
|---|-----|------|-----|---------|
| 1 | cmq0xw0k50001r61owvudqbcg | 550 | 竞赛科研 | 创新项目从申报到结题的完整流程 |
| 2 | cmq1s3xjg0001r69wue8bv1uk | 762 | 党团建设 | 递交入党申请书后，怎样成为入党积极分子？ |
| 3 | cmq1zemx70007r6ygrrahr506 | 280 | 奖助学金 | 南京大学学生征兵的基本条件和报名流程 |
| 4 | cmq1zen2p000pr6ygqys8kkhv | 877 | 成绩管理 | 成绩更正该怎么走？ |
| 5 | cmq5dmt1j0005r6bcz73fp1gw | 620 | 专业分流 | 技科课程组是什么？ |
| 6 | cmq5dmt1p0007r6bcr1jzncgh | 428 | 专业分流 | 技科课程组选错了怎么办？ |
| 7 | cmq5dmt2z000pr6bcyr2tz1yk | 596 | 课程学习 | 数经大一两门经济课怎么学？ |

### Batch 14 — 大类分流 + 专业选择（3 张）

| # | ID | 字数 | tag | summary |
|---|-----|------|-----|---------|
| 1 | cmpzhm0n0000dr6vcjp69vet4 | 662 | 大类分流 | 港澳台/内高班/民族单列/学科特长综评分流 |
| 2 | cmq4tt1470009r6d04g98cqbc | 415 | 大类分流 | 化生大类分流压力大吗？ |
| 3 | cmq5dmt2v000nr6bc66ng380r | 767 | 专业选择 | 数字经济专业怎么样？ |

---

## 每批执行流程

```
1. 我读取该批所有卡片的 body + sourceExcerpt
2. 逐张改写 body（空行分段 + 列表 + 步骤编号，保持学长语气）
3. 输出 dry-run JSON：[{ id, summary, oldBody, newBody }]
4. 你确认 → 我写库（Prisma update，设 verificationStatus: NEEDS_REVIEW）
5. 回查验证：抽查 3-5 张，确认信息未丢失、语气未变味
```

## 进度跟踪

| 批次 | 卡片数 | 状态 | 完成时间 |
|------|--------|------|----------|
| Batch 01 | 22 | ✅ 完成（14张改写） | 2026-06-26 |
| Batch 02 | 20 | ✅ 完成（9张改写） | 2026-06-26 |
| Batch 03 | 17 | ✅ 完成（1张改写） | 2026-06-26 |
| Batch 04 | 30 | ✅ 完成（10张改写） | 2026-06-26 |
| Batch 05 | 30 | ✅ 完成（13张改写） | 2026-06-26 |
| Batch 06 | 30 | ✅ 完成（7张改写） | 2026-06-26 |
| Batch 07 | 24 | ✅ 完成（3张改写） | 2026-06-26 |
| Batch 08 | 20 | ✅ 完成（6张改写） | 2026-06-26 |
| Batch 09 | 20 | ✅ 完成（13张改写） | 2026-06-26 |
| Batch 10 | 17 | ✅ 完成（13张改写） | 2026-06-26 |
| Batch 11a | 9 | ✅ 完成（0张改写） | 2026-06-26 |
| Batch 11b | 20 | ✅ 完成（12张改写） | 2026-06-26 |
| Batch 11c | 25 | ✅ 完成（4张改写） | 2026-06-26 |
| Batch 12 | 22 | ✅ 完成（4张改写） | 2026-06-26 |
| Batch 13 | 7 | ✅ 完成（4张改写） | 2026-06-26 |
| Batch 14 | 3 | ✅ 完成（0张改写） | 2026-06-26 |
| **合计** | **316** | | |
