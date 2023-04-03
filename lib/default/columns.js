module.exports = [{
    id: 'caseType',
    name: '',
    width: 36,
    sortable: false,
    align: 'center',
    formatter: 'iconCaseType'
}, {
    id: 'title',
    name: 'Title',
    searchable: true,
    width: 300,
    maxWidth: 1230
}, {
    id: 'type',
    name: 'Type',
    width: 50,
    sortable: false,
    align: 'center',
    formatter: 'iconType'
}, {
    id: 'duration',
    name: 'Duration',
    align: 'right',
    sortAsc: false,
    formatter: 'duration'
}, {
    id: 'errors',
    name: 'Errors',
    width: 60,
    align: 'center',
    comparer: 'errors',
    formatter: 'errors'
}, {
    id: 'logs',
    name: 'Logs',
    width: 60,
    align: 'center',
    comparer: 'logs',
    formatter: 'logs'
}, {
    id: 'annotations',
    name: 'Annotations',
    width: 100,
    markdown: true,
    searchable: true,
    comparer: 'annotations',
    formatter: 'annotations'
}, {
    id: 'attachments',
    name: 'Attachments',
    width: 100,
    align: 'center',
    formatter: 'attachments'
}, {
    id: 'status',
    name: 'Status',
    align: 'center'
}, {
    id: 'expectedStatus',
    name: 'Expected',
    align: 'center'
}, {
    id: 'outcome',
    name: 'Outcome',
    align: 'center',
    width: 85
}, {
    id: 'retry',
    name: 'Retry',
    align: 'center',
    width: 50
}, {
    id: 'location',
    name: 'Location',
    classMap: 'mcr-location',
    width: 200
}];