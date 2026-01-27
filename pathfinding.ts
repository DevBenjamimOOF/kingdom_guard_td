
import { GridPos } from './types';

export function getShortestPath(
  grid: number[][],
  start: GridPos,
  end: GridPos
): GridPos[] | null {
  const rows = grid.length;
  const cols = grid[0].length;
  const queue: GridPos[] = [start];
  const visited = new Set<string>();
  const parent = new Map<string, string>();

  visited.add(`${start.r},${start.c}`);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.r === end.r && current.c === end.c) {
      const path: GridPos[] = [];
      let currStr = `${end.r},${end.c}`;
      while (currStr) {
        const [r, c] = currStr.split(',').map(Number);
        path.unshift({ r, c });
        currStr = parent.get(currStr) || '';
      }
      return path;
    }

    const neighbors = [
      { r: current.r - 1, c: current.c },
      { r: current.r + 1, c: current.c },
      { r: current.r, c: current.c - 1 },
      { r: current.r, c: current.c + 1 },
    ];

    for (const neighbor of neighbors) {
      const key = `${neighbor.r},${neighbor.c}`;
      if (
        neighbor.r >= 0 && neighbor.r < rows &&
        neighbor.c >= 0 && neighbor.c < cols &&
        grid[neighbor.r][neighbor.c] === 0 &&
        !visited.has(key)
      ) {
        visited.add(key);
        parent.set(key, `${current.r},${current.c}`);
        queue.push(neighbor);
      }
    }
  }

  return null;
}
