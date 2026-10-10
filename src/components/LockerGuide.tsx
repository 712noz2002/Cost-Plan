const LOCKERS = [
  { no: '01', label: '보관함' },
  { no: '02', label: '보관함' },
  { no: '03', label: '보관함' },
  { no: '04', label: '보관함' },
] as const;

/** 네 개의 수동식 보관함 번호 안내. 화면은 번호를 강조할 뿐 보관함을 전자적으로 열거나 제어하지 않는다. */
export function LockerGuide({ active }: { active: string }) {
  return (
    <div className="lockers" role="list" aria-label="실물 카드 보관함 번호">
      {LOCKERS.map((l) => (
        <div key={l.no} role="listitem" className={`locker${l.no === active ? ' on' : ''}`} aria-current={l.no === active}>
          <b>{l.no}</b>
          <span>{l.no === active ? '여기예요' : l.label}</span>
        </div>
      ))}
    </div>
  );
}
