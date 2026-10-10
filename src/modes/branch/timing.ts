/**
 * 선택 과정 기록기 (v7).
 *
 * 한 문항에서 "상황 읽기"와 "선택 행동"을 구분한다. 모든 간격은 단조 시계(performance.now)로 계산하고,
 * 기록용 절대 시각(epoch)은 따로 저장한다.
 *   shownAt            질문 화면이 표시된 시각 (상황 읽기 시작)
 *   decisionStartAt    [선택지 보기]로 선택지가 활성화된 시각 — 선택 시간 측정의 시작점(상황 읽기 시간 제외)
 *   firstTapAt         처음 선택지를 고른 시각
 *   firstOptionId      처음 고른 선택지
 *   finalizedAt        [이 선택으로 계속하기]로 확정한 시각
 *   tapHistory         [{optionId, atMs, kind:'choose'|'change'|'clear'}]  atMs = decisionStart 이후 경과 ms
 *   revisionCount      "이미 선택돼 있던 다른 선택지"로 바꾼 횟수 (같은 항목 연속 탭은 제외)
 *   firstTapDurationMs 활성화 → 최초 선택
 *   postFirstDurationMs 최초 선택 → 확정   (firstTapDurationMs + postFirstDurationMs === decisionDurationMs)
 *   decisionDurationMs 활성화 → 확정
 *
 * 같은 항목을 다시 누르는 것은 기록에 남기지 않고(무시), ignoredRepeatTaps로만 센다.
 * 확정 직후 연속 탭(더블탭)은 finalize 이후 tap()이 거부되므로 이중 확정이 생기지 않는다.
 */
import type { OptionDef } from '../../spec/types';

export interface Clock {
  /** 단조 증가 ms (performance.now 등) */
  mono(): number;
  /** 에폭 ms (Date.now 등) */
  epoch(): number;
}

export const systemClock: Clock = {
  mono: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  epoch: () => Date.now(),
};

export interface TapEvent {
  optionId: string;
  /** 활성화(decisionStart) 이후 경과 ms */
  atMs: number;
  kind: 'choose' | 'change' | 'clear';
}

export interface StepTiming {
  shownAt: number;
  decisionStartAt: number;
  firstTapAt: number;
  finalizedAt: number;
  firstOptionId: string;
  /** 상황 읽기 시간 = 선택지 활성화 − 화면 표시 */
  readDurationMs: number;
  firstTapDurationMs: number;
  postFirstDurationMs: number;
  decisionDurationMs: number;
  tapHistory: TapEvent[];
  revisionCount: number;
  ignoredRepeatTaps: number;
}

export class ChoiceRecorder {
  private readonly shownMono: number;
  private readonly shownEpoch: number;
  private startMono: number | null = null;
  private startEpoch = 0;
  private history: TapEvent[] = [];
  private firstMono = 0;
  private firstEpoch = 0;
  private selected: OptionDef | null = null;
  private revisions = 0;
  private ignored = 0;
  private done = false;

  constructor(
    private readonly options: readonly OptionDef[],
    private readonly clock: Clock = systemClock,
  ) {
    this.shownMono = clock.mono();
    this.shownEpoch = clock.epoch();
  }

  get started(): boolean {
    return this.startMono !== null;
  }
  get selectedOptionId(): string | null {
    return this.selected?.id ?? null;
  }
  get tapCount(): number {
    return this.history.length;
  }

  /** [선택지 보기]. 두 번 눌러도 처음 시각만 유효. */
  start(): void {
    if (this.done || this.startMono !== null) return;
    this.startMono = this.clock.mono();
    this.startEpoch = this.clock.epoch();
  }

  /** 선택지 터치. 시작 전/확정 후/모르는 항목이면 false. 이미 선택된 같은 항목이면 무시(false). */
  tap(optionId: string): boolean {
    if (this.done || this.startMono === null) return false;
    const opt = this.options.find((o) => o.id === optionId);
    if (!opt) return false;
    if (this.selected && this.selected.id === opt.id) {
      this.ignored++;
      return false;
    }
    const nowMono = this.clock.mono();
    const kind: TapEvent['kind'] = this.selected ? 'change' : 'choose';
    if (!this.selected) {
      this.firstMono = nowMono;
      this.firstEpoch = this.clock.epoch();
    } else {
      this.revisions++;
    }
    this.history.push({ optionId: opt.id, atMs: Math.max(0, Math.round(nowMono - this.startMono)), kind });
    this.selected = opt;
    return true;
  }

  /** 확정. 시작하지 않았거나 선택이 없으면 예외. */
  finalize(): StepTiming {
    if (this.done) throw new Error('이미 확정된 기록입니다.');
    if (this.startMono === null || !this.selected || this.history.length === 0) {
      throw new Error('선택지를 열고 하나를 고른 뒤에만 확정할 수 있습니다.');
    }
    this.done = true;
    const nowMono = this.clock.mono();
    const decision = Math.max(0, Math.round(nowMono - this.startMono));
    const firstTap = Math.min(decision, this.history[0].atMs);
    return {
      shownAt: this.shownEpoch,
      decisionStartAt: this.startEpoch,
      firstTapAt: this.firstEpoch,
      finalizedAt: this.clock.epoch(),
      firstOptionId: this.history[0].optionId,
      readDurationMs: Math.max(0, Math.round(this.startMono - this.shownMono)),
      firstTapDurationMs: firstTap,
      postFirstDurationMs: decision - firstTap,
      decisionDurationMs: decision,
      tapHistory: this.history.slice(),
      revisionCount: this.revisions,
      ignoredRepeatTaps: this.ignored,
    };
  }
}

/** 저장된 기록의 유효성: 음수/NaN이면 화면에 시간을 표시하지 않는다. */
export function timingValid(t: StepTiming): boolean {
  const ok = (n: number) => Number.isFinite(n) && n >= 0;
  return ok(t.firstTapDurationMs) && ok(t.postFirstDurationMs) && ok(t.decisionDurationMs) && t.firstTapDurationMs + t.postFirstDurationMs === t.decisionDurationMs;
}
