/**
 * 爆款象棋 MVP v2.0
 * 新增功能：规则引擎 (Rule Engine) + 回合管理 + 贪婪AI
 */

const CONFIG = {
    width: 450,
    height: 550,
    gridSize: 50,
    boardPadding: 25,
    pieceSize: 22,
    colors: {
        board: 0xE6B080,
        line: 0x5C3A21,
        red: 0xD63031,
        black: 0x2D3436,
        select: 0x0984e3,
        valid: 0x00b894 // 新增：合法落点提示色
    }
};

class XiangqiGame {
    constructor() {
        this.app = new PIXI.Application({
            width: CONFIG.width,
            height: CONFIG.height,
            backgroundColor: 0x222222,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            antialias: true
        });
        document.getElementById('game-container').appendChild(this.app.view);

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
        this.isProcessing = false;
        this.isRedTurn = true; // 新增：回合标记

        this.drawBoard();
        this.initPieces();
        this.setupInteraction();
        
        // 升级版 AI
        this.ai = new GreedyAI();
    }

    // --- 渲染层 (保持不变) ---
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

        const style = new PIXI.TextStyle({ fontFamily: 'KaiTi, Arial', fontSize: 28, fill: CONFIG.colors.line, alpha: 0.6 });
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
        const text = new PIXI.Text(name, { fontFamily: 'KaiTi, Arial', fontSize: 24, fill: color, fontWeight: 'bold' });
        text.anchor.set(0.5); text.y = -2;
        container.addChild(g, text);
        return this.app.renderer.generateTexture(container);
    }

    initPieces() {
        // 标准开局布局
        const layout = [
            {name: '车', x: 0, y: 9}, {name: '马', x: 1, y: 9}, {name: '相', x: 2, y: 9}, {name: '士', x: 3, y: 9}, {name: '帅', x: 4, y: 9}, {name: '士', x: 5, y: 9}, {name: '相', x: 6, y: 9}, {name: '马', x: 7, y: 9}, {name: '车', x: 8, y: 9},
            {name: '炮', x: 1, y: 7}, {name: '炮', x: 7, y: 7},
            {name: '兵', x: 0, y: 6}, {name: '兵', x: 2, y: 6}, {name: '兵', x: 4, y: 6}, {name: '兵', x: 6, y: 6}, {name: '兵', x: 8, y: 6},
            
            {name: '车', x: 0, y: 0}, {name: '马', x: 1, y: 0}, {name: '象', x: 2, y: 0}, {name: '士', x: 3, y: 0}, {name: '将', x: 4, y: 0}, {name: '士', x: 5, y: 0}, {name: '象', x: 6, y: 0}, {name: '马', x: 7, y: 0}, {name: '车', x: 8, y: 0},
            {name: '炮', x: 1, y: 2}, {name: '炮', x: 7, y: 2},
            {name: '卒', x: 0, y: 3}, {name: '卒', x: 2, y: 3}, {name: '卒', x: 4, y: 3}, {name: '卒', x: 6, y: 3}, {name: '卒', x: 8, y: 3}
        ];

        layout.forEach(p => {
            const isRed = p.y > 4; // 下半部分是红方
            const sprite = new PIXI.Sprite(this.createPieceTexture(p.name, isRed));
            sprite.anchor.set(0.5);
            sprite.x = p.x * CONFIG.gridSize;
            sprite.y = p.y * CONFIG.gridSize;
            sprite.interactive = true;
            sprite.buttonMode = true;
            sprite.data = { ...p, red: isRed, type: p.name }; // 存储类型用于规则判断
            this.piecesContainer.addChild(sprite);
            this.pieces[`${p.x},${p.y}`] = sprite;
        });
    }

    // --- 3. 交互逻辑 (升级版) ---
    setupInteraction() {
        this.boardContainer.interactive = true;
        this.boardContainer.hitArea = new PIXI.Rectangle(-25, -25, 450, 500);
        this.boardContainer.on('pointerdown', (e) => {
            if (this.isProcessing || !this.isRedTurn) return; // 只有红方回合且未处理动画时可操作
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

        // 1. 选择自己的棋子
        if (targetPiece && targetPiece.data.red === this.isRedTurn) {
            this.selectPiece(targetPiece);
            return;
        }

        // 2. 移动或吃子
        if (this.selectedPiece) {
            // 规则校验！！！
            if (Rules.canMove(this.selectedPiece.data, x, y, this.pieces)) {
                this.movePiece(this.selectedPiece, x, y, targetPiece);
            } else {
                // 违规操作反馈：轻微摇头动画
                gsap.to(this.selectedPiece, {x: this.selectedPiece.x + 5, duration: 0.05, yoyo: true, repeat: 3});
                if (navigator.vibrate) navigator.vibrate(50); // 错误震动
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

        // 动画
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
            
            // 游戏结束判断
            if (capturedPiece.data.type === '帅' || capturedPiece.data.type === '将') {
                alert(sprite.data.red ? "红方胜！" : "黑方胜！");
                location.reload();
                return;
            }
        } else {
            if (navigator.vibrate) navigator.vibrate(15);
            this.createDust(tx * CONFIG.gridSize, ty * CONFIG.gridSize);
        }

        this.selectedPiece.alpha = 1;
        this.selectedPiece = null;
        
        // 切换回合
        this.isRedTurn = !this.isRedTurn;

        // 如果轮到黑方(AI)，延迟执行
        if (!this.isRedTurn) {
            setTimeout(() => {
                this.ai.makeMove(this);
                this.isProcessing = false;
            }, 500);
        } else {
            this.isProcessing = false;
        }
    }

    // --- 特效层 (保持不变) ---
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
            const dx = (Math.random() - 0.5) * intensity * damp;
            const dy = (Math.random() - 0.5) * intensity * damp;
            this.mainStage.position.set(originalPos.x + dx, originalPos.y + dy);
        };
        this.app.ticker.add(shakeTicker);
    }
    createExplosion(x, y) {
        for (let i = 0; i < 20; i++) {
            const p = new PIXI.Graphics();
            p.beginFill(0xFFD700); p.drawCircle(0, 0, Math.random() * 4 + 2); p.endFill();
            p.x = x; p.y = y; this.fxContainer.addChild(p);
            const angle = Math.random() * Math.PI * 2;
            gsap.to(p, { x: x + Math.cos(angle) * 100, y: y + Math.sin(angle) * 100, alpha: 0, duration: 0.6, ease: "power2.out", onComplete: () => this.fxContainer.removeChild(p) });
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

// --- 4. 规则引擎 (核心逻辑) ---
class Rules {
    static canMove(piece, tx, ty, pieces) {
        const dx = tx - piece.x;
        const dy = ty - piece.y;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        
        // 不能原地不动
        if (dx === 0 && dy === 0) return false;

        // 目标点如果有己方棋子，不能走
        const targetKey = `${tx},${ty}`;
        if (pieces[targetKey] && pieces[targetKey].data.red === piece.red) return false;

        // 根据棋子类型判断
        switch (piece.type) {
            case '车':
                return (dx === 0 || dy === 0) && !this.hasObstacle(piece.x, piece.y, tx, ty, pieces);
            case '马':
                if (adx === 1 && ady === 2) return !pieces[`${piece.x},${piece.y + dy/2}`]; // 竖走防蹩脚
                if (adx === 2 && ady === 1) return !pieces[`${piece.x + dx/2},${piece.y}`]; // 横走防蹩脚
                return false;
            case '炮':
                if (dx !== 0 && dy !== 0) return false;
                const count = this.countObstacles(piece.x, piece.y, tx, ty, pieces);
                if (pieces[targetKey]) return count === 1; // 吃子必须隔一个
                return count === 0; // 移动中间不能有人
            case '相':
            case '象':
                if (adx !== 2 || ady !== 2) return false;
                if (pieces[`${piece.x + dx/2},${piece.y + dy/2}`]) return false; // 塞象眼
                if (piece.red && ty < 5) return false; // 相不过河
                if (!piece.red && ty > 4) return false; // 象不过河
                return true;
            case '士':
                if (adx !== 1 || ady !== 1) return false;
                if (piece.red) return tx >= 3 && tx <= 5 && ty >= 7; // 限制在九宫格
                else return tx >= 3 && tx <= 5 && ty <= 2;
            case '帅':
            case '将':
                if (adx + ady !== 1) return false; // 只能走一步直线
                // 简单判断：不能出九宫格 (老将对脸暂不判断)
                if (piece.red) return tx >= 3 && tx <= 5 && ty >= 7;
                else return tx >= 3 && tx <= 5 && ty <= 2;
            case '兵':
            case '卒':
                if (piece.red) {
                    if (ty > piece.y) return false; // 不能后退
                    if (piece.y >= 5) return dx === 0 && dy === -1; // 过河前只能向前
                    return (dx === 0 && dy === -1) || (adx === 1 && dy === 0); // 过河后可横走
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
        if (x1 === x2) { // 竖线
            const min = Math.min(y1, y2);
            const max = Math.max(y1, y2);
            for (let i = min + 1; i < max; i++) {
                if (pieces[`${x1},${i}`]) count++;
            }
        } else if (y1 === y2) { // 横线
            const min = Math.min(x1, x2);
            const max = Math.max(x1, x2);
            for (let i = min + 1; i < max; i++) {
                if (pieces[`${i},${y1}`]) count++;
            }
        }
        return count;
    }
}

// --- 5. 贪婪 AI (Greedy AI) ---
class GreedyAI {
    makeMove(game) {
        const blackPieces = Object.values(game.pieces).filter(p => !p.data.red);
        if (blackPieces.length === 0) return;

        let bestMove = null;
        let maxScore = -1000;

        // 简单的价值表
        const values = { '车': 100, '马': 45, '炮': 50, '相': 20, '象': 20, '士': 20, '帅': 1000, '将': 1000, '兵': 10, '卒': 10 };

        // 遍历所有黑棋
        for (let piece of blackPieces) {
            // 遍历所有可能的落点 (简单粗暴全图扫描，性能足够)
            for (let x = 0; x < 9; x++) {
                for (let y = 0; y < 10; y++) {
                    if (Rules.canMove(piece.data, x, y, game.pieces)) {
                        const targetKey = `${x},${y}`;
                        const target = game.pieces[targetKey];
                        
                        let score = Math.random() * 10; // 基础分带点随机，防止死板
                        if (target && target.data.red) {
                            // 如果能吃子，加上棋子价值
                            score += values[target.data.type] || 0;
                        }

                        if (score > maxScore) {
                            maxScore = score;
                            bestMove = { piece, tx: x, ty: y, target };
                        }
                    }
                }
            }
        }

        if (bestMove) {
            game.movePiece(bestMove.piece, bestMove.tx, bestMove.ty, bestMove.target);
        }
    }
}

new XiangqiGame();
