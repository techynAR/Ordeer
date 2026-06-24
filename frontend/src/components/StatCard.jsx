export default function StatCard({ label, value, meta, danger }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value${danger ? ' stat-value-danger' : ''}`}>{value}</div>
      {meta && <div className="stat-meta">{meta}</div>}
    </div>
  )
}
