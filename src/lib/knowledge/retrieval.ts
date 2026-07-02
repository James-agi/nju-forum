import type { KnowledgeCard } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeQuestionText } from "@/lib/knowledge/validation";

type JiebaLike = { cut(text: string, hmm?: boolean): string[] };
let jiebaInstance: JiebaLike | null | undefined;
async function getJieba() {
  if (jiebaInstance !== undefined) return jiebaInstance;
  try {
    const m = (await import("@node-rs/jieba")) as { Jieba: new () => JiebaLike };
    jiebaInstance = new m.Jieba();
  } catch {
    jiebaInstance = null;
  }
  return jiebaInstance;
}

export type RetrievalCard = Pick<KnowledgeCard, "id"|"summary"|"body"|"sourceExcerpt"|"sourceUrl"|"sourceDescription"|"sourceType"|"verificationStatus"|"domainTag"|"createdAt"|"updatedAt"|"archivedAt">;
export interface RetrievalResult { card: RetrievalCard; score: number; matchedTerms: string[]; }
export interface EvidenceEvaluation { sufficient: boolean; reason?: "EMPTY"|"ARCHIVED"|"UNRELATED"|"NEEDS_REVIEW"|"PREFILTER_PASSED"; cards: RetrievalResult[]; }

const STOP = new Set(["怎么","如何","什么","一下","可以","需要","有没有","请问","这个","那个","是否","能否","能不能","怎么样","为什么"]);
const GENERIC = new Set(Array.from(STOP).concat(["南京","大学","南大","南京大学","学校","相关","问题","信息","内容","规定","流程","办法","申请","办理","知道","了解","新生","入学"]));
const SPEC = new Set(["报到","修读","选课","保研","军训","宿舍","床位","医保","学费","缴费","学籍","体检","户口","档案","院系","竞赛","科研","食堂","校车","vpn","一卡通","校园卡","图书馆","奖学金","助学金","转专业","三三制","鼓楼","仙林","浦口","苏州","美食","推荐","辅修","交换"]);
const ALIAS = [{k:["怎么修","如何修","修什么"],t:["修读"]},{k:["怎么选","如何选"],t:["选课"]},{k:["怎么交","如何交"],t:["缴费"]},{k:["哪里住","住哪里"],t:["宿舍"]}];

function isSpec(t:string){const n=t.toLowerCase();if(GENERIC.has(n))return false;if(SPEC.has(n))return true;if(/^[a-z0-9]{2,}$/i.test(n))return true;return n.length>=3;}
function scTerm(t:string,f:string){if(!isSpec(t))return f==="summary"?1:0;if(f==="summary")return t.length>=5?7:t.length>=3?5:3;if(f==="body")return t.length>=5?5:t.length>=3?3:2;if(f==="domain")return t.length>=3?2:1;return 1;}

export async function extractRetrievalTerms(question:string){
  const n=normalizeQuestionText(question);const t=new Set<string>();
  Array.from(SPEC).forEach(s=>{if(n.includes(s))t.add(s);});
  const jieba=await getJieba();
  if(jieba){const words=jieba.cut(n,true);words.forEach(w=>{const x=w.trim().toLowerCase();if(x.length>=2&&!STOP.has(x))t.add(x);});}
  else{const chunks=n.match(/[0-9a-zA-Z\u3400-\u9fff]{2,}/g)??[];for(const c of chunks){if(!STOP.has(c))t.add(c);if(/[\u3400-\u9fff]/.test(c)&&c.length>3){for(let s=2;s<=Math.min(5,c.length);s++){for(let i=0;i<=c.length-s;i++){const g=c.slice(i,i+s);if(!STOP.has(g))t.add(g);}}}}}
  ALIAS.forEach(a=>{if(a.k.some(k=>n.includes(k)))a.t.forEach(s=>t.add(s));});
  const arr=Array.from(t).filter(s=>s.length>=2).sort((a,b)=>b.length-a.length);
  const spec=arr.filter(s=>SPEC.has(s));const rest=arr.filter(s=>!SPEC.has(s));return spec.concat(rest).slice(0,15);
}

export function scoreCard(card:RetrievalCard,terms:string[]){
  const sm=card.summary.toLowerCase();const bd=card.body.toLowerCase();const dm=card.domainTag.toLowerCase();const sd=card.sourceDescription.toLowerCase();const mt:string[]=[];let sc=0;
  for(const t of terms){const nt=t.toLowerCase();let m=false;if(sm.includes(nt)){sc+=scTerm(nt,"summary");m=true;}if(bd.includes(nt)){sc+=scTerm(nt,"body");m=true;}if(dm.includes(nt)){sc+=scTerm(nt,"domain");m=true;}if(sd.includes(nt)){sc+=scTerm(nt,"source");m=true;}if(m)mt.push(t);}
  if(card.verificationStatus==="VERIFIED")sc+=1;if(card.verificationStatus==="NEEDS_REVIEW")sc-=1;if(card.sourceType==="OFFICIAL")sc+=1;
  return{score:Math.max(0,sc),matchedTerms:Array.from(new Set(mt))};
}

export async function retrieveKnowledgeCards(question:string,limit=5){
  const terms=await extractRetrievalTerms(question);if(terms.length===0)return[];
  const or=terms.flatMap(t=>[{summary:{contains:t,mode:"insensitive"as const}},{body:{contains:t,mode:"insensitive"as const}},{domainTag:{contains:t,mode:"insensitive"as const}},{sourceDescription:{contains:t,mode:"insensitive"as const}}]);
  const cards=await db.knowledgeCard.findMany({where:{archivedAt:null,OR:or},take:50,orderBy:[{verificationStatus:"asc"},{updatedAt:"desc"}],select:{id:true,summary:true,body:true,sourceExcerpt:true,sourceUrl:true,sourceDescription:true,sourceType:true,verificationStatus:true,domainTag:true,createdAt:true,updatedAt:true,archivedAt:true}});
  return cards.map(c=>({card:c,...scoreCard(c,terms)})).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||b.card.updatedAt.getTime()-a.card.updatedAt.getTime()).slice(0,limit);
}

const MIN_SUFFICIENT_SCORE = 12;
const MIN_STRONG_TERM_COUNT = 2;
const MIN_SINGLE_ANCHOR_SCORE = 16;

function hasStrongEvidence(result: RetrievalResult) {
  const summary = result.card.summary.toLowerCase();
  const body = result.card.body.toLowerCase();
  const strongTerms = result.matchedTerms.filter(isSpec);
  const contentStrongTerms = strongTerms.filter((term) => {
    const normalized = term.toLowerCase();
    return summary.includes(normalized) || body.includes(normalized);
  });

  const hasLongContentAnchor = contentStrongTerms.some((term) => term.length >= 4);
  const hasMultipleContentAnchors = contentStrongTerms.length >= MIN_STRONG_TERM_COUNT;

  return (
    result.score >= MIN_SUFFICIENT_SCORE &&
    (hasMultipleContentAnchors ||
      (hasLongContentAnchor && result.score >= MIN_SINGLE_ANCHOR_SCORE))
  );
}

export function evaluateEvidence(results:RetrievalResult[]):EvidenceEvaluation{
  if(results.length===0)return{sufficient:false,reason:"EMPTY",cards:[]};
  const active=results.filter(r=>!r.card.archivedAt);if(active.length===0)return{sufficient:false,reason:"ARCHIVED",cards:[]};
  const topScore=active[0]?.score??0;
  if(topScore<MIN_SUFFICIENT_SCORE||!hasStrongEvidence(active[0]))return{sufficient:false,reason:"UNRELATED",cards:[]};
  const usable=active.filter(r=>r.score>=Math.max(MIN_SUFFICIENT_SCORE,topScore-2)&&hasStrongEvidence(r)).slice(0,3);
  if(usable.every(r=>r.card.verificationStatus==="NEEDS_REVIEW"))return{sufficient:false,reason:"NEEDS_REVIEW",cards:[]};
  return{sufficient:true,reason:"PREFILTER_PASSED",cards:usable};
}
