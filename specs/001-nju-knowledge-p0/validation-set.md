# P0 Freshman-Entry Validation Set

Purpose: use these 30 prompts to validate that P0 answers only from prepared
knowledge cards, cites sources, and records gaps when evidence is missing.

## Covered Questions

Prepare cards before validation for at least these 24 stable freshman-entry
questions.

- [ ] V001 三三制是什么？
- [ ] V002 三三制课程通常应该怎么规划？
- [ ] V003 新生选课前需要先了解哪些基本规则？
- [ ] V004 通识课、专业课和体育课在选课时有什么区别？
- [ ] V005 新生报到一般需要准备哪些材料？
- [ ] V006 学籍信息核对通常要看哪些字段？
- [ ] V007 校园卡主要用于哪些场景？
- [ ] V008 校园网账号和统一身份认证有什么关系？
- [ ] V009 新生如何判断自己属于哪个院系或专业培养方案？
- [ ] V010 培养方案里学分要求应该怎么看？
- [ ] V011 课程先修要求是什么意思？
- [ ] V012 退选课程前应该确认哪些风险？
- [ ] V013 补退选和正常选课有什么区别？
- [ ] V014 课程容量满了通常意味着什么？
- [ ] V015 体育课选课需要注意什么？
- [ ] V016 新生体检信息应该从哪里核实？
- [ ] V017 学生证或校园卡丢失后应该优先找哪个渠道确认补办流程？
- [ ] V018 学院通知和学校通知的来源应该如何区分？
- [ ] V019 保研相关政策应该优先看哪类来源？
- [ ] V020 转专业规则应该优先看哪类来源？
- [ ] V021 如何判断一条学长学姐经验是否已经核实？
- [ ] V022 没有来源链接但有来源说明的卡片能不能用于回答？
- [ ] V023 已核实卡片和未核实卡片在回答里应该怎么区分？
- [ ] V024 过时或存疑的卡片应该如何处理？

## Expected Gap Questions

Leave these 6 questions uncovered unless a real card is deliberately added. They
should return `GAP_RECORDED`, not a general answer.

- [ ] V025 某个具体宿舍楼今年的入住时间是什么？
- [ ] V026 今年迎新晚会具体是哪一天？
- [ ] V027 某门课今年某位老师的点名频率如何？
- [ ] V028 某个社团今年招新群号是多少？
- [ ] V029 某个学院今年保研名额具体有多少？
- [ ] V030 今年某场活动的报名截止时间是什么？

## Pass Criteria

- Covered questions return `ANSWERED` with at least one visible citation.
- No answer contains claims outside cited cards.
- Uncovered questions return `GAP_RECORDED` and create or reuse a gap.
- P0 non-goal prompts return `OUT_OF_SCOPE`.
