export default {
    create: function() {
        return [{
            id: 'ok',
            name: 'OK',
            width: 36,
            sortable: false,
            align: 'center',
            formatter: 'caseIcon'
        }, {
            id: 'title',
            name: 'Title',
            maxWidth: 1230
        }, {
            id: 'type',
            name: 'Type',
            width: 60,
            sortable: false,
            align: 'center'
        }, {
            id: 'duration',
            name: 'Duration',
            align: 'right',
            sortAsc: false,
            formatter: 'duration'
        }, {
            id: 'status',
            name: 'Status',
            align: 'center'
        }, {
            id: 'expectedStatus',
            name: 'Expected',
            align: 'center'
        }, {
            id: 'retry',
            name: 'Retry',
            align: 'center',
            width: 50
        }, {
            id: 'errors',
            name: 'Errors',
            width: 60,
            align: 'center',
            formatter: 'errors'
        }, {
            id: 'logs',
            name: 'Logs',
            width: 60,
            align: 'center',
            formatter: 'logs'
        }, {
            id: 'attachments',
            name: 'Attachments',
            width: 100,
            align: 'center',
            formatter: 'attachments'
        }, {
            id: 'location',
            name: 'Location',
            width: 200
        }];
    }
};
