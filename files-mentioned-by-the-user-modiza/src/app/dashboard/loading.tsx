export default function DashboardLoading() {
  return <section className="section dashboard-shell" aria-busy="true" aria-label="운영 대시보드를 불러오는 중">
    <div className="container">
      <div className="dashboard-loading hero-loading" />
      <div className="dashboard-loading tabs-loading" />
      <div className="dashboard-loading task-loading" />
      <div className="dashboard-loading-grid">
        <div className="dashboard-loading stat-loading" />
        <div className="dashboard-loading stat-loading" />
        <div className="dashboard-loading stat-loading" />
        <div className="dashboard-loading stat-loading" />
      </div>
      <div className="dashboard-loading content-loading" />
    </div>
  </section>;
}
