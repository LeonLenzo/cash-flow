// Register the datalabels plugin
Chart.register(ChartDataLabels);

let charts = {};
let allTransactions = [];
let drilldownState = {
    mode: 'account',
    level: 0,
    account: null,
    category: null,
    subcategory: null,
    vendor: null
};
let currentView = 'chart';
let currentData = { labels: [], data: [] };
let tableSortState = { column: null, direction: 'asc' };
let totalDisplayMode = 'total';

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

        transaction.debitAmount = parseFloat(transaction.Debit) || 0;
        transaction.creditAmount = parseFloat(transaction.Credit) || 0;
        transaction.CleanVendor = cleanVendorName(transaction.Details);

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

    cleaned = cleaned.trim();

    cleaned = cleaned.split(' ')
        .map(word => {
            if (word.match(/^[A-Z]{2,}$/)) return word;
            return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
        })
        .join(' ');

    return cleaned;
}

function displayInsights(transactions) {
    document.getElementById('uploadSection').style.display = 'none';
    document.getElementById('uploadBtnTop').style.display = 'inline-block';
    document.getElementById('dashboard').classList.remove('hidden');
    createAccountChart(transactions);
}

function goBackLevel() {
    if (drilldownState.level === 0) return;

    if (drilldownState.mode === 'account') {
        if (drilldownState.level === 4) {
            drilldownState.vendor = null;
            drilldownState.level = 3;
        } else if (drilldownState.level === 3) {
            drilldownState.subcategory = null;
            drilldownState.level = 2;
        } else if (drilldownState.level === 2) {
            drilldownState.category = null;
            drilldownState.level = 1;
        } else if (drilldownState.level === 1) {
            drilldownState.account = null;
            drilldownState.level = 0;
        }
    } else {
        if (drilldownState.level === 3) {
            drilldownState.vendor = null;
            drilldownState.level = 2;
        } else if (drilldownState.level === 2) {
            drilldownState.subcategory = null;
            drilldownState.level = 1;
        } else if (drilldownState.level === 1) {
            drilldownState.category = null;
            drilldownState.level = 0;
        }
    }

    updateDrilldownChart();
}
