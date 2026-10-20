// קישורים חיצוניים לסרגל העליון. רק כאן, לא בקוד מפוזר.
// ערך 'TBD' מסתיר את הכפתור.

export const LINKS = {
  devChat: 'https://claude.ai/code/session_01Pz9cxVqKnkKDcZ66Wn2BYH',
  researchProject: 'TBD',
} as const

export const isSet = (url: string) => Boolean(url) && url !== 'TBD'
