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
    this.matrixLen = Math.pow(size, 2);
    this.matrix = new Int8Array(this.matrixLen);
    // cache unhappy cells
    this.cellStatus = new Int8Array(this.matrixLen);
    // initialize to zero
    for (var i = 0; i < this.matrixLen; i++) this.matrix[i] = 0;

    // cache percent alike
    // stored as 8-bit ints, with 0 being 0% alike and 255 being 100% alike.
    this.percentAlike = new Uint8ClampedArray(this.matrixLen);

    // populate the matrix
    for (var i = 0; i < n1; i++) {
        var cell  = this.getVacantCell();
        this.matrix[cell] = 1;
    }

    for (var i = 0; i < n2; i++) {
        var cell  = this.getVacantCell();
        this.matrix[cell] = 2;
    }

    // populate cell caches
    for (var i = 0; i < this.matrixLen; i++) {
        this.cellStatus[i] = this.getCellStatus(i);
        this.percentAlike[i] = Math.round(this.getCellAlike(i) * 255);
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

        if (this.cellStatus[i] == 2)
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
    // vacate the original
    this.matrix[orig] = 0;

    // update cache
    var neighbors = this.getNeighbors(orig).concat(this.getNeighbors(dest));
    neighbors.push(orig);
    neighbors.push(dest);
    
    for (var i = 0; i < 18; i++) {
        var cell = neighbors[i];
        this.cellStatus[cell] = this.getCellStatus(cell);
        this.percentAlike[cell] = Math.floor(this.getCellAlike(cell) * 255);
    }

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
        if (this.cellStatus[i] == 2) unhappyCells.push(i);
    }

    return this.randomDraw(unhappyCells);
}

org.indicatrix.Segregation.prototype.isCellUnhappy = function (cell) {
    return this.getCellAlike(cell) < this.tolerance;
}

/**
 * Get the cell indices of a cell's neighbors, correcting for edge effects
 */
org.indicatrix.Segregation.prototype.getNeighbors = function (cell) {
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

    var ret = [];

    for (var i = 0; i < 8; i++) {
        var nb = neighbors[i];
        // correct edge effects
        nb = [this.torus(nb[0]), this.torus(nb[1])];
        ret.push(this.getCellForCoordinates(nb[0], nb[1]));
    }

    return ret;
}


/**
 * Get the status of a cell
 * @param {int} i the cell
 * @returns 0 if vacant, 1 if happy, 2 if unhappy
 */
org.indicatrix.Segregation.prototype.getCellStatus = function (i) {
    if (this.matrix[i] == 0)
        return 0;
    else
        return this.isCellUnhappy(i) ? 2 : 1;
}

/**
 * Get the percent-alike of a cell, as a float in [0, 1].
 * @param {int} cell The cell
 * @returns int amount alike
 */
org.indicatrix.Segregation.prototype.getCellAlike = function (cell) {
    thisCell = this.matrix[cell];

    var like = 0;
    var total = 0;
 
    neighbors = this.getNeighbors(cell);
   
    for (var i = 0; i < 8; i++) {
        cellValue = this.matrix[neighbors[i]];
        if (cellValue != 0) {
            total += 1;
            if (cellValue == thisCell) {
                like += 1;
            }
        }
    }

    return like / total;
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

/**
 * Get the average percent alike for all cells
 */
org.indicatrix.Segregation.prototype.getMeanPercentAlike = function () {
    var accumulator = 0;
    for (var i = 0; i < this.matrixLen; i++) {
        if (this.matrix[i] == 0)
            continue;
        accumulator += this.percentAlike[i] / 255;
    }

    return accumulator / this.matrixLen;
}

/**
 * Get the percentage of unhappy cells
 */
org.indicatrix.Segregation.prototype.getPercentUnhappy = function () {
    var unhappy = 0;
    var n = 0;
    for (var i = 0; i < this.matrixLen; i++) {
        if (this.cellStatus[i] != 0) {
            n++;
            if (this.cellStatus[i] == 2) {
                unhappy++;
            }
        }
    }
    return unhappy / n;
}