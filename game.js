/**
 * 爆款象棋 MVP v2.1 (防卡死增强版)
 * 修复：AI 思考崩溃导致的死锁
 * 修复：规则判断漏洞
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
        // 清理旧的 canvas 防止重影
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
        this.mainStage.x = (CONFIG.width - (8 * CONFIG.gridSize)) / 2;
        this.mainStage.y = (CONFIG.height - (9 * CONFIG.gridSize)) / 2;
        
        this.app.stage.addChild(this.mainStage);
        this.mainStage.addChild(this.boardContainer);
        this.mainStage.addChild(this.piecesContainer);
        this.mainStage.addChild(this.fxContainer);

        this.pieces = {}; 
        this.selectedPiece = null;
        this.isProcessing = false; // 核心锁
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
        // 绘制网格
        for (let i = 0; i < 10; i++) { g.moveTo(0, i * CONFIG.gridSize); g.lineTo(8 * CONFIG.gridSize, i * CONFIG.gridSize); }
        for (let i = 0; i < 9; i++) {
            g.moveTo(i * CONFIG.gridSize, 0); g.lineTo(i * CONFIG.gridSize, 4 * CONFIG.gridSize);
            g.moveTo(i * CONFIG.gridSize, 5 * CONFIG.gridSize); g.lineTo(i * CONFIG.gridSize, 9 * CONFIG.gridSize);
        }
        // 楚河汉界两侧封口
        g.moveTo(0, 4 * CONFIG.gridSize); g.lineTo(0, 5 * CONFIG.gridSize);
        g.moveTo(8 * CONFIG.gridSize, 4 * CONFIG.gridSize); g.lineTo(8 * CONFIG.gridSize, 5 * CONFIG.gridSize);
        // 九宫格
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
        // 棋子阴影
        g.beginFill(0x000000, 0.3); g.drawCircle(3, 3, CONFIG.pieceSize); g.endFill();
        // 棋子主体
        g.beginFill(0xE8D0A9); g.lineStyle(2, color, 1); g.drawCircle(0, 0, CONFIG.pieceSize); g.endFill();
        // 内圈装饰
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
            sprite.interactive = true;
            sprite.buttonMode = true;
            sprite.data = { ...p, red: isRed, type: p.name };
            this.piecesContainer.addChild(sprite);
            this.pieces[`${p.x},${p.y}`] = sprite;
        });
    }

    setupInteraction() {
        this.boardContainer.interactive = true;
        this.boardContainer.hitArea = new PIXI.Rectangle(-25, -25, 450, 525);
        this.boardContainer.on('pointerdown', (e) => {
            // 🚨 核心修复：如果正在处理中，直接无视点击，防止逻辑错乱
            if (this.isProcessing) {
                console.log("Game is processing, click ignored.");
                return;
            }
            // 如果不是红方回合，也不准点
            if (!this.isRedTurn) return;

            const pos = e.data.getLocalPosition(this.boardContainer);
            // 四舍五入获取最近的格点
            const gx = Math.round(pos.x / CONFIG.gridSize);
            const gy = Math.round(pos.y / CONFIG.gridSize);
            this.handleGridClick(gx, gy);
        });
    }

    handleGridClick(x, y) {
        if (x < 0 || x > 8 || y < 0 || y > 9) return;
        const targetKey = `${x},${y}`;
        const targetPiece = this.pieces[targetKey];

        // 1. 点击自己的棋子 -> 选中
        if (targetPiece && targetPiece.data.red === this.isRedTurn) {
            this.selectPiece(targetPiece);
            return;
        }

        // 2. 点击其他地方 -> 如果有选中棋子，尝试移动
        if (this.selectedPiece) {
            if (Rules.canMove(this.selectedPiece.data, x, y, this.pieces)) {
                this.movePiece(this.selectedPiece, x, y, targetPiece);
            } else {
                // 移动不合法：震动提示
                gsap.to(this.selectedPiece, {x: this.selectedPiece.x + 5, duration: 0.05, yoyo: true, repeat: 3});
                if (navigator.vibrate) navigator.vibrate(50);
            }
        }
    }

    selectPiece(sprite) {
        if (this.selectedPiece) this.selectedPiece.alpha = 1;
        this.selectedPiece = sprite;
        sprite.alpha = 0.8;
        // 选中动画
        gsap.fromTo(sprite.scale, {x: 1, y: 1}, {x: 1.2, y: 1.2, duration: 0.1, yoyo: true, repeat: 1});
        if (navigator.vibrate) navigator.vibrate(10);
    }

    async movePiece(sprite, tx, ty, capturedPiece) {
        this.isProcessing = true; // 🔒 立即上锁
        
        // 更新数据
        const oldKey = `${sprite.data.x},${sprite.data.y}`;
        delete this.pieces[oldKey];
        
        sprite.data.x = tx;
        sprite.data.y = ty;
        this.pieces[`${tx},${ty}`] = sprite;

        // 播放动画
        await gsap.to(sprite, {
            x: tx * CONFIG.gridSize,
            y: ty * CONFIG.gridSize,
            duration: 0.2,
            ease: "power2.inOut"
        });

        // 吃子逻辑
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

        // 清除选中状态
        if (this.selectedPiece) this.selectedPiece.alpha = 1;
        this.selectedPiece = null;
        
        // 切换回合
        this.isRedTurn = !this.isRedTurn;

        // 🤖 AI 回合处理 (核心修复部分)
        if (!this.isRedTurn) {
            setTimeout(() => {
                try {
                    const moved = this.ai.makeMove(this);
                    if (!moved) {
                        // 🚨 救命稻草：如果 AI 没走棋，必须解锁！
                        console.warn("AI 投降了");
                        alert("对方无棋可走，你赢了！");
                        this.isRedTurn = true;
                        this.isProcessing = false; 
                    }
                    // 如果 moved 为 true，AI 会递归调用 movePiece，那里会处理解锁
                } catch (err) {
                    console.error("AI 崩溃:", err);
                    alert("AI 思考时短路了，轮回你走");
                    this.isRedTurn = true;
                    this.isProcessing = false;
                }
            }, 500);
        } else {
            // 轮回到玩家，解锁
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
        
        // 0. 基础检查：没动或者目标点有己方棋子
        if (dx === 0 && dy === 0) return false;
        const targetKey = `${tx},${ty}`;
        if (pieces[targetKey] && pieces[targetKey].data.red === piece.red) return false;

        // 1. 具体规则
        switch (piece.type) {
            case '车':
                return (dx === 0 || dy === 0) && !this.hasObstacle(piece.x, piece.y, tx, ty, pieces);
            case '马':
                // 马走日：必须是 1x2 或 2x1
                if (adx === 1 && ady === 2) return !pieces[`${piece.x},${piece.y + dy/2}`]; // 竖着别马腿
                if (adx === 2 && ady === 1) return !pieces[`${piece.x + dx/2},${piece.y}`]; // 横着别马腿
                return false;
            case '炮':
                if (dx !== 0 && dy !== 0) return false;
                const count = this.countObstacles(piece.x, piece.y, tx, ty, pieces);
                if (pieces[targetKey]) return count === 1; // 吃子需要 1 个炮架
                return count === 0; // 移动需要 0 个障碍
            case '相':
            case '象':
                // 象飞田：必须是 2x2
                if (adx !== 2 || ady !== 2) return false;
                // 象眼不能堵
                if (pieces[`${piece.x + dx/2},${piece.y + dy/2}`]) return false;
                // 不能过河
                if (piece.red && ty < 5) return false; // 红相不能去 y<5
                if (!piece.red && ty > 4) return false; // 黑象不能去 y>4
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
                    // 红兵只能往上(y减小)
                    if (ty > piece.y) return false;
                    // 过河前(y>=5)只能直走
                    if (piece.y >= 5) return dx === 0 && dy === -1;
                    // 过河后可以横走
                    return (dx === 0 && dy === -1) || (adx === 1 && dy === 0);
                } else {
                    // 黑卒只能往下(y增加)
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

            // 随机打乱顺序，防止 AI 总是走同一个棋子
            blackPieces.sort(() => Math.random() - 0.5);

            for (let piece of blackPieces) {
                for (let x = 0; x < 9; x++) {
                    for (let y = 0; y < 10; y++) {
                        // 必须使用 try-catch 保护规则判断，防止 Rules 报错导致 AI 崩溃
                        try {
                            if (Rules.canMove(piece.data, x, y, game.pieces)) {
                                const targetKey = `${x},${y}`;
                                const target = game.pieces[targetKey];
                                
                                let score = Math.random() * 5; 
                                if (target && target.data.red) {
                                    score += values[target.data.type] || 0;
                                    // 优先吃高价值的
                                    if (target.data.type === '帅') score += 10000;
                                }
                                // 鼓励过河
                                if (y > 4) score += 2;

                                if (score > maxScore) {
                                    maxScore = score;
                                    bestMove = { piece, tx: x, ty: y, target };
                                }
                            }
                        } catch (ruleErr) {
                            // 忽略单个规则错误
                        }
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
