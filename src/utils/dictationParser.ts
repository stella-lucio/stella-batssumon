import type { ParsedSheet } from '../types';

/**
 * OCR 텍스트(또는 직접 붙여넣은 텍스트)를 회차별 문장 목록으로 바꾼다.
 *
 * 원칙: 번호·페이지 번호·빈 줄 같은 "형식 노이즈"만 정리하고
 * 문장 내용 자체는 고치지 않는다. 최종 수정은 부모가 편집 화면에서 한다.
 */

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

/** "1회", "1회차", "제1회", "[2회]", "3회 받아쓰기" … */
const ROUND_RE = /^[\s[(【<〈]*(?:제\s*)?(\d{1,2})\s*회\s*(?:차)?\s*(?:받아\s*쓰기)?\s*[\]\)】>〉:：.\-–—]*\s*(.*)$/;

/** 번호 형식: "1." "1)" "(1)" "1번" "1 -" "1-" "①" "1 학교…" */
const NUMBER_RE =
  /^\s*(?:\(\s*(\d{1,2})\s*\)|(\d{1,2})\s*(?:[.)．。,:：]|번(?!째)|-|\s[-–—~])|([①-⑳])|(\d{1,2})\s+(?=[가-힣"'“‘]))\s*/;

/** 번호 뒤에 붙는 이상한 특수문자 (따옴표는 문장 일부일 수 있으므로 제외) */
const LEADING_JUNK_RE = /^[\s.,:;·•\-–—_~|`*>\])}]+/;
const TRAILING_JUNK_RE = /[\s|_~`*•]+$/;

const PAGE_NUMBER_RES = [
  /^[-–—\s]*\d{1,3}[-–—\s]*$/, // "3", "- 3 -"
  /^\d{1,3}\s*\/\s*\d{1,3}$/, // "1/2"
  /^(?:p|page)\.?\s*\d{1,3}$/i, // "p.3"
  /^\d{1,3}\s*(?:쪽|페이지)$/, // "3쪽"
];

const HEADER_KEYWORD_RE =
  /급수표|^\s*(?:이름|날짜|학년|반|번호|점수)\s*[:：]|^\s*\d+\s*학년\s*(?:\d+\s*반)?\s*(?:\d+\s*번)?\s*(?:이름.*)?$/;
const GRADE_RE = /(\d{1,2})\s*급/;
const SENTENCE_END_RE = /[.?!。…"'”’」)]$/;
const HANGUL_RE = /[가-힣]/;

function isPageNumber(line: string): boolean {
  return PAGE_NUMBER_RES.some((re) => re.test(line));
}

/** 문장 앞뒤 노이즈와 중복 공백만 정리 */
export function cleanSentence(raw: string): string {
  return raw
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .replace(LEADING_JUNK_RE, '')
    .replace(TRAILING_JUNK_RE, '')
    .replace(/\s+([.?!,])/g, '$1')
    .trim();
}

/** 줄 맨 앞의 번호를 떼어낸다. 번호가 있었는지도 함께 돌려준다. */
export function stripNumbering(line: string): { text: string; numbered: boolean; number?: number } {
  const m = NUMBER_RE.exec(line);
  if (!m) return { text: cleanSentence(line), numbered: false };
  const rest = line.slice(m[0].length);
  // 번호만 있고 내용이 없으면 번호 줄로 취급
  let number: number | undefined;
  if (m[1] ?? m[2] ?? m[4]) number = Number(m[1] ?? m[2] ?? m[4]);
  else if (m[3]) number = CIRCLED.indexOf(m[3]) + 1;
  return { text: cleanSentence(rest), numbered: true, number };
}

interface RoundHeader {
  number: number;
  rest: string;
}

/** 회차 표기인지 판별. 문장 속 "3회 연속…" 같은 경우를 오인하지 않도록 뒤따르는 내용을 확인한다. */
export function detectRoundHeader(line: string): RoundHeader | null {
  const m = ROUND_RE.exec(line.trim());
  if (!m) return null;
  const rest = (m[2] ?? '').trim();
  if (rest === '') return { number: Number(m[1]), rest: '' };
  // 뒤에 번호가 이어지면 "1회 1. 학교에 갑니다." 형태
  if (NUMBER_RE.test(rest)) return { number: Number(m[1]), rest };
  // 날짜/괄호 정보만 붙은 경우: "2회 (9월 3일)"
  if (/^[\d\s월일./()~\-–]+$/.test(rest)) return { number: Number(m[1]), rest: '' };
  return null;
}

interface WorkingRound {
  name: string;
  lines: string[];
}

export function parseDictationText(input: string): ParsedSheet {
  const rawLines = input
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\t/g, ' ').trim());

  let suggestedTitle: string | undefined;
  const rounds: WorkingRound[] = [];
  let current: WorkingRound | null = null;
  let roundsDetected = false;

  for (const line of rawLines) {
    if (line === '') continue;

    const header = detectRoundHeader(line);
    if (header) {
      roundsDetected = true;
      current = { name: `${header.number}회`, lines: [] };
      rounds.push(current);
      if (header.rest) current.lines.push(header.rest);
      continue;
    }

    // 급수표 제목/머리글 줄
    if (!NUMBER_RE.test(line) && HEADER_KEYWORD_RE.test(line)) {
      const g = GRADE_RE.exec(line);
      if (g && !suggestedTitle) suggestedTitle = `${g[1]}급`;
      continue;
    }
    if (!NUMBER_RE.test(line) && !SENTENCE_END_RE.test(line)) {
      const g = GRADE_RE.exec(line);
      if (g && line.length <= 12) {
        if (!suggestedTitle) suggestedTitle = `${g[1]}급`;
        continue;
      }
    }

    if (!current) {
      current = { name: '받아쓰기', lines: [] };
      rounds.push(current);
    }
    current.lines.push(line);
  }

  const parsedRounds = rounds
    .map((r) => ({ name: r.name, sentences: linesToSentences(r.lines) }))
    .filter((r) => r.sentences.length > 0);

  return {
    suggestedTitle,
    rounds: parsedRounds.length > 0 ? parsedRounds : [],
    roundsDetected: roundsDetected && parsedRounds.some((r) => r.name !== '받아쓰기'),
  };
}

/** 한 회차의 줄 목록을 문장 목록으로 변환 */
export function linesToSentences(lines: string[]): string[] {
  const numberedCount = lines.filter((l) => NUMBER_RE.test(l) && stripNumbering(l).text !== '').length;
  const numberedMode = numberedCount >= 2;

  const sentences: string[] = [];
  let forceNew = true;

  for (const line of lines) {
    // 번호만 있는 줄(표 형태 급수표) → 다음 줄이 새 문장
    if (/^\s*(?:\(?\d{1,2}\)?[.)번]?|[①-⑳])\s*$/.test(line)) {
      forceNew = true;
      continue;
    }
    if (isPageNumber(line)) continue;

    const { text, numbered } = stripNumbering(line);
    if (text === '') {
      if (numbered) forceNew = true;
      continue;
    }
    // 한글이 하나도 없는 줄은 OCR 노이즈로 본다 (예: "|||", "ee —")
    if (!HANGUL_RE.test(text)) continue;

    const last = sentences.length - 1;
    const shouldJoin = numberedMode && !numbered && !forceNew && last >= 0 && !SENTENCE_END_RE.test(sentences[last]);

    if (shouldJoin) {
      sentences[last] = cleanSentence(`${sentences[last]} ${text}`);
    } else {
      sentences.push(text);
    }
    forceNew = false;
  }
  return sentences;
}

/** 직접 입력: 줄바꿈 기준으로 한 문제씩. 회차 표기가 있으면 회차도 나눈다. */
export function parseManualInput(input: string): ParsedSheet {
  return parseDictationText(input);
}
