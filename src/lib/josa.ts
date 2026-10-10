/** 한글 조사 선택 (받침 유무). 한글이 아니거나 끝이 기호면 마지막 한글/숫자 글자를 기준으로 한다. */

function lastBatchim(word: string): { hasBatchim: boolean; isRieul: boolean } {
  for (let i = word.length - 1; i >= 0; i--) {
    const code = word.charCodeAt(i);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const jong = (code - 0xac00) % 28;
      return { hasBatchim: jong !== 0, isRieul: jong === 8 };
    }
    if (/[0-9]/.test(word[i])) {
      // 영(0)·일(1)·삼(3)·육(6)·칠(7)·팔(8)은 받침이 있고 나머지는 없음
      return { hasBatchim: '013678'.includes(word[i]), isRieul: word[i] === '1' || word[i] === '7' || word[i] === '8' };
    }
  }
  return { hasBatchim: false, isRieul: false };
}

/** josa('흔적', '을', '를') → '을', josa('흐름','을','를') → '를' */
export function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  return lastBatchim(word).hasBatchim ? withBatchim : withoutBatchim;
}

export const eulReul = (w: string) => w + josa(w, '을', '를');
export const iGa = (w: string) => w + josa(w, '이', '가');
export const eunNeun = (w: string) => w + josa(w, '은', '는');
export const gwaWa = (w: string) => w + josa(w, '과', '와');
export const euroRo = (w: string) => {
  const b = lastBatchim(w);
  return w + (b.hasBatchim && !b.isRieul ? '으로' : '로');
};
