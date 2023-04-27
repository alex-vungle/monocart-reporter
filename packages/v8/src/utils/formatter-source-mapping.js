
const findIndexesOfSubString = (inputString, searchString) => {
    const matches = [];
    let i = inputString.indexOf(searchString);
    while (i !== -1) {
        matches.push(i);
        i = inputString.indexOf(searchString, i + searchString.length);
    }
    return matches;
};

const findLineEndingIndexes = (inputString) => {
    const endings = findIndexesOfSubString(inputString, '\n');
    endings.push(inputString.length);
    return endings;
};

const DEFAULT_COMPARATOR = (a, b) => {
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
};

const upperBound = (array, needle, comparator) => {
    let l = 0;
    let r = array.length;
    while (l < r) {
        const m = (l + r) >> 1;
        if (comparator(needle, array[m]) >= 0) {
            l = m + 1;
        } else {
            r = m;
        }
    }
    return r;
};


export default class {

    constructor(formattedContent, mapping) {
        const formattedLineEndings = findLineEndingIndexes(formattedContent);
        // console.log(formattedLineEndings);

        this.formattedLineEndings = formattedLineEndings;
        this.mapping = mapping;

        this.formattedLines = this.formattedLineEndings.length;
        this.formattedLength = formattedContent.length;
    }

    originalToFormattedLocation(originalPosition) {
        const formattedPosition = this.convertPosition(this.mapping.original, this.mapping.formatted, originalPosition);
        return this.positionToLocation(this.formattedLineEndings, formattedPosition);
    }

    convertPosition(positions1, positions2, position) {
        const index = upperBound(positions1, position, DEFAULT_COMPARATOR) - 1;
        let convertedPosition = positions2[index] + position - positions1[index];
        if (index < positions2.length - 1 && convertedPosition > positions2[index + 1]) {
            convertedPosition = positions2[index + 1];
        }
        return convertedPosition;
    }

    positionToLocation(lineEndings, position) {
        const line = upperBound(lineEndings, position - 1, DEFAULT_COMPARATOR);
        let startPos;
        let column;
        if (line) {
            startPos = lineEndings[line - 1] + 1;
            column = position - startPos;
        } else {
            startPos = 0;
            column = position;
        }

        const endPos = lineEndings[line];
        const last = endPos - startPos;

        return {
            line,
            column,
            last
        };
    }
}