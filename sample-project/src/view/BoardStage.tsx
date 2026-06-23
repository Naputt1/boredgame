import { Container, Graphics, Stage, Text } from "@pixi/react";
import { Graphics as PixiGraphics, TextStyle } from "pixi.js";
import { GameState } from "@boredgame/core";

type BoardStageProps = {
  state: GameState;
  onCellSelect: (position: { x: number; y: number }) => void;
};

const cellSize = 56;
const boardPadding = 16;

const tokenLabelStyle = new TextStyle({
  fill: "#ffffff",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: 14,
  fontWeight: "700"
});

const drawBoardCell =
  (isAlternate: boolean) => (graphics: PixiGraphics) => {
    graphics.clear();
    graphics.beginFill(isAlternate ? 0xe8edf7 : 0xf7fafc);
    graphics.lineStyle(1, 0x6b7280, 0.35);
    graphics.drawRoundedRect(0, 0, cellSize, cellSize, 6);
    graphics.endFill();
  };

const drawToken = (color: string) => (graphics: PixiGraphics) => {
  graphics.clear();
  graphics.beginFill(Number.parseInt(color.replace("#", "0x"), 16));
  graphics.lineStyle(3, 0xffffff, 0.9);
  graphics.drawCircle(cellSize / 2, cellSize / 2, 18);
  graphics.endFill();
};

export const BoardStage = ({ state, onCellSelect }: BoardStageProps) => {
  const width = state.board.width * cellSize + boardPadding * 2;
  const height = state.board.height * cellSize + boardPadding * 2;

  return (
    <div className="board-frame" style={{ width, height }}>
      <Stage
        width={width}
        height={height}
        options={{ backgroundColor: 0x0f172a, antialias: true }}
        className="board-stage"
      >
        <Container x={boardPadding} y={boardPadding}>
          {Array.from({ length: state.board.height }).flatMap((_, y) =>
            Array.from({ length: state.board.width }).map((__, x) => (
              <Graphics
                key={`${x}:${y}`}
                x={x * cellSize}
                y={y * cellSize}
                draw={drawBoardCell((x + y) % 2 === 0)}
              />
            ))
          )}

          {Object.values(state.tokens).map((token) => {
            const player = state.players[token.ownerId];
            const label = player?.name.slice(0, 1).toUpperCase() ?? "?";

            return (
              <Container
                key={token.id}
                x={token.position.x * cellSize}
                y={token.position.y * cellSize}
              >
                <Graphics draw={drawToken(player?.color ?? "#64748b")} />
                <Text
                  text={label}
                  anchor={0.5}
                  x={cellSize / 2}
                  y={cellSize / 2 + 1}
                  style={tokenLabelStyle}
                />
              </Container>
            );
          })}
        </Container>
      </Stage>
      <div
        className="board-hit-grid"
        style={{
          left: boardPadding,
          top: boardPadding,
          gridTemplateColumns: `repeat(${state.board.width}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${state.board.height}, ${cellSize}px)`
        }}
      >
        {Array.from({ length: state.board.height }).flatMap((_, y) =>
          Array.from({ length: state.board.width }).map((__, x) => (
            <button
              key={`${x}:${y}`}
              type="button"
              className="board-cell-button"
              aria-label={`Move token to ${x}, ${y}`}
              onClick={() => onCellSelect({ x, y })}
            />
          ))
        )}
      </div>
    </div>
  );
};
