// Chart.js visualizations for SEAS Dashboard
let riskDoughnutChart = null;
let departmentBarChart = null;

function renderRiskDistributionChart(canvasId, stats) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  if (riskDoughnutChart) {
    riskDoughnutChart.destroy();
  }

  const critical = stats.criticalCount || 0;
  const moderate = stats.moderateCount || 0;
  const safe = stats.safeCount || 0;

  riskDoughnutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Critical Risk (<65% / Low Marks)', 'Moderate Warning (65-75%)', 'Safe / On Track (>75%)'],
      datasets: [
        {
          data: [critical, moderate, safe],
          backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            padding: 14,
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 }
          }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const total = critical + moderate + safe;
              const val = context.raw || 0;
              const pct = total ? ((val / total) * 100).toFixed(1) : 0;
              return ` ${context.label}: ${val} students (${pct}%)`;
            }
          }
        }
      },
      cutout: '72%'
    }
  });
}

function renderDepartmentChart(canvasId, deptList) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  if (departmentBarChart) {
    departmentBarChart.destroy();
  }

  const labels = deptList.map((d) => d._id || 'Unknown');
  const criticalData = deptList.map((d) => d.critical || 0);
  const moderateData = deptList.map((d) => d.moderate || 0);
  const safeData = deptList.map((d) => d.safe || 0);

  departmentBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Critical Risk',
          data: criticalData,
          backgroundColor: '#ef4444',
          borderRadius: 6
        },
        {
          label: 'Moderate Warning',
          data: moderateData,
          backgroundColor: '#f59e0b',
          borderRadius: 6
        },
        {
          label: 'Safe',
          data: safeData,
          backgroundColor: '#10b981',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { display: false }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: { color: '#f1f5f9' }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, font: { family: "'Plus Jakarta Sans', sans-serif" } }
        }
      }
    }
  });
}

window.renderRiskDistributionChart = renderRiskDistributionChart;
window.renderDepartmentChart = renderDepartmentChart;
