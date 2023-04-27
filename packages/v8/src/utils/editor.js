import { EditorView } from 'codemirror';

import {
    EditorState, Compartment,
    RangeSetBuilder
} from '@codemirror/state';

import {
    keymap, highlightSpecialChars, drawSelection, highlightActiveLine, dropCursor,
    rectangularSelection, crosshairCursor,
    lineNumbers, highlightActiveLineGutter,
    gutter, GutterMarker,
    Decoration,
    ViewPlugin
} from '@codemirror/view';

import {
    defaultHighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching,
    foldGutter, foldKeymap
} from '@codemirror/language';

import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';

const readOnlyCompartment = new Compartment();

let editor;
export const createEditor = (container, report) => {


    // https://github.com/codemirror/basic-setup/
    const basicSetup = [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),

        foldGutter({
            // custom fold icon
            markerDOM: function(open) {
                const div = document.createElement('div');
                div.className = open ? 'cm-fold cm-fold-open' : 'cm-fold cm-fold-close';
                return div;
            }
        }),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, {
            fallback: true
        }),
        bracketMatching(),

        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        keymap.of([
            ... foldKeymap
        ])
    ];

    // =====================================================================

    let gutterMap;
    let bgMap;

    let gutterTypes;
    let bgType;

    const coveredMarker = new GutterMarker();
    coveredMarker.elementClass = 'mcr-line-covered';
    const partialMarker = new GutterMarker();
    partialMarker.elementClass = 'mcr-line-partial';
    const uncoveredMarker = new GutterMarker();
    uncoveredMarker.elementClass = 'mcr-line-uncovered';

    const coveredBg = Decoration.mark({
        class: 'mcr-bg-covered'
    });
    const uncoveredBg = Decoration.mark({
        class: 'mcr-bg-uncovered'
    });


    const updateCoverage = (coverage) => {
        gutterMap = coverage.gutterMap;
        bgMap = coverage.bgMap;

        if (coverage.type === 'covered') {
            gutterTypes = [coveredMarker, partialMarker, uncoveredMarker];
            bgType = coveredBg;
        } else {
            gutterTypes = [uncoveredMarker, partialMarker, coveredMarker];
            bgType = uncoveredBg;
        }
    };

    updateCoverage(report.coverage);

    // =====================================================================

    const coverageGutter = gutter({
        class: 'mcr-coverage-gutter',
        lineMarker(view, line) {
            if (line.length === 0) {
                return null;
            }
            const lineIndex = Math.round(line.top / line.height);
            // console.log('lineIndex', lineIndex);
            const v = gutterMap.get(lineIndex);
            if (v) {
                if (v === 'partial') {
                    return gutterTypes[1];
                }
                return gutterTypes[0];
            }
            return gutterTypes[2];
        }
    });

    // =====================================================================

    function getCoverageBg(view) {

        const builder = new RangeSetBuilder();
        for (const { from, to } of view.visibleRanges) {
            for (let pos = from; pos <= to;) {
                const line = view.state.doc.lineAt(pos);
                const v = bgMap.get(line.number - 1);
                if (v) {
                    builder.add(line.from + v.start, line.from + v.end, bgType);
                }
                pos = line.to + 1;
            }
        }
        return builder.finish();
    }

    const coverageBg = ViewPlugin.fromClass(class {

        constructor(view) {
            this.decorations = getCoverageBg(view);
        }

        update(update) {
            if (update.docChanged || update.viewportChanged) {
                this.decorations = getCoverageBg(update.view);
            }
        }
    }, {
        decorations: (v) => v.decorations
    });


    // =====================================================================

    const readOnly = readOnlyCompartment.of(EditorState.readOnly.of(true));

    editor = new EditorView({
        parent: container,
        doc: report.content,
        extensions: [
            basicSetup,

            coverageGutter,

            coverageBg,

            javascript(),
            css(),

            readOnly
        ]
    });

    return {
        showContent: (newReport) => {
            updateCoverage(newReport.coverage);
            const text = editor.state.doc.toString();
            const transaction = editor.state.update({
                changes: {
                    from: 0,
                    to: text.length,
                    insert: newReport.content
                }
            });
            editor.dispatch(transaction);
        }
    };

};
