# ScoreTap Backend API

Base URL for local development:

```txt
http://127.0.0.1:8000/api
```

## Create Game

```txt
POST /games/
```

```json
{
  "home_team_name": "Bats",
  "away_team_name": "Sharks",
  "scheduled_innings": 7,
  "home_lineup": [{ "name": "Maya" }, { "name": "Jess" }],
  "away_lineup": [{ "name": "Mike" }, { "name": "Sam" }]
}
```

Returns the full current game state.

## Get Game

```txt
GET /games/:id/
```

Returns the current game state, including teams, players, runners, score, inning, outs, batting side, and current batter.

## Record Plate Appearance

```txt
POST /games/:id/plate-appearances/
```

```json
{
  "result": "single"
}
```

Supported results:

```txt
single
double
triple
home_run
walk
strikeout
ground_out
fly_out
error
fielders_choice
```

Returns:

```json
{
  "game": {},
  "event_id": 12
}
```

`game` contains the updated current game state.

## Undo Last Scoring Event

```txt
POST /games/:id/undo/
```

Restores the game to the state before the most recent non-undone plate appearance.

## Finalize Game

```txt
POST /games/:id/finalize/
```

Marks the game as final and returns the updated game state.

## Play-By-Play Events

```txt
GET /games/:id/events/
```

Returns all game events in sequence order, including the game start event, plate appearances, undone events, and finalization events.

## Game Summary

```txt
GET /games/:id/summary/
```

Example response:

```json
{
  "game_id": 1,
  "status": "final",
  "inning": 7,
  "half_inning": "bottom",
  "home_score": 4,
  "away_score": 7,
  "winner": "away",
  "plate_appearances": 23,
  "runs_scored": 11,
  "home_team": {
    "id": 1,
    "name": "Bats",
    "side": "home"
  },
  "away_team": {
    "id": 2,
    "name": "Sharks",
    "side": "away"
  }
}
```

## Error Cases

Invalid result:

```txt
400 Bad Request
```

Scoring a finalized game:

```txt
400 Bad Request
```

Undo without scoring events:

```txt
400 Bad Request
```

Missing game:

```txt
404 Not Found
```
