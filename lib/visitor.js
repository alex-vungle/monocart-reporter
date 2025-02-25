const fs = require('fs');
const path = require('path');
const EC = require('eight-colors');
const { StackUtils, codeFrameColumns } = require('./runtime/monocart-vendor.js');
const Util = require('./utils/util.js');
const commentsHelper = require('./helper/comments.js');
const defaultColumns = require('./default/columns.js');
class Visitor {
    constructor(root, options) {
        this.root = root;
        this.options = options;

        // console.log(options);

        if (typeof options.visitor === 'function') {
            this.customCommonVisitor = options.visitor;
        }

    }

    async start() {

        // default columns not detailed in report
        defaultColumns.forEach((item) => {
            item.detailed = false;
        });

        // custom column formatters with string passed to JSON
        this.formatters = {};

        // user defined custom columns
        const handler = this.options.columns;
        if (typeof handler === 'function') {
            // update default columns by user
            handler.call(this, defaultColumns);
            // maybe a tree
            const customVisitors = [];
            this.initCustomHandler(defaultColumns, customVisitors, this.formatters);
            if (customVisitors.length) {
                this.customVisitors = customVisitors;
            }
        }

        // console.log(customFormatters);

        this.columns = defaultColumns;
        this.rows = [];
        this.jobs = [];

        await this.visit(this.root, this.rows);

        this.duplicatedErrorsHandler(this.rows);

    }

    // ==============================================================================================

    initCustomHandler(list, visitors, formatters) {

        list.forEach((column) => {
            if (column.id) {

                // custom visitor
                if (typeof column.visitor === 'function') {

                    visitors.push({
                        id: column.id,
                        visitor: column.visitor
                    });

                    // remove function (can not be in JSON)
                    delete column.visitor;

                }

                // custom formatter
                if (typeof column.formatter === 'function') {

                    formatters[column.id] = column.formatter.toString();

                    // remove function (can not be in JSON)
                    delete column.formatter;
                }

            }

            // drill down
            if (Util.isList(column.subs)) {
                this.initCustomHandler(column.subs, visitors, formatters);
            }
        });
    }

    // generate the column data from playwright metadata
    // data.type is suite, metadata is Suite, https://playwright.dev/docs/api/class-suite
    // data.type is case, metadata is TestCase, https://playwright.dev/docs/api/class-testcase
    // data.type is step, metadata is TestStep, https://playwright.dev/docs/api/class-teststep
    async customVisitorsHandler(data, metadata) {

        const collect = {
            comments: (parserOptions) => {
                return commentsHelper(metadata, parserOptions);
            }
        };

        // for all data
        if (this.customCommonVisitor) {
            await this.customCommonVisitor.call(this, data, metadata, collect);
        }

        // for single column data (high priority)
        if (this.customVisitors) {
            for (const item of this.customVisitors) {
                const res = await item.visitor.call(this, data, metadata, collect);
                if (typeof res !== 'undefined') {
                    data[item.id] = res;
                }
            }
        }
    }

    // ==============================================================================================

    async visit(suite, list) {
        if (!suite._entries) {
            return;
        }
        // suite -> tests/test case -> test result -> test step
        for (const entry of suite._entries) {
            // only case has results
            if (entry.results) {
                await this.testCaseHandler(entry, list);
            } else {
                await this.testSuiteHandler(entry, list);
            }
        }
    }

    // ==============================================================================================

    /*
    Project suite #1. Has a child suite for each test file in the project.
        File suite #1
            TestCase #1
            Suite corresponding to a test.describe(title, callback) group
                TestCase #1 in a group
                    TestStep
    */
    async testSuiteHandler(suite, list) {

        // sometimes project title is empty
        const suiteType = suite._type;
        let suiteTitle = Util.formatPath(suite.title);
        if (!suiteTitle) {
            suiteTitle = suiteType;
        }

        // random uid for report
        let suiteId = Util.uid();
        if (suiteType === 'file') {
            suiteId = suite._fileId;
        }

        const group = {
            id: suiteId,
            title: suiteTitle,
            type: 'suite',
            // root, project, file, describe
            suiteType: suiteType,
            // all test cases in this suite and its descendants
            caseNum: suite.allTests().length,
            subs: []
        };

        if (suite.location) {
            group.location = this.locationHandler(suite.location);
        }

        await this.customVisitorsHandler(group, suite);

        list.push(group);
        // drill down
        await this.visit(suite, group.subs);
    }

    // ==============================================================================================

    async testCaseHandler(testCase, list) {

        // duration
        // total of testResult.duration is not exact, it will cost time before/between/after result
        const caseTimestamps = [].concat(testCase.timestamps);
        const duration = caseTimestamps.pop() - caseTimestamps.shift();

        // Unique test ID that is computed based on the test file name, test title and project name

        // 6113402d7bc11a0fb7a9-281a9986cca0dfd6fa4b
        // const repeatEachIndexSuffix = repeatEachIndex ? ` (repeat:${repeatEachIndex})` : '';
        // At the point of the query, suite is not yet attached to the project, so we only get file, describe and test titles.
        // const testIdExpression = `[project=${project._internal.id}]${test.titlePath().join('\x1e')}${repeatEachIndexSuffix}`;
        // const testId = fileId + '-' + calculateSha1(testIdExpression).slice(0, 20);

        const caseId = testCase.id.split('-').pop();

        const caseItem = {
            id: caseId,
            title: testCase.title,
            type: 'case',
            caseType: '',

            // Whether the test is considered running fine. Non-ok tests fail the test run with non-zero exit code.
            ok: testCase.ok(),

            // Testing outcome for this test. Note that outcome is not the same as testResult.status:
            // returns: <"skipped"|"expected"|"unexpected"|"flaky">
            outcome: testCase.outcome(),

            expectedStatus: testCase.expectedStatus,
            location: this.locationHandler(testCase.location),

            // custom collection
            logs: testCase.logs,
            timestamps: testCase.timestamps,

            duration,

            // annotations, string or array
            annotations: this.getCaseAnnotations(testCase.annotations),

            // repeatEachIndex: testCase.repeatEachIndex,

            // The maximum number of retries given to this test in the configuration
            // retries: testCase.retries,

            // The timeout given to the test.
            // Affected by testConfig.timeout, testProject.timeout, test.setTimeout(timeout), test.slow() and testInfo.setTimeout(timeout).
            timeout: testCase.timeout,

            // ===============================================================
            // merge all results (retry multiple times)

            attachments: [],

            // errors thrown during the test execution.
            // error is first errors
            errors: [],

            retry: 0,

            // <"passed"|"failed"|"timedOut"|"skipped">
            status: '',

            // all results steps
            stepNum: 0,
            stepFailed: 0,
            stepSubs: false,
            subs: []
        };

        const resultsTimestamps = [].concat(testCase.timestamps);

        for (const testResult of testCase.results) {
            caseItem.attachments = caseItem.attachments.concat(testResult.attachments);

            caseItem.errors = caseItem.errors.concat(testResult.errors);

            caseItem.retry = testResult.retry;
            caseItem.status = testResult.status;

            // The worker index is used to reference a specific browser instance
            // The parallel index coordinates the parallel execution of tests across multiple worker instances.
            // https://playwright.dev/docs/test-parallel#worker-index-and-parallel-index

            // result duration
            const time_start = resultsTimestamps.shift();
            const time_end = resultsTimestamps.shift();
            const resultDuration = time_end - time_start;

            // console.log(resultDuration, testResult.duration);

            this.jobs.push({
                caseId,
                // worker
                parallelIndex: testResult.parallelIndex,
                // job
                workerIndex: testResult.workerIndex,
                timestamp: time_start,
                duration: resultDuration
            });

            // concat all steps
            if (caseItem.subs.length) {
                caseItem.subs.push(this.getRetryStep(testResult));
            }

            const steps = await this.testStepHandler(testResult.steps, caseItem);

            caseItem.subs = caseItem.subs.concat(steps);
        }

        // 'passed', 'flaky', 'skipped', 'failed'
        // after all required status in results
        caseItem.caseType = this.getCaseType(caseItem);

        // will no steps if someone skipped
        if (!caseItem.subs.length) {
            delete caseItem.subs;
        }

        this.attachmentsHandler(caseItem, caseId);
        this.caseErrorsHandler(caseItem);

        await this.customVisitorsHandler(caseItem, testCase);

        list.push(caseItem);
    }

    getCaseType(item) {
        // ok includes outcome === 'expected' || 'flaky' || 'skipped'
        if (item.ok) {
            if (item.outcome === 'skipped' || item.status === 'skipped') {
                return 'skipped';
            }
            if (item.outcome === 'flaky') {
                return 'flaky';
            }
            return 'passed';
        }
        return 'failed';
    }

    getCaseAnnotations(annotations) {
        // array
        if (Util.isList(annotations)) {
            return annotations;
        }

        // string from comments
        if (typeof annotations === 'string' && annotations) {
            return annotations;
        }

    }

    // ==============================================================================================

    getRetryStep(testResult) {
        const stepId = Util.uid();
        return {
            id: stepId,
            title: `Retry #${testResult.retry}`,
            type: 'step',
            stepType: 'retry',
            // for retry color
            status: 'retry',
            retry: testResult.retry
        };
    }

    async testStepHandler(steps, caseItem) {

        const list = [];

        for (const testStep of steps) {

            // random id for report
            const stepId = Util.uid();

            const step = {
                id: stepId,
                title: testStep.title,
                type: 'step',
                stepType: testStep.category,

                duration: testStep.duration,
                location: this.locationHandler(testStep.location)
            };
            this.stepErrorsHandler(step, testStep, caseItem);
            if (Util.isList(testStep.steps)) {
                // console.log(testStep.title);
                caseItem.stepSubs = true;
                step.subs = await this.testStepHandler(testStep.steps, caseItem);
            }

            await this.customVisitorsHandler(step, testStep);

            caseItem.stepNum += 1;
            list.push(step);
        }

        return list;
    }

    attachmentsHandler(caseItem, caseId) {
        const attachments = caseItem.attachments;
        if (!Util.isList(attachments)) {
            delete caseItem.attachments;
            return;
        }

        attachments.forEach((item, i) => {

            if (item.body) {
                if (!item.path) {
                    this.saveAttachmentHandler(item, i, caseId);
                }
                delete item.body;
            }

            if (!item.path) {
                return;
            }

            // before path change
            this.reportHandler(item, 'coverage');
            this.reportHandler(item, 'network');

            const o = this.options;
            // store relative path first
            item.path = Util.relativePath(item.path, o.outputDir);

            // custom attachment path
            const attachmentPathHandler = o.attachmentPath;
            if (typeof attachmentPathHandler === 'function') {
                const extras = Util.getAttachmentPathExtras(o);
                const newPath = attachmentPathHandler(item.path, extras);
                // if forgot return new path
                if (newPath) {
                    item.path = newPath;
                }
            }


        });
    }

    reportHandler(item, itemName) {

        const definition = Util.attachments[itemName];
        if (!definition) {
            return;
        }

        if (item.name !== definition.name || item.contentType !== definition.contentType) {
            return;
        }

        const jsonPath = path.resolve(path.dirname(item.path), definition.reportFile);
        if (!fs.existsSync(jsonPath)) {
            return;
        }

        const report = Util.readJSONSync(jsonPath);
        if (!report) {
            return;
        }

        item.report = report;

    }

    saveAttachmentHandler(item, i, caseId) {

        const attachmentsPath = path.resolve(this.options.outputDir, caseId);
        if (!fs.existsSync(attachmentsPath)) {
            fs.mkdirSync(attachmentsPath, {
                recursive: true
            });
        }

        const types = {
            'text/plain': 'txt',
            'application/octet-stream': 'data'
        };

        let ext = 'data';
        const contentType = item.contentType;
        if (contentType) {
            ext = types[contentType] || contentType.split('/').pop().slice(0, 4);
        }
        const filePath = path.resolve(attachmentsPath, `${item.name}-${i + 1}.${ext}`);
        fs.writeFileSync(filePath, item.body);
        item.path = filePath;
    }

    locationHandler(location) {
        if (!location) {
            return '';
        }
        const file = Util.relativePath(location.file);
        return `${file}:${location.line}:${location.column}`;
    }

    // ==============================================================================================

    caseErrorsHandler(caseItem) {

        const errors = caseItem.errors;
        if (Util.isList(errors)) {
            caseItem.errors = this.errorsHandler(errors);
            return;
        }

        // missed errors for unexpected
        if (caseItem.outcome === 'unexpected') {
            const error = {
                message: EC.red(`Expected to "${caseItem.expectedStatus}", but "${caseItem.status}"`)
            };
            caseItem.errors = this.errorsHandler([error]);
            return;
        }

        delete caseItem.errors;

    }

    stepErrorsHandler(step, testStep, caseItem) {
        const error = testStep.error;
        if (!error) {
            return;
        }
        caseItem.stepFailed += 1;
        step.errors = this.errorsHandler([error]);
    }

    errorsHandler(errors) {
        return errors.map((err) => {
            err = err.stack || err.message || err;
            return err;
        });
    }

    // ==============================================================================================

    duplicatedErrorsHandler(rows) {

        Util.forEach(rows, (item) => {
            if (!item.errors) {
                return;
            }

            // for mark errors and sort by errors
            item.errorNum = item.errors.length;

            const errors = item.errors.filter((err) => {
                const sub = this.findSubByError(item.subs, err);
                if (sub) {
                    // keep first error id with last sub id
                    if (!item.errorId) {
                        item.errorId = sub.id;
                    }
                    return false;
                }
                return true;
            });
            if (errors.length) {
                item.errors = this.errorsToSnippets(errors);
            } else {
                delete item.errors;
            }

        });

    }

    findSubByError(subs, err) {
        let sub;
        Util.forEach(subs, (item) => {
            if (item.errors) {
                if (item.errors.find((e) => e === err)) {
                    sub = item;
                    // return false to break loop
                    return false;
                }
            }
        });
        if (sub && sub.subs) {
            const s = this.findSubByError(sub.subs, err);
            if (s) {
                return s;
            }
        }
        return sub;
    }

    errorsToSnippets(errors) {
        return errors.map((err, i) => {
            const lines = err.split('\n');
            const firstStackLine = lines.findIndex((line) => line.trim().startsWith('at '));
            if (firstStackLine === -1) {
                return err;
            }

            const line = lines[firstStackLine];

            const stackUtils = new StackUtils();
            const location = stackUtils.parseLine(line);
            if (!location) {
                return err;
            }
            const file = location.file;
            // may in anonymous script by addInitScript
            // file: 'eval at evaluate (:195:30), <anonymous>',
            if (!file || !fs.existsSync(file)) {
                return err;
            }
            const source = fs.readFileSync(file, 'utf8');
            const codeFrame = codeFrameColumns(source, {
                start: location
            }, {
                highlightCode: true,
                // forceColor: true
                // linesAbove: 2,
                linesBelow: 0
            });

            if (!codeFrame) {
                return err;
            }

            lines.splice(firstStackLine, 0, `\n${codeFrame}\n`);

            // console.log(codeFrame);
            return lines.join('\n');
        });
    }

}

module.exports = Visitor;
