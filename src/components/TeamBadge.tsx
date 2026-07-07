import { team } from '../data/teams';

export default function TeamBadge({ code }: { code: string }) {
  const t = team(code);
  return (
    <span className="badge" style={{ background: t.color, color: t.text }}>
      {t.short}
    </span>
  );
}
