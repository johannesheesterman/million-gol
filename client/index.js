
const brushCanvas = document.getElementById('brush-canvas');
const brushCtx = brushCanvas.getContext('2d');
const brushGridSize = 10;
const brushCellSize = 20;
brushCanvas.width = brushGridSize * brushCellSize;
brushCanvas.height = brushGridSize * brushCellSize;
brushCanvas.style.width = brushCanvas.width + 'px';
brushCanvas.style.height = brushCanvas.height + 'px';

let brushPattern = Array.from({ length: brushGridSize }, () => Array(brushGridSize).fill(0));

function drawBrushGrid() {
    brushCtx.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
    for (let y = 0; y < brushGridSize; y++) {
        for (let x = 0; x < brushGridSize; x++) {
            if (brushPattern[y][x]) {
                brushCtx.fillStyle = '#222';
                brushCtx.fillRect(x * brushCellSize, y * brushCellSize, brushCellSize, brushCellSize);
            }
        }
    }
    brushCtx.strokeStyle = '#aaa';
    for (let x = 0; x <= brushGridSize; x++) {
        brushCtx.beginPath();
        brushCtx.moveTo(x * brushCellSize, 0);
        brushCtx.lineTo(x * brushCellSize, brushGridSize * brushCellSize);
        brushCtx.stroke();
    }
    for (let y = 0; y <= brushGridSize; y++) {
        brushCtx.beginPath();
        brushCtx.moveTo(0, y * brushCellSize);
        brushCtx.lineTo(brushGridSize * brushCellSize, y * brushCellSize);
        brushCtx.stroke();
    }
}

brushCanvas.addEventListener('mousedown', function(e) {
    const rect = brushCanvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / brushCellSize);
    const y = Math.floor((e.clientY - rect.top) / brushCellSize);
    if (x >= 0 && x < brushGridSize && y >= 0 && y < brushGridSize) {
        brushPattern[y][x] = brushPattern[y][x] ? 0 : 1;
        drawBrushGrid();
    }
});

drawBrushGrid();

const canvas = document.createElement('canvas');
canvas.style.display = 'block';
canvas.style.position = 'absolute';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.width = '100vw';
canvas.style.height = '100vh';
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
document.body.style.margin = '0';
document.body.appendChild(canvas);

const ctx = canvas.getContext('2d');

const gridSize = 1000;
const baseCellSize = 16; 

let offsetX = 0;
let offsetY = 0;
let scale = 1;
let isPanning = false;
let startPan = { x: 0, y: 0 };
let startOffset = { x: 0, y: 0 };

let activeCells = [];

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1 / scale;

    ctx.fillStyle = '#222';
    for (const cell of activeCells) {
        ctx.fillRect(cell.X * baseCellSize, cell.Y * baseCellSize, baseCellSize, baseCellSize);
    }

    for (let x = 0; x < gridSize; x++) {
        ctx.beginPath();
        ctx.moveTo(x * baseCellSize, 0);
        ctx.lineTo(x * baseCellSize, gridSize * baseCellSize);
        ctx.stroke();
    }

    for (let y = 0; y < gridSize; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * baseCellSize);
        ctx.lineTo(gridSize * baseCellSize, y * baseCellSize);
        ctx.stroke();
    }
    ctx.restore();
}

canvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    const mouseX = (e.clientX - offsetX) / scale;
    const mouseY = (e.clientY - offsetY) / scale;
    const zoomFactor = 0.05;
    const zoom = e.deltaY < 0 ? (1 + zoomFactor) : (1 - zoomFactor);
    const prevScale = scale;
    scale *= zoom;
    scale = Math.max(0.2, Math.min(5, scale));
    offsetX -= (mouseX * (scale - prevScale));
    offsetY -= (mouseY * (scale - prevScale));
    drawGrid();
}, { passive: false });

canvas.addEventListener('mousedown', function(e) {
    isPanning = true;
    startPan.x = e.clientX;
    startPan.y = e.clientY;
    startOffset.x = offsetX;
    startOffset.y = offsetY;
});

window.addEventListener('mousemove', function(e) {
    if (!isPanning) return;
    offsetX = startOffset.x + (e.clientX - startPan.x);
    offsetY = startOffset.y + (e.clientY - startPan.y);
    drawGrid();
});

window.addEventListener('mouseup', function() {
    isPanning = false;
});


drawGrid();

const ws = new WebSocket('ws://localhost:8080/ws');
ws.onmessage = function(event) {
    activeCells = JSON.parse(event.data);
    drawGrid();
};
ws.onopen = function() {
    console.log('WebSocket connection established');
};
ws.onerror = function(e) {
    console.error('WebSocket error:', e);
};

canvas.addEventListener('click', function(e) {
    const x = (e.clientX - offsetX) / scale;
    const y = (e.clientY - offsetY) / scale;
    const cellX = Math.floor(x / baseCellSize);
    const cellY = Math.floor(y / baseCellSize);
    console.log('Clicked cell:', cellX, cellY);

    const center = Math.floor(brushGridSize / 2);
    const cellsToActivate = [];
    for (let by = 0; by < brushGridSize; by++) {
        for (let bx = 0; bx < brushGridSize; bx++) {
            if (brushPattern[by][bx]) {
                const gridX = cellX + (bx - center);
                const gridY = cellY + (by - center);
                cellsToActivate.push({ x: gridX, y: gridY });
            }
        }
    }
    fetch('http://localhost:8080/cell', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cells: cellsToActivate })
    });
});