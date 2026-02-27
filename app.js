        // Register the datalabels plugin
        Chart.register(ChartDataLabels);

        let charts = {};
        let allTransactions = [];
        let drilldownState = {
            mode: 'account', // 'account' or 'category'
            level: 0, // 0 = accounts/categories, 1 = categories/subcategories, 2 = subcategories/vendors, 3 = vendors/transactions, 4 = transactions
            account: null,
            category: null,
            subcategory: null,
            vendor: null
        };
        let currentView = 'chart'; // 'chart' or 'table'
        let currentData = { labels: [], data: [] }; // Store current chart data for table view
        let tableSortState = { column: null, direction: 'asc' }; // Track table sort state
        let totalDisplayMode = 'total'; // 'total', 'monthly', 'fortnightly'

        document.getElementById('csvFile').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                const csv = e.target.result;
                processCSV(csv);
            };
            reader.readAsText(file);
        });

        function processCSV(csv) {
            const lines = csv.split('\n');
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

            const transactions = [];
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;

                const values = parseCSVLine(lines[i]);
                if (values.length < headers.length) continue;

                const transaction = {};
                headers.forEach((header, index) => {
                    transaction[header] = values[index] ? values[index].replace(/"/g, '').trim() : '';
                });

                // Parse amounts
                transaction.debitAmount = parseFloat(transaction.Debit) || 0;
                transaction.creditAmount = parseFloat(transaction.Credit) || 0;

                // Clean up vendor name
                transaction.CleanVendor = cleanVendorName(transaction.Details);

                // Skip internal transfers
                if (transaction.Category !== 'Financial' || transaction.Subcategory !== 'Transfers') {
                    transactions.push(transaction);
                }
            }

            allTransactions = transactions;
            displayInsights(transactions);
        }

        function parseCSVLine(line) {
            const values = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];

                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    values.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current);
            return values;
        }

        function cleanVendorName(vendorName) {
            if (!vendorName) return vendorName;

            let cleaned = vendorName;

            // Remove common prefixes
            const prefixes = [
                'Purchase At ',
                'Purchase From ',
                'Online Purchase From ',
                'Online purchase from ',
                'Sq *',
                'SQ *',
                'Zlr*',
                'ZLR*'
            ];

            for (const prefix of prefixes) {
                if (cleaned.startsWith(prefix)) {
                    cleaned = cleaned.substring(prefix.length);
                }
            }

            // Trim whitespace
            cleaned = cleaned.trim();

            // Convert to title case for better readability
            cleaned = cleaned.split(' ')
                .map(word => {
                    // Keep common acronyms uppercase
                    if (word.match(/^[A-Z]{2,}$/)) return word;
                    // Otherwise title case
                    return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
                })
                .join(' ');

            return cleaned;
        }

        function displayInsights(transactions) {
            // Hide upload section and show top button
            document.getElementById('uploadSection').style.display = 'none';
            document.getElementById('uploadBtnTop').style.display = 'inline-block';

            // Show dashboard
            document.getElementById('dashboard').classList.remove('hidden');

            // Create charts
            createAccountChart(transactions);
        }

        function createAccountChart(transactions) {
            updateDrilldownChart();
        }

        function updateDrilldownChart() {
            // Filter transactions based on current drill-down state
            let filteredTransactions = allTransactions.filter(t => t.debitAmount > 0);

            if (drilldownState.account) {
                filteredTransactions = filteredTransactions.filter(t => t.Account === drilldownState.account);
            }

            if (drilldownState.category) {
                filteredTransactions = filteredTransactions.filter(t => t.Category === drilldownState.category);
            }

            if (drilldownState.subcategory) {
                filteredTransactions = filteredTransactions.filter(t => t.Subcategory === drilldownState.subcategory);
            }

            if (drilldownState.vendor) {
                filteredTransactions = filteredTransactions.filter(t => t.CleanVendor === drilldownState.vendor);
            }

            let data, labels, title, breadcrumb;

            if (drilldownState.mode === 'account') {
                // Account mode: Account -> Category -> Subcategory -> Vendor -> Transactions
                if (drilldownState.level === 0) {
                    // Show accounts
                    const accountSpending = {};
                    filteredTransactions.forEach(t => {
                        if (t.Account) {
                            accountSpending[t.Account] = (accountSpending[t.Account] || 0) + t.debitAmount;
                        }
                    });
                    const sorted = Object.entries(accountSpending).sort((a, b) => b[1] - a[1]);
                    labels = sorted.map(a => a[0]);
                    data = sorted.map(a => a[1]);
                    title = 'Spending by Account';
                    breadcrumb = '';
                } else if (drilldownState.level === 1) {
                    // Show categories for selected account
                    const categorySpending = {};
                    filteredTransactions.forEach(t => {
                        if (t.Category) {
                            categorySpending[t.Category] = (categorySpending[t.Category] || 0) + t.debitAmount;
                        }
                    });
                    const sorted = Object.entries(categorySpending).sort((a, b) => b[1] - a[1]);
                    labels = sorted.map(c => c[0]);
                    data = sorted.map(c => c[1]);
                    title = 'Categories';
                    breadcrumb = `<a class="breadcrumb-link" onclick="resetDrilldown()">All Accounts</a><span class="breadcrumb-separator">></span>${drilldownState.account}`;
                } else if (drilldownState.level === 2) {
                    // Show subcategories
                    const subcategorySpending = {};
                    filteredTransactions.forEach(t => {
                        if (t.Subcategory) {
                            subcategorySpending[t.Subcategory] = (subcategorySpending[t.Subcategory] || 0) + t.debitAmount;
                        }
                    });
                    const sorted = Object.entries(subcategorySpending).sort((a, b) => b[1] - a[1]);
                    labels = sorted.map(s => s[0]);
                    data = sorted.map(s => s[1]);
                    title = 'Subcategories';
                    breadcrumb = `<a class="breadcrumb-link" onclick="resetDrilldown()">All Accounts</a><span class="breadcrumb-separator">></span><a class="breadcrumb-link" onclick="drillToAccount('${drilldownState.account}')">${drilldownState.account}</a><span class="breadcrumb-separator">></span>${drilldownState.category}`;
                } else if (drilldownState.level === 3) {
                    // Show vendors
                    const vendorSpending = {};
                    filteredTransactions.forEach(t => {
                        if (t.CleanVendor) {
                            vendorSpending[t.CleanVendor] = (vendorSpending[t.CleanVendor] || 0) + t.debitAmount;
                        }
                    });
                    const sorted = Object.entries(vendorSpending).sort((a, b) => b[1] - a[1]);
                    labels = sorted.map(v => v[0]);
                    data = sorted.map(v => v[1]);
                    title = 'Vendors';
                    breadcrumb = `<a class="breadcrumb-link" onclick="resetDrilldown()">All Accounts</a><span class="breadcrumb-separator">></span><a class="breadcrumb-link" onclick="drillToAccount('${drilldownState.account}')">${drilldownState.account}</a><span class="breadcrumb-separator">></span><a class="breadcrumb-link" onclick="drillToCategory('${drilldownState.category}')">${drilldownState.category}</a><span class="breadcrumb-separator">></span>${drilldownState.subcategory}`;
                } else if (drilldownState.level === 4) {
                    // Show transactions
                    title = 'Transactions';
                    breadcrumb = `<a class="breadcrumb-link" onclick="resetDrilldown()">All Accounts</a><span class="breadcrumb-separator">></span><a class="breadcrumb-link" onclick="drillToAccount('${drilldownState.account}')">${drilldownState.account}</a><span class="breadcrumb-separator">></span><a class="breadcrumb-link" onclick="drillToCategory('${drilldownState.category}')">${drilldownState.category}</a><span class="breadcrumb-separator">></span><a class="breadcrumb-link" onclick="drillToSubcategory('${drilldownState.subcategory}')">${drilldownState.subcategory}</a><span class="breadcrumb-separator">></span>${drilldownState.vendor}`;
                }
            } else {
                // Category mode: Category -> Subcategory -> Vendor -> Transactions
                if (drilldownState.level === 0) {
                    // Show categories
                    const categorySpending = {};
                    filteredTransactions.forEach(t => {
                        if (t.Category) {
                            categorySpending[t.Category] = (categorySpending[t.Category] || 0) + t.debitAmount;
                        }
                    });
                    const sorted = Object.entries(categorySpending).sort((a, b) => b[1] - a[1]);
                    labels = sorted.map(c => c[0]);
                    data = sorted.map(c => c[1]);
                    title = 'Spending by Category';
                    breadcrumb = '';
                } else if (drilldownState.level === 1) {
                    // Show subcategories for selected category
                    const subcategorySpending = {};
                    filteredTransactions.forEach(t => {
                        if (t.Subcategory) {
                            subcategorySpending[t.Subcategory] = (subcategorySpending[t.Subcategory] || 0) + t.debitAmount;
                        }
                    });
                    const sorted = Object.entries(subcategorySpending).sort((a, b) => b[1] - a[1]);
                    labels = sorted.map(s => s[0]);
                    data = sorted.map(s => s[1]);
                    title = 'Subcategories';
                    breadcrumb = `<a class="breadcrumb-link" onclick="resetDrilldown()">All Categories</a><span class="breadcrumb-separator">></span>${drilldownState.category}`;
                } else if (drilldownState.level === 2) {
                    // Show vendors
                    const vendorSpending = {};
                    filteredTransactions.forEach(t => {
                        if (t.CleanVendor) {
                            vendorSpending[t.CleanVendor] = (vendorSpending[t.CleanVendor] || 0) + t.debitAmount;
                        }
                    });
                    const sorted = Object.entries(vendorSpending).sort((a, b) => b[1] - a[1]);
                    labels = sorted.map(v => v[0]);
                    data = sorted.map(v => v[1]);
                    title = 'Vendors';
                    breadcrumb = `<a class="breadcrumb-link" onclick="resetDrilldown()">All Categories</a><span class="breadcrumb-separator">></span><a class="breadcrumb-link" onclick="drillToCategoryOnly('${drilldownState.category}')">${drilldownState.category}</a><span class="breadcrumb-separator">></span>${drilldownState.subcategory}`;
                } else if (drilldownState.level === 3) {
                    // Show transactions
                    title = 'Transactions';
                    breadcrumb = `<a class="breadcrumb-link" onclick="resetDrilldown()">All Categories</a><span class="breadcrumb-separator">></span><a class="breadcrumb-link" onclick="drillToCategoryOnly('${drilldownState.category}')">${drilldownState.category}</a><span class="breadcrumb-separator">></span><a class="breadcrumb-link" onclick="drillToSubcategoryOnly('${drilldownState.subcategory}')">${drilldownState.subcategory}</a><span class="breadcrumb-separator">></span>${drilldownState.vendor}`;
                }
            }

            document.getElementById('breadcrumb').innerHTML = breadcrumb;

            // Update category display
            let categoryDisplay = '';
            if (drilldownState.mode === 'account') {
                if (drilldownState.level === 0) categoryDisplay = 'All Accounts';
                else if (drilldownState.level === 1) categoryDisplay = drilldownState.account;
                else if (drilldownState.level === 2) categoryDisplay = drilldownState.category;
                else if (drilldownState.level === 3) categoryDisplay = drilldownState.subcategory;
            } else {
                if (drilldownState.level === 0) categoryDisplay = 'All Categories';
                else if (drilldownState.level === 1) categoryDisplay = drilldownState.category;
                else if (drilldownState.level === 2) categoryDisplay = drilldownState.subcategory;
            }
            document.getElementById('totalCategory').textContent = categoryDisplay;

            // Calculate totals for center display
            const totalSpent = filteredTransactions.reduce((sum, t) => sum + t.debitAmount, 0);
            const totalIncome = allTransactions.reduce((sum, t) => sum + t.creditAmount, 0);

            // Check if at transaction level (depends on mode)
            const atTransactionLevel = (drilldownState.mode === 'account' && drilldownState.level === 4) ||
                                       (drilldownState.mode === 'category' && drilldownState.level === 3);

            // If at transaction level, show transaction table
            if (atTransactionLevel) {
                currentData = { labels: null, data: null, transactions: filteredTransactions };
                renderTransactionTable(filteredTransactions);
                document.getElementById('accountChart').style.display = 'none';
                document.getElementById('chartTotal').classList.add('hidden');
                document.getElementById('accountTable').classList.remove('hidden');
                // Hide view toggle buttons at transaction level
                document.querySelector('.view-toggle').style.display = 'none';
            } else {
                // Store current data for table view (include filtered transactions for label calculations)
                currentData = { labels, data, transactions: filteredTransactions };
                // Show view toggle buttons
                document.querySelector('.view-toggle').style.display = 'flex';

                // Update the view based on current selection
                if (currentView === 'chart') {
                    renderChart(labels, data);
                    document.getElementById('accountTable').classList.add('hidden');
                    document.getElementById('accountChart').style.display = 'block';
                    document.getElementById('chartTotal').classList.remove('hidden');
                    // Update total
                    updateTotalDisplay(totalSpent, filteredTransactions);
                } else {
                    renderTable(labels, data);
                    document.getElementById('accountTable').classList.remove('hidden');
                    document.getElementById('accountChart').style.display = 'none';
                    document.getElementById('chartTotal').classList.add('hidden');
                }
            }
        }

        function renderChart(labels, data) {
            if (charts.account) charts.account.destroy();

            const ctx = document.getElementById('accountChart').getContext('2d');
            charts.account = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: [
                            '#10b981', '#047857', '#10b981', '#047857', '#10b981', '#047857',
                            '#10b981', '#047857', '#10b981', '#047857', '#10b981', '#047857'
                        ],
                        borderColor: '#0f0f0f',
                        borderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    cutout: '65%',
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = '$' + Math.round(context.parsed).toLocaleString();
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((context.parsed / total) * 100).toFixed(1) + '%';
                                    return label + ': ' + value + ' (' + percentage + ')';
                                }
                            }
                        },
                        datalabels: {
                            color: '#ffffff',
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
                                weight: '400',
                                size: 11
                            },
                            formatter: (value, ctx) => {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100);
                                if (percentage < 5) return '';
                                const label = ctx.chart.data.labels[ctx.dataIndex];

                                // Calculate the display amount based on current mode
                                let displayValue = value;
                                if (currentData.transactions) {
                                    // Filter transactions for this slice
                                    const sliceTransactions = currentData.transactions.filter(t => {
                                        if (drilldownState.mode === 'account') {
                                            if (drilldownState.level === 0) return t.Account === label;
                                            if (drilldownState.level === 1) return t.Category === label;
                                            if (drilldownState.level === 2) return t.Subcategory === label;
                                            if (drilldownState.level === 3) return t.CleanVendor === label;
                                        } else {
                                            if (drilldownState.level === 0) return t.Category === label;
                                            if (drilldownState.level === 1) return t.Subcategory === label;
                                            if (drilldownState.level === 2) return t.CleanVendor === label;
                                        }
                                        return false;
                                    });

                                    if (sliceTransactions.length > 0) {
                                        const dates = sliceTransactions.map(t => new Date(t['Transaction Date']));
                                        const minDate = new Date(Math.min(...dates));
                                        const maxDate = new Date(Math.max(...dates));
                                        const daysDiff = (maxDate - minDate) / (1000 * 60 * 60 * 24);

                                        if (totalDisplayMode === 'monthly') {
                                            const months = daysDiff / 30.44;
                                            displayValue = months > 0 ? value / months : value;
                                        } else if (totalDisplayMode === 'fortnightly') {
                                            const fortnights = daysDiff / 14;
                                            displayValue = fortnights > 0 ? value / fortnights : value;
                                        }
                                    }
                                }

                                const amount = '$' + Math.round(displayValue).toLocaleString();
                                return [label, amount];
                            },
                            display: true,
                            textAlign: 'center',
                            clip: false
                        }
                    },
                    onClick: (event, elements) => {
                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const label = labels[index];

                            if (drilldownState.mode === 'account') {
                                if (drilldownState.level === 0) {
                                    drilldownState.account = label;
                                    drilldownState.level = 1;
                                    updateDrilldownChart();
                                } else if (drilldownState.level === 1) {
                                    drilldownState.category = label;
                                    drilldownState.level = 2;
                                    updateDrilldownChart();
                                } else if (drilldownState.level === 2) {
                                    drilldownState.subcategory = label;
                                    drilldownState.level = 3;
                                    updateDrilldownChart();
                                } else if (drilldownState.level === 3) {
                                    drilldownState.vendor = label;
                                    drilldownState.level = 4;
                                    updateDrilldownChart();
                                }
                            } else {
                                if (drilldownState.level === 0) {
                                    drilldownState.category = label;
                                    drilldownState.level = 1;
                                    updateDrilldownChart();
                                } else if (drilldownState.level === 1) {
                                    drilldownState.subcategory = label;
                                    drilldownState.level = 2;
                                    updateDrilldownChart();
                                } else if (drilldownState.level === 2) {
                                    drilldownState.vendor = label;
                                    drilldownState.level = 3;
                                    updateDrilldownChart();
                                }
                            }
                        }
                    }
                }
            });
        }

        function renderTable(labels, data) {
            const total = data.reduce((sum, val) => sum + val, 0);
            let tableData = labels.map((label, i) => ({
                label,
                amount: data[i],
                percentage: (data[i] / total * 100)
            }));

            // Apply sorting if set
            if (tableSortState.column) {
                tableData.sort((a, b) => {
                    let valA = a[tableSortState.column];
                    let valB = b[tableSortState.column];

                    if (tableSortState.column === 'label') {
                        valA = valA.toLowerCase();
                        valB = valB.toLowerCase();
                    }

                    if (tableSortState.direction === 'asc') {
                        return valA > valB ? 1 : -1;
                    } else {
                        return valA < valB ? 1 : -1;
                    }
                });
            }

            let html = `
                <table>
                    <thead>
                        <tr>
                            <th class="sortable ${tableSortState.column === 'label' ? tableSortState.direction : ''}" onclick="sortTable('label')">Name</th>
                            <th class="amount-col sortable ${tableSortState.column === 'amount' ? tableSortState.direction : ''}" onclick="sortTable('amount')">Amount</th>
                            <th class="amount-col sortable ${tableSortState.column === 'percentage' ? tableSortState.direction : ''}" onclick="sortTable('percentage')">Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            tableData.forEach(row => {
                const clickable = `style="cursor: pointer;" onclick="handleTableClick('${row.label.replace(/'/g, "\\'")}')"`;
                html += `
                    <tr ${clickable}>
                        <td>${row.label}</td>
                        <td class="amount-col">$${Math.round(row.amount).toLocaleString()}</td>
                        <td class="amount-col">${row.percentage.toFixed(1)}%</td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
            `;

            document.getElementById('accountTable').innerHTML = html;
        }

        function sortTable(column) {
            if (tableSortState.column === column) {
                // Toggle direction
                tableSortState.direction = tableSortState.direction === 'asc' ? 'desc' : 'asc';
            } else {
                // New column, default to ascending
                tableSortState.column = column;
                tableSortState.direction = 'asc';
            }

            // Re-render table with current data
            renderTable(currentData.labels, currentData.data);
        }

        function handleTableClick(label) {
            if (drilldownState.mode === 'account') {
                if (drilldownState.level === 0) {
                    drilldownState.account = label;
                    drilldownState.level = 1;
                    updateDrilldownChart();
                } else if (drilldownState.level === 1) {
                    drilldownState.category = label;
                    drilldownState.level = 2;
                    updateDrilldownChart();
                } else if (drilldownState.level === 2) {
                    drilldownState.subcategory = label;
                    drilldownState.level = 3;
                    updateDrilldownChart();
                } else if (drilldownState.level === 3) {
                    drilldownState.vendor = label;
                    drilldownState.level = 4;
                    updateDrilldownChart();
                }
            } else {
                if (drilldownState.level === 0) {
                    drilldownState.category = label;
                    drilldownState.level = 1;
                    updateDrilldownChart();
                } else if (drilldownState.level === 1) {
                    drilldownState.subcategory = label;
                    drilldownState.level = 2;
                    updateDrilldownChart();
                } else if (drilldownState.level === 2) {
                    drilldownState.vendor = label;
                    drilldownState.level = 3;
                    updateDrilldownChart();
                }
            }
        }

        function renderTransactionTable(transactions) {
            let html = `
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Account</th>
                            <th class="amount-col">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            transactions.forEach(t => {
                html += `
                    <tr>
                        <td>${t['Transaction Date']}</td>
                        <td>${t.Details}</td>
                        <td>${t.Account}</td>
                        <td class="amount-col">$${t.debitAmount.toFixed(2)}</td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
            `;

            document.getElementById('accountTable').innerHTML = html;
        }

        function switchView(view) {
            currentView = view;

            // Update button states
            document.getElementById('chartViewBtn').classList.toggle('active', view === 'chart');
            document.getElementById('tableViewBtn').classList.toggle('active', view === 'table');

            // Show/hide appropriate view
            if (view === 'chart') {
                document.getElementById('accountChart').style.display = 'block';
                document.getElementById('accountTable').classList.add('hidden');
            } else {
                document.getElementById('accountChart').style.display = 'none';
                document.getElementById('accountTable').classList.remove('hidden');
                renderTable(currentData.labels, currentData.data);
            }
        }

        function resetDrilldown() {
            drilldownState.level = 0;
            drilldownState.account = null;
            drilldownState.category = null;
            drilldownState.subcategory = null;
            drilldownState.vendor = null;
            updateDrilldownChart();
        }

        function drillToAccount(account) {
            drilldownState.level = 1;
            drilldownState.account = account;
            drilldownState.category = null;
            drilldownState.subcategory = null;
            drilldownState.vendor = null;
            updateDrilldownChart();
        }

        function drillToCategory(category) {
            drilldownState.category = category;
            drilldownState.level = 2;
            drilldownState.subcategory = null;
            drilldownState.vendor = null;
            updateDrilldownChart();
        }

        function drillToSubcategory(subcategory) {
            drilldownState.subcategory = subcategory;
            drilldownState.level = 3;
            drilldownState.vendor = null;
            updateDrilldownChart();
        }

        function drillToCategoryOnly(category) {
            drilldownState.level = 1;
            drilldownState.category = category;
            drilldownState.subcategory = null;
            drilldownState.vendor = null;
            updateDrilldownChart();
        }

        function drillToSubcategoryOnly(subcategory) {
            drilldownState.level = 2;
            drilldownState.subcategory = subcategory;
            drilldownState.vendor = null;
            updateDrilldownChart();
        }

        function switchDrillMode(mode) {
            drilldownState.mode = mode;
            drilldownState.level = 0;
            drilldownState.account = null;
            drilldownState.category = null;
            drilldownState.subcategory = null;
            drilldownState.vendor = null;

            // Update button states
            document.getElementById('accountModeBtn').classList.toggle('active', mode === 'account');
            document.getElementById('categoryModeBtn').classList.toggle('active', mode === 'category');

            updateDrilldownChart();
        }

        function switchTotalMode(mode) {
            totalDisplayMode = mode;

            // Update button states
            document.getElementById('totalModeBtn').classList.toggle('active', mode === 'total');
            document.getElementById('monthlyModeBtn').classList.toggle('active', mode === 'monthly');
            document.getElementById('fortnightlyModeBtn').classList.toggle('active', mode === 'fortnightly');

            // Re-render current view to update the display
            updateDrilldownChart();
        }

        function goBackLevel() {
            if (drilldownState.level === 0) return; // Already at top level

            if (drilldownState.mode === 'account') {
                if (drilldownState.level === 4) {
                    // Go from transactions back to vendors
                    drilldownState.vendor = null;
                    drilldownState.level = 3;
                } else if (drilldownState.level === 3) {
                    // Go from vendors back to subcategories
                    drilldownState.subcategory = null;
                    drilldownState.level = 2;
                } else if (drilldownState.level === 2) {
                    // Go from subcategories back to categories
                    drilldownState.category = null;
                    drilldownState.level = 1;
                } else if (drilldownState.level === 1) {
                    // Go from categories back to accounts
                    drilldownState.account = null;
                    drilldownState.level = 0;
                }
            } else {
                if (drilldownState.level === 3) {
                    // Go from transactions back to vendors
                    drilldownState.vendor = null;
                    drilldownState.level = 2;
                } else if (drilldownState.level === 2) {
                    // Go from vendors back to subcategories
                    drilldownState.subcategory = null;
                    drilldownState.level = 1;
                } else if (drilldownState.level === 1) {
                    // Go from subcategories back to categories
                    drilldownState.category = null;
                    drilldownState.level = 0;
                }
            }

            updateDrilldownChart();
        }

        function updateTotalDisplay(totalSpent, transactions) {
            // Calculate date range from transactions
            if (!transactions || transactions.length === 0) {
                document.getElementById('totalAmount').textContent = '$0';
                document.getElementById('totalLabel').textContent = 'Total Spent';
                return;
            }

            const dates = transactions.map(t => new Date(t['Transaction Date']));
            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));
            const daysDiff = (maxDate - minDate) / (1000 * 60 * 60 * 24);

            let amount, label;

            if (totalDisplayMode === 'total') {
                amount = totalSpent;
                label = 'Total Spent';
            } else if (totalDisplayMode === 'monthly') {
                const months = daysDiff / 30.44; // Average days per month
                amount = months > 0 ? totalSpent / months : totalSpent;
                label = 'Avg Per Month';
            } else {
                const fortnights = daysDiff / 14;
                amount = fortnights > 0 ? totalSpent / fortnights : totalSpent;
                label = 'Avg Per Fortnight';
            }

            document.getElementById('totalAmount').textContent = '$' + Math.round(amount).toLocaleString();
            document.getElementById('totalLabel').textContent = label;
        }

