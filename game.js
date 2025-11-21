/**
 * 爆款象棋 MVP v2.2 (修复点击失效版)
 * 修复：分层导致的点击事件被遮挡问题
 * 包含：防卡死机制 + 规则修正
 */

const CONFIG = {
    width: 450,
    height: 550,
    gridSize: 50,
    pieceSize: 22,
    colors: {
        board: 0xE6B080,
        line: 0x5C3A21,
        red: 0xD63031,
        black: 0x2D3436,
        select: 0x0984e3
    }
};

class XiangqiGame {
    constructor() {
        const container = document.getElementById('game-container');
        container.innerHTML = '';

        this.app = new PIXI.Application({
            width: CONFIG.width,
            height: CONFIG.height,
            backgroundColor: 0x222222,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            antialias: true
        });
        container.appendChild(this.app.view);

        this.boardContainer = new PIXI.Container();
        this.piecesContainer = new PIXI.Container();
        this.fxContainer = new PIXI.Container();
        
        this.mainStage = new PIXI.Container();
        // 居中舞台
        this.mainStage.x = (CONFIG.width - (8 * CONFIG.gridSize)) / 2;
        this.mainStage.y = (CONFIG.height - (9 * CONFIG.gridSize)) / 2;
        
        this.app.stage.addChild(this.mainStage);
        this.mainStage.addChild(this.boardContainer);
        this.mainStage.addChild(this.piecesContainer);
        this.mainStage.addChild(this.fxContainer);

        this.pieces = {}; 
        this.selectedPiece = null;
        this.isProcessing = false; 
        this.isRedTurn = true;

        this.drawBoard();
        this.initPieces();
        this.setupInteraction();
        
        this.ai = new GreedyAI();
    }

    drawBoard() {
        const g = new PIXI.Graphics();
        g.beginFill(CONFIG.colors.board);
        g.drawRoundedRect(-20, -20, 8 * CONFIG.gridSize + 40, 9 * CONFIG.gridSize + 40, 10);
        g.endFill();
        g.lineStyle(2, CONFIG.colors.line, 0.8);
        
        for (let i = 0; i < 10; i++) { g.moveTo(0, i * CONFIG.gridSize); g.lineTo(8 * CONFIG.gridSize, i * CONFIG.gridSize); }
        for (let i = 0; i < 9; i++) {
            g.moveTo(i * CONFIG.gridSize, 0); g.lineTo(i * CONFIG.gridSize, 4 * CONFIG.gridSize);
            g.moveTo(i * CONFIG.gridSize, 5 * CONFIG.gridSize); g.lineTo(i * CONFIG.gridSize, 9 * CONFIG.gridSize);
        }
        g.moveTo(0, 4 * CONFIG.gridSize); g.lineTo(0, 5 * CONFIG.gridSize);
        g.moveTo(8 * CONFIG.gridSize, 4 * CONFIG.gridSize); g.lineTo(8 * CONFIG.gridSize, 5 * CONFIG.gridSize);
        
        g.moveTo(3 * CONFIG.gridSize, 0); g.lineTo(5 * CONFIG.gridSize, 2 * CONFIG.gridSize);
        g.moveTo(5 * CONFIG.gridSize, 0); g.lineTo(3 * CONFIG.gridSize, 2 * CONFIG.gridSize);
        g.moveTo(3 * CONFIG.gridSize, 7 * CONFIG.gridSize); g.lineTo(5 * CONFIG.gridSize, 9 * CONFIG.gridSize);
        g.moveTo(5 * CONFIG.gridSize, 7 * CONFIG.gridSize); g.lineTo(3 * CONFIG.gridSize, 9 * CONFIG.gridSize);

        const style = new PIXI.TextStyle({ fontFamily: 'Arial', fontSize: 28, fill: CONFIG.colors.line, alpha: 0.6 });
        const text1 = new PIXI.Text('楚 河', style); const text2 = new PIXI.Text('汉 界', style);
        text1.anchor.set(0.5); text2.anchor.set(0.5);
        text1.position.set(2 * CONFIG.gridSize, 4.5 * CONFIG.gridSize);
        text2.position.set(6 * CONFIG.gridSize, 4.5 * CONFIG.gridSize);
        this.boardContainer.addChild(g, text1, text2);
    }

    createPieceTexture(name, isRed) {
        const container = new PIXI.Container();
        const g = new PIXI.Graphics();
        const color = isRed ? CONFIG.colors.red : CONFIG.colors.black;
        g.beginFill(0x000000, 0.3); g.drawCircle(3, 3, CONFIG.pieceSize); g.endFill();
        g.beginFill(0xE8D0A9); g.lineStyle(2, color, 1); g.drawCircle(0, 0, CONFIG.pieceSize); g.endFill();
        g.lineStyle(1, color, 0.5); g.drawCircle(0, 0, CONFIG.pieceSize - 4);
        const text = new PIXI.Text(name, { fontFamily: 'Arial', fontSize: 24, fill: color, fontWeight: 'bold' });
        text.anchor.set(0.5); text.y = 2; 
        container.addChild(g, text);
        return this.app.renderer.generateTexture(container);
    }

    initPieces() {
        const layout = [
            {name: '车', x: 0, y: 9}, {name: '马', x: 1, y: 9}, {name: '相', x: 2, y: 9}, {name: '士', x: 3, y: 9}, {name: '帅', x: 4, y: 9}, {name: '士', x: 5, y: 9}, {name: '相', x: 6, y: 9}, {name: '马', x: 7, y: 9}, {name: '车', x: 8, y: 9},
            {name: '炮', x: 1, y: 7}, {name: '炮', x: 7, y: 7},
            {name: '兵', x: 0, y: 6}, {name: '兵', x: 2, y: 6}, {name: '兵', x: 4, y: 6}, {name: '兵', x: 6, y: 6}, {name: '兵', x: 8, y: 6},
            
            {name: '车', x: 0, y: 0}, {name: '马', x: 1, y: 0}, {name: '象', x: 2, y: 0}, {name: '士', x: 3, y: 0}, {name: '将', x: 4, y: 0}, {name: '士', x: 5, y: 0}, {name: '象', x: 6, y: 0}, {name: '马', x: 7, y: 0}, {name: '车', x: 8, y: 0},
            {name: '炮', x: 1, y: 2}, {name: '炮', x: 7, y: 2},
            {name: '卒', x: 0, y: 3}, {name: '卒', x: 2, y: 3}, {name: '卒', x: 4, y: 3}, {name: '卒', x: 6, y: 3}, {name: '卒', x: 8, y: 3}
        ];

        layout.forEach(p => {
            const isRed = p.y > 4;
            const sprite = new PIXI.Sprite(this.createPieceTexture(p.name, isRed));
            sprite.anchor.set(0.5);
            sprite.x = p.x * CONFIG.gridSize;
            sprite.y = p.y * CONFIG.gridSize;
            // 关键：开启交互，这样鼠标放上去会变小手
            sprite.interactive = true;
            sprite.buttonMode = true;
            sprite.data = { ...p, red: isRed, type: p.name };
            this.piecesContainer.addChild(sprite);
            this.pieces[`${p.x},${p.y}`] = sprite;
        });
    }

    setupInteraction() {
        // 🚨 修复核心：将点击事件绑定在 mainStage 上，而不是 boardContainer
        // 这样无论点到棋子还是点到棋盘，事件都会冒泡上来，被这里捕获
        this.mainStage.interactive = true;
        // 设置点击区域覆盖整个棋盘，包括边缘
        this.mainStage.hitArea = new PIXI.Rectangle(-25, -25, 450, 525);

        this.mainStage.on('pointerdown', (e) => {
            if (this.isProcessing) return;
            if (!this.isRedTurn) return;

            // 获取相对于棋盘容器的坐标（因为棋盘容器在 mainStage 的 0,0 位置，所以坐标通用）
            const pos = e.data.getLocalPosition(this.boardContainer);
            const gx = Math.round(pos.x / CONFIG.gridSize);
            const gy = Math.round(pos.y / CONFIG.gridSize);
            
            this.handleGridClick(gx, gy);
        });
    }

    handleGridClick(x, y) {
        if (x < 0 || x > 8 || y < 0 || y > 9) return;
        const targetKey = `${x},${y}`;
        const targetPiece = this.pieces[targetKey];

        if (targetPiece && targetPiece.data.red === this.isRedTurn) {
            this.selectPiece(targetPiece);
            return;
        }

        if (this.selectedPiece) {
            if (Rules.canMove(this.selectedPiece.data, x, y, this.pieces)) {
                this.movePiece(this.selectedPiece, x, y, targetPiece);
            } else {
                gsap.to(this.selectedPiece, {x: this.selectedPiece.x + 5, duration: 0.05, yoyo: true, repeat: 3});
                if (navigator.vibrate) navigator.vibrate(50);
            }
        }
    }

    selectPiece(sprite) {
        if (this.selectedPiece) this.selectedPiece.alpha = 1;
        this.selectedPiece = sprite;
        sprite.alpha = 0.8;
        gsap.fromTo(sprite.scale, {x: 1, y: 1}, {x: 1.2, y: 1.2, duration: 0.1, yoyo: true, repeat: 1});
        if (navigator.vibrate) navigator.vibrate(10);
    }

    async movePiece(sprite, tx, ty, capturedPiece) {
        this.isProcessing = true;
        
        const oldKey = `${sprite.data.x},${sprite.data.y}`;
        delete this.pieces[oldKey];
        
        sprite.data.x = tx;
        sprite.data.y = ty;
        this.pieces[`${tx},${ty}`] = sprite;

        await gsap.to(sprite, {
            x: tx * CONFIG.gridSize,
            y: ty * CONFIG.gridSize,
            duration: 0.2,
            ease: "power2.inOut"
        });

        if (capturedPiece) {
            this.createExplosion(capturedPiece.x, capturedPiece.y);
            this.piecesContainer.removeChild(capturedPiece);
            if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
            this.screenshake(5, 300);
            
            if (capturedPiece.data.type === '帅' || capturedPiece.data.type === '将') {
                alert(sprite.data.red ? "红方胜！" : "黑方胜！");
                location.reload();
                return;
            }
        } else {
            if (navigator.vibrate) navigator.vibrate(15);
            this.createDust(tx * CONFIG.gridSize, ty * CONFIG.gridSize);
        }

        if (this.selectedPiece) this.selectedPiece.alpha = 1;
        this.selectedPiece = null;
        
        this.isRedTurn = !this.isRedTurn;

        if (!this.isRedTurn) {
            setTimeout(() => {
                try {
                    const moved = this.ai.makeMove(this);
                    if (!moved) {
                        console.warn("AI 投降了");
                        alert("对方无棋可走，你赢了！");
                        this.isRedTurn = true;
                        this.isProcessing = false; 
                    }
                } catch (err) {
                    console.error("AI 崩溃:", err);
                    alert("AI 思考时短路了，轮回你走");
                    this.isRedTurn = true;
                    this.isProcessing = false;
                }
            }, 500);
        } else {
            this.isProcessing = false;
        }
    }

    screenshake(intensity, duration) {
        const originalPos = {x: this.mainStage.x, y: this.mainStage.y};
        const startTime = Date.now();
        const shakeTicker = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed > duration) {
                this.mainStage.position.set(originalPos.x, originalPos.y);
                this.app.ticker.remove(shakeTicker);
                return;
            }
            const damp = 1 - (elapsed / duration);
            this.mainStage.position.set(
                originalPos.x + (Math.random() - 0.5) * intensity * damp,
                originalPos.y + (Math.random() - 0.5) * intensity * damp
            );
        };
        this.app.ticker.add(shakeTicker);
    }
    createExplosion(x, y) {
        for (let i = 0; i < 20; i++) {
            const p = new PIXI.Graphics();
            p.beginFill(0xFFD700); p.drawCircle(0, 0, Math.random() * 4 + 2); p.endFill();
            p.x = x; p.y = y; this.fxContainer.addChild(p);
            gsap.to(p, { x: x + (Math.random()-0.5)*200, y: y + (Math.random()-0.5)*200, alpha: 0, duration: 0.6, onComplete: () => this.fxContainer.removeChild(p) });
        }
    }
    createDust(x, y) {
        const dust = new PIXI.Graphics();
        dust.lineStyle(2, 0xFFFFFF, 0.5); dust.drawCircle(0, 0, CONFIG.pieceSize);
        dust.x = x; dust.y = y; dust.scale.set(0.5); this.fxContainer.addChild(dust);
        gsap.to(dust.scale, {x: 1.5, y: 1.5, duration: 0.3});
        gsap.to(dust, {alpha: 0, duration: 0.3, onComplete: () => this.fxContainer.removeChild(dust)});
    }
}

class Rules {
    static canMove(piece, tx, ty, pieces) {
        const dx = tx - piece.x;
        const dy = ty - piece.y;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        
        if (dx === 0 && dy === 0) return false;
        const targetKey = `${tx},${ty}`;
        if (pieces[targetKey] && pieces[targetKey].data.red === piece.red) return false;

        switch (piece.type) {
            case '车':
                return (dx === 0 || dy === 0) && !this.hasObstacle(piece.x, piece.y, tx, ty, pieces);
            case '马':
                if (adx === 1 && ady === 2) return !pieces[`${piece.x},${piece.y + dy/2}`];
                if (adx === 2 && ady === 1) return !pieces[`${piece.x + dx/2},${piece.y}`];
                return false;
            case '炮':
                if (dx !== 0 && dy !== 0) return false;
                const count = this.countObstacles(piece.x, piece.y, tx, ty, pieces);
                if (pieces[targetKey]) return count === 1;
                return count === 0;
            case '相':
            case '象':
                if (adx !== 2 || ady !== 2) return false;
                if (pieces[`${piece.x + dx/2},${piece.y + dy/2}`]) return false;
                if (piece.red && ty < 5) return false;
                if (!piece.red && ty > 4) return false;
                return true;
            case '士':
                if (adx !== 1 || ady !== 1) return false;
                if (piece.red) return tx >= 3 && tx <= 5 && ty >= 7;
                else return tx >= 3 && tx <= 5 && ty <= 2;
            case '帅':
            case '将':
                if (adx + ady !== 1) return false;
                if (piece.red) return tx >= 3 && tx <= 5 && ty >= 7;
                else return tx >= 3 && tx <= 5 && ty <= 2;
            case '兵':
            case '卒':
                if (piece.red) {
                    if (ty > piece.y) return false;
                    if (piece.y >= 5) return dx === 0 && dy === -1;
                    return (dx === 0 && dy === -1) || (adx === 1 && dy === 0);
                } else {
                    if (ty < piece.y) return false;
                    if (piece.y <= 4) return dx === 0 && dy === 1;
                    return (dx === 0 && dy === 1) || (adx === 1 && dy === 0);
                }
        }
        return true;
    }

    static hasObstacle(x1, y1, x2, y2, pieces) {
        return this.countObstacles(x1, y1, x2, y2, pieces) > 0;
    }

    static countObstacles(x1, y1, x2, y2, pieces) {
        let count = 0;
        if (x1 === x2) {
            const min = Math.min(y1, y2);
            const max = Math.max(y1, y2);
            for (let i = min + 1; i < max; i++) {
                if (pieces[`${x1},${i}`]) count++;
            }
        } else if (y1 === y2) {
            const min = Math.min(x1, x2);
            const max = Math.max(x1, x2);
            for (let i = min + 1; i < max; i++) {
                if (pieces[`${i},${y1}`]) count++;
            }
        }
        return count;
    }
}

class GreedyAI {
    makeMove(game) {
        try {
            const blackPieces = Object.values(game.pieces).filter(p => !p.data.red);
            if (blackPieces.length === 0) return false;

            let bestMove = null;
            let maxScore = -9999;
            const values = { '车': 100, '马': 45, '炮': 50, '相': 20, '象': 20, '士': 20, '帅': 1000, '将': 1000, '兵': 10, '卒': 10 };

            blackPieces.sort(() => Math.random() - 0.5);

            for (let piece of blackPieces) {
                for (let x = 0; x < 9; x++) {
                    for (let y = 0; y < 10; y++) {
                        try {
                            if (Rules.canMove(piece.data, x, y, game.pieces)) {
                                const targetKey = `${x},${y}`;
                                const target = game.pieces[targetKey];
                                
                                let score = Math.random() * 5; 
                                if (target && target.data.red) {
                                    score += values[target.data.type] || 0;
                                    if (target.data.type === '帅') score += 10000;
                                }
                                if (y > 4) score += 2;

                                if (score > maxScore) {
                                    maxScore = score;
                                    bestMove = { piece, tx: x, ty: y, target };
                                }
                            }
                        } catch (ruleErr) { }
                    }
                }
            }

            if (bestMove) {
                game.movePiece(bestMove.piece, bestMove.tx, bestMove.ty, bestMove.target);
                return true;
            }
            return false;
        } catch (e) {
            console.error("AI Error:", e);
            return false;
        }
    }
}

new XiangqiGame();
