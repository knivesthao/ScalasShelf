// Level checker for English lines.
//
// STARTER LISTS: common beginner vocabulary assembled for the prototype. They are
// placeholders until partner-school teachers validate proper A1/A2 lists (see
// docs/plans/MVP.md → "Pedagogy partner"). B1/B2 have no list yet, so nothing is
// flagged at those levels.

import { tokenize, bareWord, type Level } from './format';

const A1 = `
a an the and or but so because if when then than not no yes
i me my mine you your yours he him his she her hers it its we us our they them their
this that these those here there what who where why how which whose
am is are was were be been being do does did done have has had having
can could will would shall should may might must
go goes went gone come came get got give gave take took make made
see saw look watch hear listen say said tell told talk speak ask answer
know think want like love need help try use find put keep let
eat drink sleep wake walk run jump swim sit stand play work read write draw sing dance
open close start stop wait carry bring buy sell pay cook wash clean live stay leave
learn study teach meet call show feel laugh cry smile
good bad big small little long short tall old new young happy sad hot cold warm cool
fast slow late early easy hard nice beautiful pretty ugly clean dirty full empty
hungry thirsty tired sick well right wrong same different many much more most some any
all every each other another only very too also again always never often sometimes now today
tonight tomorrow yesterday soon later before after up down in on at to from with without
of for about into out over under near far behind next between inside outside around
one two three four five six seven eight nine ten eleven twelve twenty hundred first second last
red blue green yellow black white brown orange pink purple gray color
man woman boy girl child children baby person people friend family mother father mom dad
brother sister grandmother grandfather son daughter teacher student doctor farmer
home house room school class book pen paper bag table chair bed door window
food rice water milk tea coffee egg fish chicken meat fruit banana mango apple soup bread
cat dog bird cow pig duck horse animal tree flower grass garden field farm river lake sea
sun moon star sky rain wind cloud day night morning afternoon evening week month year time
hour minute clock money shop market road car bus bike boat train city village town country
hand head eye ear nose mouth face hair arm leg foot feet body
name thing way place game toy ball song story picture phone
hello hi bye goodbye please thanks thank sorry okay ok oh wow
`;

const A2 = `
buffalo harvest plant grow seed
bright dark quiet loud strong weak brave kind angry afraid scared worried excited
careful dangerous safe important interesting boring funny strange
remember forget believe decide hope plan travel visit arrive return follow
lose win break fix build climb fall catch throw pull push hold hide
enough together alone almost already still just maybe perhaps really
sunset sunrise mountain hill forest path bridge temple festival holiday
kitchen bathroom roof wall floor neighbor neighbour
breakfast lunch dinner vegetable salt sugar sticky
weather storm season rainy dry
job problem idea reason question lesson homework test
fly flew swam ran ate drank slept woke
`;

function toSet(list: string): Set<string> {
  return new Set(list.split(/\s+/).filter(Boolean).map((w) => w.toLowerCase()));
}

const LISTS: Partial<Record<Level, Set<string>>> = {
  A1: toSet(A1),
  A2: new Set([...toSet(A1), ...toSet(A2)]),
};

/** Naive English lemma candidates: "walked" → walk, "babies" → baby, "we're" → we. */
function candidates(word: string): string[] {
  const w = word.replace(/['’](s|re|ll|ve|d|m)$/, '').replace(/n['’]t$/, '');
  const out = [w];
  if (w.endsWith('ies')) out.push(w.slice(0, -3) + 'y');
  if (w.endsWith('es')) out.push(w.slice(0, -2));
  if (w.endsWith('s')) out.push(w.slice(0, -1));
  if (w.endsWith('ed')) out.push(w.slice(0, -2), w.slice(0, -1), w.slice(0, -3));
  if (w.endsWith('ing')) out.push(w.slice(0, -3), w.slice(0, -3) + 'e', w.slice(0, -4));
  if (w.endsWith('er')) out.push(w.slice(0, -2), w.slice(0, -3));
  if (w.endsWith('est')) out.push(w.slice(0, -3), w.slice(0, -4));
  if (w.endsWith('ly')) out.push(w.slice(0, -2));
  return out;
}

export function hasWordList(level: Level): boolean {
  return !!LISTS[level];
}

/**
 * Words in the line that aren't on the level's list (deduplicated, in order).
 * `allowed` words are skipped: the episode's speaker names and the words it teaches
 * (starred vocab). Capitalized words mid-sentence are treated as names and skipped too.
 */
export function wordsAboveLevel(text: string, level: Level, allowed: string[] = []): string[] {
  const list = LISTS[level];
  if (!list) return [];
  const skip = new Set(allowed.flatMap((n) => n.toLowerCase().split(/\s+/)).filter(Boolean));
  const flagged: string[] = [];
  let sentenceStart = true;
  for (const tk of tokenize(text)) {
    const raw = tk.t.trim().replace(/^[\p{P}\p{S}]+/u, '');
    const word = bareWord(tk.t);
    const properNoun = !sentenceStart && /^\p{Lu}/u.test(raw) && word !== 'i';
    sentenceStart = /[.!?]["'”’)]*\s*$/.test(tk.t);
    if (!word || /^\d+$/.test(word) || properNoun || skip.has(word) || flagged.includes(word)) continue;
    if (!candidates(word).some((c) => list.has(c))) flagged.push(word);
  }
  return flagged;
}
