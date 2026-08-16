const DIRECTION_STYLES = {
  good: { badge: "bg-green-500/15 text-green-400 border-green-500/40", icon: "▲" },
  bad: { badge: "bg-red-500/15 text-red-400 border-red-500/40", icon: "▼" },
  neutral: { badge: "bg-blue-500/15 text-blue-400 border-blue-500/40", icon: "•" },
};

// Renders the "this week's number" graphic that leads a blog post — a plain
// data readout (eyebrow label, big value, colored delta badge, source line),
// deliberately no photos or people. `direction` is set explicitly by whoever
// writes the stat (good/bad/neutral) rather than inferred from the sign of
// the number, since "rates up" and "diesel up" mean opposite things for a
// trucker even though both are a positive percentage.
// variant="full" is the large version on the article page; variant="compact"
// is the smaller version on list/preview cards.
export default function BlogStatHeader({ stat, variant = "full" }) {
  if (!stat || !stat.value) return null;
  const styles = DIRECTION_STYLES[stat.direction] || DIRECTION_STYLES.neutral;

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-xl font-semibold text-white">{stat.value}</span>
        {stat.delta && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-mono border rounded-full px-2 py-0.5 ${styles.badge}`}>
            <span>{styles.icon}</span>
            {stat.delta}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-5 py-4 mb-8">
      {stat.label && (
        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-2">
          {stat.label}
        </p>
      )}
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-5xl font-semibold text-white">{stat.value}</span>
        {stat.delta && (
          <span className={`inline-flex items-center gap-1 text-xs font-mono border rounded-full px-2.5 py-1 ${styles.badge}`}>
            <span>{styles.icon}</span>
            {stat.delta}
          </span>
        )}
      </div>
      {stat.context && <p className="text-xs text-gray-500 mt-2">{stat.context}</p>}
    </div>
  );
}
