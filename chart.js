// Chart.js functionality for Wealth Grow Dashboard
// Load investment growth chart for user dashboard
function loadInvestmentGrowthChart() {
    console.log('loadInvestmentGrowthChart called');
    console.log('currentUser:', currentUser);
    if (!currentUser) {
        console.log('No currentUser, returning');
        return;
    }

    const ctx = document.getElementById('growth-chart');
    if (!ctx) {
        console.warn('Growth chart canvas not found');
        return;
    }
    console.log('Canvas found, proceeding with chart creation');
    console.log('Chart.js available:', typeof Chart);

    // Create sample data based on user's investment progress
    const investedAmount = currentUser.invested_amount || 0;
    const currentBalance = currentUser.current_balance || 0;
    const targetAmount = currentUser.target_amount || 0;

    // Generate chart data points (simulate growth over time)
    const labels = [];
    const balanceData = [];
    const targetData = [];

    // Get investment start date or use current date minus some days
    const startDate = currentUser.created_at ? new Date(currentUser.created_at) : new Date();
    startDate.setDate(startDate.getDate() - 30); // Assume 30 days ago

    const today = new Date();
    const daysDiff = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));

    for (let i = 0; i <= daysDiff; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

        // Calculate balance growth over time (linear progression for demo)
        const progress = i / daysDiff;
        const balance = investedAmount + (currentBalance - investedAmount) * progress;
        balanceData.push(balance.toFixed(2));

        // Target line (remains constant)
        targetData.push(targetAmount);
    }

    // Destroy existing chart if it exists
    if (window.investmentChart) {
        window.investmentChart.destroy();
    }

    // Create new chart
    window.investmentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Current Balance',
                    data: balanceData,
                    borderColor: '#FFD700',
                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#FFD700',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Target Amount',
                    data: targetData,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.1,
                    pointBackgroundColor: '#4CAF50',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#ffffff',
                        font: {
                            size: 12,
                            weight: '500'
                        },
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#FFD700',
                    bodyColor: '#ffffff',
                    borderColor: '#FFD700',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            const currencySymbol = getCurrencySymbol(currentUser.currency);
                            return `${context.dataset.label}: ${currencySymbol}${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Date',
                        color: '#B0B0B0',
                        font: {
                            size: 14,
                            weight: '500'
                        }
                    },
                    ticks: {
                        color: '#B0B0B0',
                        font: {
                            size: 11
                        },
                        maxTicksLimit: 7
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.2)'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Amount',
                        color: '#B0B0B0',
                        font: {
                            size: 14,
                            weight: '500'
                        }
                    },
                    ticks: {
                        color: '#B0B0B0',
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            const currencySymbol = getCurrencySymbol(currentUser.currency);
                            return currencySymbol + value.toLocaleString();
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.2)'
                    }
                }
            },
            elements: {
                point: {
                    hoverBorderWidth: 3
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            }
        }
    });

    console.log('Investment growth chart loaded successfully');
}