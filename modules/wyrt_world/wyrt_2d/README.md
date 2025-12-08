# wyrt_2d

2D multiplayer position tracking and synchronization for Wyrt games.

## Features

- Common 2D position/direction types
- PositionManager for centralized position tracking
- Utility functions for distance, direction, and range calculations
- Room-based position grouping

## Usage

```typescript
import { Position, Direction, PositionManager } from 'wyrt_2d';

const posManager = new PositionManager();
posManager.updatePosition('player1', { x: 100, y: 200 }, 'right');

// Calculate distance between positions
const distance = PositionManager.distance(
  { x: 0, y: 0 },
  { x: 100, y: 100 }
);

// Check if position is within range
const inRange = PositionManager.isWithinRange(
  { x: 0, y: 0 },
  { x: 50, y: 50 },
  100
);
```

## License

GPL-3.0
