/**
 * ------------------------------------------------------------------
 * 爆款象棋 MVP - 核心逻辑 (game.js) - 修正版
 * ------------------------------------------------------------------
 */

const CONFIG = {
    width: 450,
    height: 550,
    gridSize: 50,
    pieceSize: 22,
    animDuration: 0.25,
    shakeIntensity: 6,
    colors: {
        bg: 0x222222,
        board: 0xE6B080,
        line: 0x5C3A21,
        red: 0xD63031,
        black: 0x2D3436,
        select: 0x0984e3,
        lastMove: 0x00b894
    }
};

class XiangqiGame {
    constructor() {
        this.app = new PIXI.Application({
            width: CONFIG.width,
            height: CONFIG.height,
            backgroundColor: CONFIG.colors.bg,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            antialias: true
        });
        
        const container = document.getElementById('game-container');
        if (container) {
            container.appendChild(this.app.view);
        } else {
            document.body.appendChild(this.app.view);
        }

        this.mainStage = new PIXI.Container();
        this.boardContainer = new PIXI.Container();
        this.piecesContainer = new PIXI.Container();
        this.fxContainer = new PIXI.Container();
        
        this.mainStage.x = (CONFIG.width - (8 * CONFIG.gridSize)) / 2;
        this.mainStage.y = (CONFIG.height - (9 * CONFIG.gridSize)) / 2;
        
        this.app.stage.addChild(this.mainStage);
        this.mainStage.addChild(this.boardContainer);
        this.mainStage.addChild(this.piecesContainer);
        this.mainStage.addChild(this.fxContainer);

        this.pieces = {};
        this.selectedPiece = null;
        this.isProcessing = false;
        this.turn = true; // true=红方

        this.drawBoard();
        this.initPieces();
        this.setupInteraction();
        
        this.ai = new MockAI();
    }

    drawBoard() {
        const g = new PIXI.Graphics();
        g.beginFill(CONFIG.colors.board);
        g.drawRoundedRect(-20, -20, 8 * CONFIG.gridSize + 40, 9 * CONFIG.gridSize + 40, 8);
        g.endFill();

        g.lineStyle(2, CONFIG.colors.line, 0.8);
        for (let i = 0; i < 10; i++) {
            g.moveTo(0, i * CONFIG.gridSize);
            g.lineTo(8 * CONFIG.gridSize, i * CONFIG.gridSize);
        }
        for (let i = 0; i < 9; i++) {
            g.moveTo(i * CONFIG.gridSize, 0);
            g.lineTo(i * CONFIG.gridSize, 4 * CONFIG.gridSize);
            g.moveTo(i * CONFIG.gridSize, 5 * CONFIG.gridSize);
            g.lineTo(i * CONFIG.gridSize, 9 * CONFIG.gridSize);
        }
        g.moveTo(0, 4 * CONFIG.gridSize);
        g.lineTo(0, 5 * CONFIG.gridSize);
        g.moveTo(8 * CONFIG.gridSize, 4 * CONFIG.gridSize);
        g.lineTo(8 * CONFIG.gridSize, 5 * CONFIG.gridSize);

        g.moveTo(3 * CONFIG.gridSize, 7 * CONFIG.gridSize); g.lineTo(5 * CONFIG.gridSize, 9 * CONFIG.gridSize);
        g.moveTo(5 * CONFIG.gridSize, 7 * CONFIG.gridSize); g.lineTo(3 * CONFIG.gridSize, 9 * CONFIG.gridSize);
        g.moveTo(3 * CONFIG.gridSize, 0); g.lineTo(5 * CONFIG.gridSize, 2 * CONFIG.gridSize);
        g.moveTo(5 * CONFIG.gridSize, 0); g.lineTo(3 * CONFIG.gridSize, 2 * CONFIG.gridSize);

        const style = new PIXI.TextStyle({
            fontFamily: 'KaiTi, "Microsoft YaHei", Arial',
            fontSize: 28,
            fill: CONFIG.colors.line,
            alpha: 0.5,
            fontWeight: 'bold'
        });
        const text1 = new PIXI.Text('楚 河', style);
        const text2 = new PIXI.Text('汉 界', style);
        text1.anchor.set(0.5); text2.anchor.set(0.5);
        text1.position.set(2.5 * CONFIG.gridSize, 4.5 * CONFIG.gridSize);
        text2.position.set(5.5 * CONFIG.gridSize, 4.5 * CONFIG.gridSize);
        
        this.boardContainer.addChild(g, text1, text2);
    }

    createPieceTexture(name, isRed) {
        const container = new PIXI.Container();
        const g = new PIXI.Graphics();
        const color = isRed ? CONFIG.colors.red : CONFIG.colors.black;
        
        g.beginFill(0x000000, 0.4);
        g.drawCircle(3, 3, CONFIG.pieceSize);
        g.endFill();

        g.beginFill(0xE8D0A9); 
        g.lineStyle(2, color, 1);
        g.drawCircle(0, 0, CONFIG.pieceSize);
        g.endFill();

        g.lineStyle(1, color, 0.5);
        g.drawCircle(0, 0, CONFIG.pieceSize - 4);

        const text = new PIXI.Text(name, {
            fontFamily: 'KaiTi, "Microsoft YaHei", Arial',
            fontSize: 24,
            fill: color,
            fontWeight: 'bold',
            padding: 5
        });
        text.anchor.set(0.5);
        text.y = -2; 

        container.addChild(g, text);
        return this.app.renderer.generateTexture(container);
    }

    initPieces() {
        const layout = [
            {name: '车', x: 0, y: 9, red: true}, {name: '马', x: 1, y: 9, red: true},
            {name: '相', x: 2, y: 9, red: true}, {name: '仕', x: 3, y: 9, red: true},
            {name: '帅', x: 4, y: 9, red: true}, {name: '仕', x: 5, y: 9, red: true},
            {name: '相', x: 6, y: 9, red: true}, {name: '马', x: 7, y: 9, red: true},
            {name: '车', x: 8, y: 9, red: true},
            {name: '炮', x: 1, y: 7, red: true}, {name: '炮', x: 7, y: 7, red: true},
            {name: '兵', x: 0, y: 6, red: true}, {name: '兵', x: 2, y: 6, red: true},
            {name: '兵', x: 4, y: 6, red: true}, {name: '兵', x: 6, y: 6, red: true},
            {name: '兵', x: 8, y: 6, red: true},
            {name: '车', x: 0, y: 0, red: false}, {name: '马', x: 1, y: 0, red: false},
            {name: '象', x: 2, y: 0, red: false}, {name: '士', x: 3, y: 0, red: false},
            {name: '将', x: 4, y: 0, red: false}, {name: '士', x: 5, y: 0, red: false},
            {name: '象', x: 6, y: 0, red: false}, {name: '马', x: 7, y: 0, red: false},
            {name: '车', x: 8, y: 0, red: false},
            {name: '炮', x: 1, y: 2, red: false}, {name: '炮', x: 7, y: 2, red: false},
            {name: '卒', x: 0, y: 3, red: false}, {name: '卒', x: 2, y: 3, red: false},
            {name: '卒', x: 4, y: 3, red: false}, {name: '卒', x: 6, y: 3, red: false},
            {name: '卒', x: 8, y: 3, red: false},
        ];

        layout.forEach(p => {
            const texture = this.createPieceTexture(p.name, p.red);
            const sprite = new PIXI.Sprite(texture);
            sprite.anchor.set(0.5);
            sprite.x = p.x * CONFIG.gridSize;
            sprite.y = p.y * CONFIG.gridSize;
            
            sprite.interactive = true;
            sprite.buttonMode = true;
            sprite.cursor = 'pointer';
            
            sprite.data = { ...p };
            
            // 修复：绑定棋子点击事件
            sprite.on('pointerdown', (e) => {
                e.stopPropagation();
                if (this.isProcessing || !this.turn) return;
                this.handleInput(sprite.data.x, sprite.data.y);
            });
            
            this.piecesContainer.addChild(sprite);
            this.pieces[`${p.x},${p.y}`] = sprite;
        });
    }

    setupInteraction() {
        this.boardContainer.interactive = true;
        this.boardContainer.hitArea = new PIXI.Rectangle(-25, -25, 450, 500);
        this.boardContainer.on('pointerdown', (e) => {
            if (this.isProcessing || !this.turn) return;
            const pos = e.data.getLocalPosition(this.boardContainer);
            const gx = Math.round(pos.x / CONFIG.gridSize);
            const gy = Math.round(pos.y / CONFIG.gridSize);
            this.handleInput(gx, gy);
        });
    }

    handleInput(x, y) {
        if (x < 0 || x > 8 || y < 0 || y > 9) return;

        const targetKey = `${x},${y}`;
        const targetPiece = this.pieces[targetKey];

        if (targetPiece && targetPiece.data.red) {
            this.selectPiece(targetPiece);
            return;
        }

        if (this.selectedPiece) {
            if (x === this.selectedPiece.data.x && y === this.selectedPiece.data.y) return;
            this.executeMove(this.selectedPiece, x, y, targetPiece);
        }
    }

    selectPiece(sprite) {
        if (this.selectedPiece) {
            this.selectedPiece.alpha = 1;
            gsap.killTweensOf(this.selectedPiece.scale);
            this.selectedPiece.scale.set(1);
        }
        
        this.selectedPiece = sprite;
        sprite.alpha = 0.8;
        gsap.to(sprite.scale, {x: 1.15, y: 1.15, duration: 0.4, yoyo: true, repeat: -1});
        if (navigator.vibrate) navigator.vibrate(10);
    }

    async executeMove(sprite, tx, ty, capturedPiece) {
        this.isProcessing = true;
        
        gsap.killTweensOf(sprite.scale);
        sprite.scale.set(1);

        const oldKey = `${sprite.data.x},${sprite.data.y}`;
        delete this.pieces[oldKey];
        
        sprite.data.x = tx;
        sprite.data.y = ty;
        this.pieces[`${tx},${ty}`] = sprite;

        await gsap.to(sprite, {
            x: tx * CONFIG.gridSize,
            y: ty * CONFIG.gridSize,
            duration: CONFIG.animDuration,
            ease: "back.out(1.2)" 
        });

        if (capturedPiece) {
            this.piecesContainer.removeChild(capturedPiece);
            this.playCaptureEffects(tx * CONFIG.gridSize, ty * CONFIG.gridSize);
        } else {
            this.playMoveEffects(tx * CONFIG.gridSize, ty * CONFIG.gridSize);
        }

        this.selectedPiece.alpha = 1;
        this.selectedPiece = null;
        this.turn = !this.turn;

        if (!this.turn) {
            setTimeout(() => {
                this.ai.makeMove(this);
            }, 600);
        } else {
            this.isProcessing = false;
        }
    }

    playCaptureEffects(x, y) {
        this.screenShake(CONFIG.shakeIntensity, 300);
        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);

        for (let i = 0; i < 25; i++) {
            const p = new PIXI.Graphics();
            p.beginFill(0xFFD700);
            p.drawCircle(0, 0, Math.random() * 4 + 2);
            p.endFill();
            p.x = x; p.y = y;
            this.fxContainer.addChild(p);

            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 80 + 20;
            
            gsap.to(p, {
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                alpha: 0,
                duration: 0.5 + Math.random() * 0.3,
                ease: "power2.out",
                onComplete: () => this.fxContainer.removeChild(p)
            });
        }
        
        const ring = new PIXI.Graphics();
        ring.lineStyle(4, 0xFF0000, 0.8);
        ring.drawCircle(0, 0, CONFIG.pieceSize);
        ring.x = x; ring.y = y;
        this.fxContainer.addChild(ring);
        
        gsap.to(ring.scale, {x: 2.5, y: 2.5, duration: 0.4});
        gsap.to(ring, {alpha: 0, duration: 0.4, onComplete: () => this.fxContainer.removeChild(ring)});
    }

    playMoveEffects(x, y) {
        if (navigator.vibrate) navigator.vibrate(15);

        const dust = new PIXI.Graphics();
        dust.beginFill(0xFFFFFF, 0.5);
        dust.drawCircle(0, 0, CONFIG.pieceSize);
        dust.endFill();
        dust.x = x; dust.y = y;
        dust.scale.set(0.5);
        this.fxContainer.addChild(dust);

        gsap.to(dust.scale, {x: 1.5, y: 1.5, duration: 0.3});
        gsap.to(dust, {alpha: 0, duration: 0.3, onComplete: () => this.fxContainer.removeChild(dust)});
    }

    screenShake(intensity, duration) {
        const startPos = {x: this.mainStage.x, y: this.mainStage.y};
        const startTime = Date.now();
        
        const ticker = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            if (elapsed > duration) {
                this.mainStage.position.set(startPos.x, startPos.y);
                this.app.ticker.remove(ticker);
                return;
            }
            
            const damp = 1 - (elapsed / duration);
            const dx = (Math.random() - 0.5) * intensity * damp * 2;
            const dy = (Math.random() - 0.5) * intensity * damp * 2;
            
            this.mainStage.x = startPos.x + dx;
            this.mainStage.y = startPos.y + dy;
        };
        this.app.ticker.add(ticker);
    }
}

class MockAI {
    makeMove(game) {
        const blackPieces = Object.values(game.pieces).filter(p => !p.data.red);
        if (blackPieces.length === 0) return;

        let attempts = 0;
        while (attempts < 50) {
            const piece = blackPieces[Math.floor(Math.random() * blackPieces.length)];
            const moves = [{x:0,y:1}, {x:0,y:-1}, {x:1,y:0}, {x:-1,y:0}];
            const move = moves[Math.floor(Math.random() * moves.length)];
            
            const tx = piece.data.x + move.x;
            const ty = piece.data.y + move.y;

            if (tx >= 0 && tx <= 8 && ty >= 0 && ty <= 9) {
                const targetKey = `${tx},${ty}`;
                const targetPiece = game.pieces[targetKey];
                
                if (targetPiece && !targetPiece.data.red) {
                    attempts++;
                    continue;
                }
                
                game.executeMove(piece, tx, ty, targetPiece);
                game.isProcessing = false;
                return;
            }
            attempts++;
        }
        game.isProcessing = false;
    }
}

window.onload = () => {
    new XiangqiGame();
};
