export function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="detail-item"><span>{label}</span><strong>{value || "미정"}</strong></div>;
}
