const Util = require('./utils/util.js');
const defaultSummary = require('./default/summary.js');
const { generatePieChart } = require('./utils/chart.js');

const caseHandler = (item, summary) => {
    summary.tests.value += 1;
    summary.retries.value += item.retry;

    if (item.errors) {
        summary.errors.value += item.errors.length;
    }

    if (item.logs) {
        summary.logs.value += item.logs.length;
    }

    if (item.attachments) {
        summary.attachments.value += item.attachments.length;
    }

    const type = summary[item.caseType];
    if (!type) {
        return;
    }
    type.value += 1;
};

const stepHandler = (item, summary) => {
    summary.steps.value += 1;

    if (item.errors) {
        summary.errors.value += item.errors.length;
    }
};

// ===========================================================================

const tagPattern = /@([^@\s]+)/g;
const tagHandler = (item, tags, tagOptions) => {
    const matches = item.title.matchAll(tagPattern);
    for (const match of matches) {
        const tag = match[1];
        let tagItem = tags[tag];
        if (!tagItem) {
            tagItem = {};
            const options = tagOptions[tag];
            if (options) {
                if (options.style) {
                    Object.assign(tagItem, options);
                } else {
                    tagItem.style = options;
                }
            }
            tagItem.value = 0;
            tags[tag] = tagItem;
        }
        tagItem.value += 1;
    }
};

const calculateSummary = (data, tagOptions) => {
    const tags = {};

    const summary = {
        ... defaultSummary
    };
    // init summary data
    Object.keys(summary).forEach((k) => {
        const item = summary[k];
        item.id = k;
        item.value = 0;
    });

    // ====================================================

    const suiteMap = {};
    data.suiteTypes.forEach((k) => {
        suiteMap[k] = `${k}s`;
    });

    // only counting case parent without duplicate
    const suiteSet = new Set();
    // Unique title
    const projectSet = new Set();
    const fileSet = new Set();

    const suiteHandler = (item) => {
        const suiteType = item.suiteType;
        if (suiteType === 'project') {
            projectSet.add(item.title);
            return;
        }

        if (suiteType === 'file') {
            fileSet.add(item.title);
            return;
        }

        // shards and describes
        const type = suiteMap[suiteType];
        if (!type) {
            return;
        }
        summary[type].value += 1;
    };

    // ====================================================

    Util.forEach(data.rows, (item, parent) => {
        tagHandler(item, tags, tagOptions);
        if (item.type === 'case') {
            suiteSet.add(parent);
            caseHandler(item, summary);
            return;
        }
        if (item.type === 'step') {
            stepHandler(item, summary);
            return;
        }
        suiteHandler(item);
    });

    // ====================================================

    summary.suites.value = suiteSet.size;
    suiteSet.clear();

    summary.projects.value = projectSet.size;
    projectSet.clear();

    summary.files.value = fileSet.size;
    fileSet.clear();

    // ====================================================

    data.tags = tags;
    data.summary = summary;

    // ====================================================

    const caseTypes = data.caseTypes;

    // percent and pie data list
    const pieDataList = [];
    caseTypes.forEach((k) => {
        const item = summary[k];
        item.percent = Util.PF(item.value, summary.tests.value);
        pieDataList.push({
            ... item
        });
    });

    data.pieChart = generatePieChart(pieDataList);

};

module.exports = {
    calculateSummary
};