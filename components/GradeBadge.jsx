const GRADE_COLOR = { A: "#1F6F4A", "A-": "#1F6F4A", "B+": "#F2A93B", B: "#F2A93B", C: "#C1443B" };

export function gradeFromOnTime(pct) {
  if (pct >= 96) return "A";
  if (pct >= 92) return "A-";
  if (pct >= 89) return "B+";
  if (pct >= 84) return "B";
  return "C";
}

// reviews: array of {on_time, condition}
export function computeStats(reviews) {
  if (!reviews || reviews.length === 0) {
    return { onTime: null, grade: "—", reviewCount: 0, conditionAvg: null };
  }
  const onTimeHits = reviews.filter((r) => r.on_time).length;
  const onTimePct = Math.round((onTimeHits / reviews.length) * 100);
  const conditionAvg = (reviews.reduce((sum, r) => sum + r.condition, 0) / reviews.length).toFixed(1);
  return { onTime: onTimePct, grade: gradeFromOnTime(onTimePct), reviewCount: reviews.length, conditionAvg };
}

export default function GradeBadge({ grade, reviewCount }) {
  const color = GRADE_COLOR[grade] || "#5b6570";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-11 h-11 flex items-center justify-center border-2 rounded-sm"
        style={{ borderColor: color, color }}
      >
        <span className="text-lg font-bold leading-none">{grade}</span>
      </div>
      <span className="text-[9px] text-steelgray uppercase tracking-wide">
        {reviewCount > 0 ? `${reviewCount} review${reviewCount > 1 ? "s" : ""}` : "unrated"}
      </span>
    </div>
  );
}
