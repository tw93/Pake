var l=Object.defineProperty,d=Object.defineProperties;var m=Object.getOwnPropertyDescriptors;var o=Object.getOwnPropertySymbols;var y=Object.prototype.hasOwnProperty,u=Object.prototype.propertyIsEnumerable;var a=(e,t,i)=>t in e?l(e,t,{enumerable:!0,configurable:!0,writable:!0,value:i}):e[t]=i,r=(e,t)=>{for(var i in t||(t={}))y.call(t,i)&&a(e,i,t[i]);if(o)for(var i of o(t))u.call(t,i)&&a(e,i,t[i]);return e},s=(e,t)=>d(e,m(t));var n=(e,t,i)=>a(e,typeof t!="symbol"?t+"":t,i);import{d6 as h,ce as f,b2 as p}from"./index-DzJUk-4s.js";import{ah as c}from"./index-B2h3DCGB.js";import"./plugin-BZaVEG5Y.js";import"./icon-Bt2TghsQ.js";import"./file-BoGdIhh5.js";import"./systemStore-CDAOEx2u.js";import"./index-DumZb7Zp.js";import"./index-YIaHLc6Z.js";import"./fileTypeEnum-22QBGXO_.js";const g=`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DataV Style Animated Border</title>
    <style>
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        canvas {
            display: block;
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <canvas id="animatedBorderCanvas"></canvas>
    <script>
        const canvas = document.getElementById('animatedBorderCanvas');
        const ctx = canvas.getContext('2d');
        const BASE_LINE_COLOR = '#42aaff';
        const BASE_LINE_WIDTH = 3;
        const INNER_LINE_COLOR = '#33aadd';
        const INNER_LINE_WIDTH = 1.5;
        const ANIM_LINE_COLOR = '#88eeff';
        const ANIM_LINE_WIDTH = 5;
        const DETAIL_LINE_COLOR = '#42aaff';
        const DETAIL_LINE_WIDTH = 1.5;
        const PARTICLE_COLOR = '#66b3ff';
        const ORIGINAL_CANVAS_WIDTH = 1000;
        const ORIGINAL_CANVAS_HEIGHT = 600;
        let scaleX = 1;
        let scaleY = 1;

        function resizeCanvas() {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            scaleX = canvas.width / ORIGINAL_CANVAS_WIDTH;
            scaleY = canvas.height / ORIGINAL_CANVAS_HEIGHT;
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        function scalePoint(x, y) {
            return { x: x * scaleX, y: y * scaleY };
        }

        function drawLineSegment(points, color, width, opacity = 1) {
            ctx.strokeStyle = color;
            ctx.lineWidth = width * Math.min(scaleX, scaleY);
            ctx.globalAlpha = opacity;
            ctx.beginPath();
            const p1 = scalePoint(points[0], points[1]);
            ctx.moveTo(p1.x, p1.y);
            for (let i = 2; i < points.length; i += 2) {
                const p = scalePoint(points[i], points[i+1]);
                ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        }

        function drawCircle(x, y, radius, color, opacity = 1) {
            ctx.fillStyle = color;
            ctx.globalAlpha = opacity;
            ctx.beginPath();
            const p = scalePoint(x, y);
            ctx.arc(p.x, p.y, radius * Math.min(scaleX, scaleY), 0, Math.PI * 2);
            ctx.fill();
        }

        function getBaseLineOpacity(elapsedTime, duration, delay) {
            const timeSinceStart = elapsedTime - delay;
            if (timeSinceStart < 0) return 1;
            const progress = (timeSinceStart % duration) / duration;
            const minOpacity = 0.1;
            const maxOpacity = 1;
            if (progress < 0.4) { return maxOpacity; }
            else if (progress < 0.8) { return maxOpacity - (progress - 0.4) / 0.4 * (maxOpacity - minOpacity); }
            else { return minOpacity + (progress - 0.8) / 0.2 * (maxOpacity - minOpacity); }
        }

        function getInnerLineOpacity(elapsedTime, duration, delay) {
            const timeSinceStart = elapsedTime - delay;
            if (timeSinceStart < 0) return 0;
            const progress = (timeSinceStart % duration) / duration;
            const maxOpacity = 1;
            if (progress < 0.2) { return progress / 0.2 * maxOpacity; }
            else if (progress < 0.7) { return maxOpacity; }
            else { return maxOpacity - (progress - 0.7) / 0.3 * maxOpacity; }
        }

        function getCubicBezierPoint(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t) {
            const mt = 1 - t;
            const mt2 = mt * mt;
            const mt3 = mt2 * mt;
            const t2 = t * t;
            const t3 = t2 * t;
            const x = mt3 * p0x + 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t3 * p3x;
            const y = mt3 * p0y + 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t3 * p3y;
            return { x, y };
        }

        function getPointOnPath(path, progress) {
            if (path.type === 'line') {
                const [x1, y1, x2, y2] = path.p;
                return { x: x1 + (x2 - x1) * progress, y: y1 + (y2 - y1) * progress };
            } else if (path.type === 'bezier') {
                const [p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y] = path.p;
                return getCubicBezierPoint(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, progress);
            }
            return { x: 0, y: 0 };
        }

        const baseLines = [
            { points: [50,50, 180,50], fade: false }, { points: [220,50, 480,50], fade: true, delay: 0.2 },
            { points: [520,50, 780,50], fade: false }, { points: [820,50, 950,50], fade: true, delay: 0.4 },
            { points: [950,50, 950,180], fade: false }, { points: [950,220, 950,300], fade: true, delay: 0.6 },
            { points: [950,340, 950,420], fade: false }, { points: [950,460, 950,550], fade: true, delay: 0.8 },
            { points: [950,550, 820,550], fade: false }, { points: [780,550, 520,550], fade: true, delay: 1.0 },
            { points: [480,550, 220,550], fade: false }, { points: [180,550, 50,550], fade: true, delay: 1.2 },
            { points: [50,550, 50,460], fade: false }, { points: [50,420, 50,340], fade: true, delay: 1.4 },
            { points: [50,300, 50,220], fade: false }, { points: [50,180, 50,50], fade: true, delay: 1.6 }
        ];

        const innerLines = [
            { points: [60,60, 170,60], delay: 0.1, duration: 3.5 }, { points: [190,60, 280,60], delay: 0.3, duration: 4 },
            { points: [300,60, 490,60], delay: 0.05, duration: 3 }, { points: [510,60, 700,60], delay: 0.25, duration: 4.5 },
            { points: [720,60, 810,60], delay: 0.45, duration: 3.8 }, { points: [830,60, 940,60], delay: 0.15, duration: 3.2 },
            { points: [940,60, 940,170], delay: 0.7, duration: 3.7 }, { points: [940,190, 940,280], delay: 0.9, duration: 4.2 },
            { points: [940,300, 940,490], delay: 0.6, duration: 3.3 }, { points: [940,510, 940,540], delay: 0.8, duration: 4.8 },
            { points: [940,540, 830,540], delay: 1.1, duration: 3.9 }, { points: [810,540, 720,540], delay: 1.3, duration: 4.4 },
            { points: [700,540, 510,540], delay: 1.05, duration: 3.6 }, { points: [490,540, 300,540], delay: 1.25, duration: 4.1 },
            { points: [280,540, 190,540], delay: 1.45, duration: 3.4 }, { points: [170,540, 60,540], delay: 1.15, duration: 4.6 },
            { points: [60,540, 60,510], delay: 1.7, duration: 4 }, { points: [60,490, 60,300], delay: 1.9, duration: 3.5 },
            { points: [60,280, 60,190], delay: 1.6, duration: 4.3 }, { points: [60,170, 60,60], delay: 1.8, duration: 3.1 }
        ];

        const animLines = [
            { points: [50,50, 950,50], duration: 4, begin: 0, length: 900, reverse: false },
            { points: [950,50, 950,550], duration: 3, begin: 0.5, length: 500, reverse: false },
            { points: [950,550, 50,550], duration: 4, begin: 1, length: 900, reverse: true },
            { points: [50,550, 50,50], duration: 3, begin: 1.5, length: 500, reverse: true }
        ];

        const detailLines = [
            [60,50, 60,60, 50,60], [180,50, 180,60], [50,180, 60,180], [50,60, 60,60],
            [940,50, 940,60, 950,60], [820,50, 820,60], [950,180, 940,180], [940,60, 950,60],
            [60,550, 60,540, 50,540], [180,550, 180,540], [50,460, 60,460], [50,540, 60,540],
            [940,550, 940,540, 950,540], [820,550, 820,540], [950,460, 940,460], [940,540, 950,540],
            [250,50, 250,60], [350,50, 350,60], [450,50, 450,60], [550,50, 550,60],
            [650,50, 650,60], [750,50, 750,60],
            [250,550, 250,540], [350,550, 350,540], [450,550, 450,540], [550,550, 550,540],
            [650,550, 650,540], [750,550, 750,540],
            [50,250, 60,250], [50,300, 60,300], [50,350, 60,350], [50,400, 60,400],
            [950,250, 940,250], [950,300, 940,300], [950,350, 940,350], [950,400, 940,400]
        ];

        const particlePaths = {
            path1_top: { type: 'line', p: [50, 47, 950, 47] },
            path2_top: { type: 'line', p: [50, 53, 950, 53] },
            path3_top: { type: 'bezier', p: [50, 50, 200, 40, 800, 40, 950, 50] },
            path1_right: { type: 'line', p: [953, 50, 953, 550] },
            path2_right: { type: 'line', p: [947, 50, 947, 550] },
            path1_bottom: { type: 'line', p: [950, 553, 50, 553] },
            path2_bottom: { type: 'line', p: [950, 547, 50, 547] },
            path1_left: { type: 'line', p: [47, 550, 47, 50] },
            path2_left: { type: 'line', p: [53, 550, 53, 50] },
        };

        const particles = [
            { pathId: 'path1_top', r: 1.5, motionDur: 5, motionDelay: 0.1, animDur: 2, rMin: 0.5, opacityMin: 0.1 },
            { pathId: 'path2_top', r: 1.2, motionDur: 4.5, motionDelay: 0.6, animDur: 2.5, rMin: 0.3, opacityMin: 0.05 },
            { pathId: 'path3_top', r: 1.8, motionDur: 5.8, motionDelay: 1.2, animDur: 3, rMin: 0.8, opacityMin: 0.2 },
            { pathId: 'path1_right', r: 1.5, motionDur: 4.2, motionDelay: 0.3, animDur: 2.1, rMin: 0.6, opacityMin: 0.15 },
            { pathId: 'path2_right', r: 1.2, motionDur: 5.3, motionDelay: 0.8, animDur: 2.6, rMin: 0.4, opacityMin: 0.08 },
            { pathId: 'path1_bottom', r: 1.8, motionDur: 5.6, motionDelay: 0.5, animDur: 3.1, rMin: 0.9, opacityMin: 0.25 },
            { pathId: 'path2_bottom', r: 1.3, motionDur: 4.7, motionDelay: 1.0, animDur: 2.3, rMin: 0.7, opacityMin: 0.12 },
            { pathId: 'path1_left', r: 1.6, motionDur: 4.9, motionDelay: 0.7, animDur: 2.9, rMin: 0.55, opacityMin: 0.18 },
            { pathId: 'path2_left', r: 1.1, motionDur: 3.9, motionDelay: 1.3, animDur: 2.4, rMin: 0.35, opacityMin: 0.07 },
        ];

        let lastFrameTime = 0;
        function animate(currentTime) {
            if (!lastFrameTime) lastFrameTime = currentTime;
            const elapsedTime = currentTime / 1000;
            lastFrameTime = currentTime;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();

            ctx.lineCap = 'butt'; ctx.lineJoin = 'bevel';
            baseLines.forEach(line => {
                let opacity = 1;
                if (line.fade) { opacity = getBaseLineOpacity(elapsedTime, 3, line.delay); }
                drawLineSegment(line.points, BASE_LINE_COLOR, BASE_LINE_WIDTH, opacity);
            });

            innerLines.forEach(line => {
                const opacity = getInnerLineOpacity(elapsedTime, line.duration, line.delay);
                drawLineSegment(line.points, INNER_LINE_COLOR, INNER_LINE_WIDTH, opacity);
            });

            detailLines.forEach(points => {
                drawLineSegment(points, DETAIL_LINE_COLOR, DETAIL_LINE_WIDTH);
            });

            ctx.shadowColor = ANIM_LINE_COLOR; ctx.shadowBlur = 5;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            animLines.forEach(line => {
                const timeActive = elapsedTime - line.begin;
                if (timeActive < 0) return;
                const progress = (timeActive % line.duration) / line.duration;
                let dashOffset;
                let scaledDashLength = line.length / 9 * Math.min(scaleX, scaleY);
                let scaledGapLength = (line.length - (line.length / 9)) * Math.min(scaleX, scaleY);
                if (line.reverse) {
                    dashOffset = line.length * scaleX - (line.length * scaleX * 2 * progress);
                } else {
                    dashOffset = -(line.length * scaleX * 2 * progress);
                }
                ctx.setLineDash([scaledDashLength, scaledGapLength]);
                ctx.lineDashOffset = dashOffset;
                drawLineSegment(line.points, ANIM_LINE_COLOR, ANIM_LINE_WIDTH);
            });
            ctx.shadowBlur = 0; ctx.setLineDash([]);
            ctx.lineCap = 'butt'; ctx.lineJoin = 'bevel';

            ctx.shadowColor = PARTICLE_COLOR; ctx.shadowBlur = 3;
            particles.forEach(p => {
                const path = particlePaths[p.pathId];
                const motionTimeActive = elapsedTime - p.motionDelay;
                if (motionTimeActive < 0) return;
                const motionProgress = (motionTimeActive % p.motionDur) / p.motionDur;
                const { x, y } = getPointOnPath(path, motionProgress);
                const rAnimTimeActive = motionTimeActive;
                const rAnimProgress = (rAnimTimeActive % p.animDur) / p.animDur;
                let currentR;
                if (rAnimProgress < 0.5) { currentR = p.r + (p.rMin - p.r) * (rAnimProgress * 2); }
                else { currentR = p.rMin + (p.r - p.rMin) * (rAnimProgress * 2 - 1); }
                const opacityAnimTimeActive = motionTimeActive;
                const opacityAnimProgress = (opacityAnimTimeActive % p.animDur) / p.animDur;
                let currentOpacity;
                if (opacityAnimProgress < 0.5) { currentOpacity = 0.7 + (p.opacityMin - 0.7) * (opacityAnimProgress * 2); }
                else { currentOpacity = p.opacityMin + (0.7 - p.opacityMin) * (opacityAnimProgress * 2 - 1); }
                drawCircle(x, y, currentR, PARTICLE_COLOR, currentOpacity);
            });
            ctx.shadowBlur = 0;
            ctx.restore();
            requestAnimationFrame(animate);
        }
        requestAnimationFrame(animate);
    <\/script>
</body>
</html>`,x={dataset:g};class N extends h{constructor(){super(...arguments);n(this,"key",c.key);n(this,"attr",s(r({},f),{zIndex:-1}));n(this,"chartConfig",p(c));n(this,"option",p(x))}}export{N as default,x as option};
