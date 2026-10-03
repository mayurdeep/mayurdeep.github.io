// Adapted from Ref-NeRF (Dor Verbin, 2021): https://dorverbin.github.io/refnerf/
// Modified for two separate video files

Number.prototype.clamp = function(min, max) {
    return Math.min(Math.max(this, min), max);
};

// Polyfill roundRect for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        this.beginPath();
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r);
        this.lineTo(x + w, y + h - r);
        this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.lineTo(x + r, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r);
        this.lineTo(x, y + r);
        this.quadraticCurveTo(x, y, x + r, y);
        this.closePath();
    };
}

var TARGET_W = 1024;
var TARGET_H = 544;

function drawCover(ctx, vid, x, y, w, h, vAnchor) {
    var vw = vid.videoWidth, vh = vid.videoHeight;
    var canvasRatio = w / h;
    var vidRatio    = vw / vh;
    var srcX, srcY, srcW, srcH;
    if (vidRatio > canvasRatio) {
        srcH = vh; srcW = vh * canvasRatio;
        srcX = (vw - srcW) / 2; srcY = 0;
    } else {
        srcW = vw; srcH = vw / canvasRatio;
        srcX = 0;
        if (vAnchor === 'top')         srcY = 0;
        else if (vAnchor === 'bottom') srcY = vh - srcH;
        else                           srcY = (vh - srcH) / 2;
    }
    ctx.drawImage(vid, srcX, srcY, srcW, srcH, x, y, w, h);
}

function initVideoComparison(canvasId, vidAId, vidBId, opts) {
    opts = opts || {};
    var canvas = document.getElementById(canvasId);
    var vidA   = document.getElementById(vidAId);
    var vidB   = document.getElementById(vidBId);
    if (!canvas || !vidA || !vidB) return;

    var position = 0.5;
    var ctx = canvas.getContext('2d');

    function setupAndPlay() {
        canvas.width  = TARGET_W;
        canvas.height = TARGET_H;
        vidA.play();
        vidB.play();

        // Keep videos in sync
        vidA.addEventListener('timeupdate', function() {
            if (Math.abs(vidA.currentTime - vidB.currentTime) > 0.15)
                vidB.currentTime = vidA.currentTime;
        });

        canvas.addEventListener('mousemove', function(e) {
            var bcr = canvas.getBoundingClientRect();
            position = ((e.pageX - bcr.x) / bcr.width).clamp(0.02, 0.98);
        }, false);
        canvas.addEventListener('touchstart', function(e) {
            var bcr = canvas.getBoundingClientRect();
            position = ((e.touches[0].pageX - bcr.x) / bcr.width).clamp(0.02, 0.98);
        }, false);
        canvas.addEventListener('touchmove', function(e) {
            var bcr = canvas.getBoundingClientRect();
            position = ((e.touches[0].pageX - bcr.x) / bcr.width).clamp(0.02, 0.98);
        }, false);

        function drawLoop() {
            var W = canvas.width;
            var H = canvas.height;
            var splitX = (W * position).clamp(0, W);

            // Draw vidA (Standard 3DGS) full frame
            drawCover(ctx, vidA, 0, 0, W, H, opts.vAnchor);

            // Draw vidB (TAD-GS) clipped to the right of the divider
            ctx.save();
            ctx.beginPath();
            ctx.rect(splitX, 0, W - splitX, H);
            ctx.clip();
            drawCover(ctx, vidB, 0, 0, W, H, opts.vAnchor);
            ctx.restore();

            // Arrow / handle dimensions (proportional to height)
            var arrowLength    = 0.09 * H;
            var arrowheadWidth = 0.025 * H;
            var arrowheadLen   = 0.04 * H;
            var arrowPosY      = H / 10;
            var arrowWidth     = 0.007 * H;
            var currX          = splitX;

            // Glow circle behind arrow
            ctx.beginPath();
            ctx.arc(currX, arrowPosY, arrowLength * 0.7, 0, Math.PI * 2, false);
            ctx.fillStyle = '#FFD79340';
            ctx.fill();

            // Divider line
            ctx.beginPath();
            ctx.moveTo(splitX, 0);
            ctx.lineTo(splitX, H);
            ctx.strokeStyle = '#AAAAAA';
            ctx.lineWidth = 5;
            ctx.stroke();

            // Double-arrow indicator (same shape as Ref-NeRF)
            ctx.beginPath();
            ctx.moveTo(currX, arrowPosY - arrowWidth / 2);
            ctx.lineTo(currX + arrowLength/2 - arrowheadLen/2, arrowPosY - arrowWidth / 2);
            ctx.lineTo(currX + arrowLength/2 - arrowheadLen/2, arrowPosY - arrowheadWidth / 2);
            ctx.lineTo(currX + arrowLength/2, arrowPosY);
            ctx.lineTo(currX + arrowLength/2 - arrowheadLen/2, arrowPosY + arrowheadWidth / 2);
            ctx.lineTo(currX + arrowLength/2 - arrowheadLen/2, arrowPosY + arrowWidth / 2);
            ctx.lineTo(currX - arrowLength/2 + arrowheadLen/2, arrowPosY + arrowWidth / 2);
            ctx.lineTo(currX - arrowLength/2 + arrowheadLen/2, arrowPosY + arrowheadWidth / 2);
            ctx.lineTo(currX - arrowLength/2, arrowPosY);
            ctx.lineTo(currX - arrowLength/2 + arrowheadLen/2, arrowPosY - arrowheadWidth / 2);
            ctx.lineTo(currX - arrowLength/2 + arrowheadLen/2, arrowPosY);
            ctx.lineTo(currX - arrowLength/2 + arrowheadLen/2, arrowPosY - arrowWidth / 2);
            ctx.lineTo(currX, arrowPosY - arrowWidth / 2);
            ctx.closePath();
            ctx.fillStyle = '#AAAAAA';
            ctx.fill();

            // Labels – each clipped to its own video region so the divider cuts them naturally
            var labelH   = Math.round(0.055 * H);
            var labelPad = Math.round(0.018 * H);
            var margin   = Math.round(0.018 * W);
            var ly       = labelPad + labelH;
            ctx.font = 'bold italic ' + labelH + 'px Georgia, "Times New Roman", serif';

            // Left label – clipped to left (vidA) region
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, splitX, H);
            ctx.clip();
            var leftText = '3DGS Densification';
            var leftW    = ctx.measureText(leftText).width;
            var lboxW    = leftW + 2 * labelPad;
            ctx.beginPath();
            ctx.fillStyle = 'rgba(180, 180, 180, 0.55)';
            ctx.roundRect(margin, labelPad, lboxW, labelH + labelPad, labelH / 2);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.fillText(leftText, margin + labelPad, ly);
            ctx.restore();

            // Right label – clipped to right (vidB) region
            ctx.save();
            ctx.beginPath();
            ctx.rect(splitX, 0, W - splitX, H);
            ctx.clip();
            var rightText = 'TAD-GS (Ours)';
            var rightW    = ctx.measureText(rightText).width;
            var rboxW     = rightW + 2 * labelPad;
            var rboxX     = W - margin - rboxW;
            ctx.beginPath();
            ctx.fillStyle = 'rgba(180, 180, 180, 0.55)';
            ctx.roundRect(rboxX, labelPad, rboxW, labelH + labelPad, labelH / 2);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.fillText(rightText, rboxX + labelPad, ly);
            ctx.restore();

            requestAnimationFrame(drawLoop);
        }
        requestAnimationFrame(drawLoop);
    }

    if (vidA.readyState > 3) {
        setupAndPlay();
    } else {
        vidA.addEventListener('canplay', setupAndPlay, { once: true });
    }
}
