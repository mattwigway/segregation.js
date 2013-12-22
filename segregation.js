/*
   Copyright 2013 Matthew Wigginton Conway

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

if (typeof(org) == 'undefined') org = {};
if (org.indicatrix == undefined) org.indicatrix = {};

org.indicatrix.Segregation = function (size, pxSize, tolerance, n1, n2) {
    var instance = this;
    this.size = size;
    this.pxSize = pxSize;
    this.tolerance = tolerance;
    
    // >= because there must always be one empty cell for an unhappy cell to move to
    if (n1 + n2 >= Math.pow(this.size, 2)) {
        console.log('Number of agents must be smaller than number of cells!');
        return false;
    }

    // build the matrix
    this.matrix = [];
    for (var i = 0; i < Math.pow(this.size, 2); i++) this.matrix.push(0);
    this.matrixLen = this.matrix.length;

    // populate the matrix
    for (var i = 0; i < n1; i++) {
        var cell  = this.getVacantCell();
        this.matrix[cell] = 1;
    }

    for (var i = 0; i < n2; i++) {
        var cell  = this.getVacantCell();
        this.matrix[cell] = 2;
    }

    // build the display board
    this.board = d3.select('#board')
        .append('svg')
        .attr('width', this.pxSize)
        .attr('height', this.pxSize)
        .append('g');
    

    // create the circles

    // determine appropriate radius, leaving some padding
    var radius = (this.pxSize / this.size) * .45;
    
    this.circleMatrix = [];
    for (var i = 0; i < this.matrixLen; i++) {
        var coords = this.getCoordinatesForCell(i);
        var c = this.board.append('circle')
            .attr('r', radius)
            .attr('class', 'vacant')
            .attr('transform', this.getTransformForCell(i))
            .attr('title', coords.row + ', ' + coords.col);

        this.circleMatrix.push(c);
    }

    this.display();
}

org.indicatrix.Segregation.prototype.start = function () {
    var instance = this;

    if (this.started == true)
        return;

    this.started = true;

    var doStep;
    doStep = function () {
        console.log('stepping');
        var done = false;
        for (var i = 0; i < 50; i++) {
            if (!instance.step()) {
                done = true;
                break;
            }
        }
        instance.display();
        if (!done)
            instance.timeout = setTimeout(doStep, 50);
    }

    doStep();
}

org.indicatrix.Segregation.prototype.stop = function () {
    clearTimeout(this.timeout);
}

org.indicatrix.Segregation.prototype.display = function () {
    for (var i = 0; i < this.matrixLen; i++) {
        if (this.matrix[i] == 0) {
            this.circleMatrix[i].attr('class', 'vacant');
            continue;
        }

        if (this.matrix[i] == 1)
            theClass = 'group1'

        if (this.matrix[i] == 2)
            theClass = 'group2'

        if (this.isCellUnhappy(i))
            theClass += ' unhappy';
        else
            theClass += ' happy';

        this.circleMatrix[i].attr('class', theClass);
    }
}

org.indicatrix.Segregation.prototype.step = function () {
    // find an unhappy cell
    var orig = this.getUnhappyCell();
    
    if (orig == undefined) {
        console.log('Everyone is happy!');
        return false;
    }

    // find a vacant cell to move to
    var dest = this.getVacantCell();
    
    // move
    this.matrix[dest] = this.matrix[orig];
    // vacate the orignal
    this.matrix[orig] = 0;

    return true;
}

org.indicatrix.Segregation.prototype.randomDraw = function (arr) {
    return arr[Math.floor(Math.random() * (arr.length))];
}

org.indicatrix.Segregation.prototype.getVacantCell = function () {
    vacantCells = [];

    for (var i = 0; i < this.matrixLen; i++) {
        if (this.matrix[i] == 0) vacantCells.push(i);
    }

    return this.randomDraw(vacantCells);
}

org.indicatrix.Segregation.prototype.getUnhappyCell = function () {
    var unhappyCells = [];
    for (var i = 0; i < this.matrixLen; i++) {
        if (this.matrix[i] != 0 && this.isCellUnhappy(i)) unhappyCells.push(i);
    }

    return this.randomDraw(unhappyCells);
}

org.indicatrix.Segregation.prototype.isCellUnhappy = function (cell) {
    thisCell = this.matrix[cell];
    var like = 0;
    var total = 0;
    
    var coords = this.getCoordinatesForCell(cell);
    var r = coords.row;
    var c = coords.col;
    var neighbors = [
        [r - 1, c],
        [r - 1, c + 1],
        [r, c + 1],
        [r + 1, c + 1],
        [r + 1, c],
        [r + 1, c - 1],
        [r, c - 1],
        [r - 1, c - 1]
    ];

    for (var i = 0; i < 8; i++) {
        var nb = neighbors[i];
        // correct edge effects
        nb = [this.torus(nb[0]), this.torus(nb[1])]
        cellValue = this.matrix[this.getCellForCoordinates(nb[0], nb[1])];
        if (cellValue != 0) {
            total += 1;
            if (cellValue == thisCell) {
                like += 1;
            }
        }
    }

    return (like / total) < this.tolerance;
}
    
org.indicatrix.Segregation.prototype.torus = function (i) {
    if (i < 0) return this.size - i;
    if (i >= this.size) return i - this.size;
    return i;
}

/**
 * Get an SVG transform attribute for the center of cell i
 */
org.indicatrix.Segregation.prototype.getTransformForCell = function (i) {
    var coords = this.getCoordinatesForCell(i);
    var x = coords.col * (this.pxSize / this.size) + (this.pxSize / this.size) / 2;
    var y = coords.row * (this.pxSize / this.size) + (this.pxSize / this.size) / 2;
    return 'translate(' + x + ' ' + y + ')'
}

/**
 * Get the coordinates for cell i
 * @arg {int} i The cell
 */
org.indicatrix.Segregation.prototype.getCoordinatesForCell = function(i) {
    var row = Math.floor(i / this.size);
    var col = i % this.size;
    return {row: row, col: col};
}

org.indicatrix.Segregation.prototype.getCellForCoordinates = function(row, col) {
    return row * this.size + col;
}