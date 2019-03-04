# Frjs

**frjs is a minimalistic engine to create escape-the-room type games**, in the style
of [Crimson Room](https://escapefan.com/crimson-room/).

Interested in seeing frjs in action? Check out the code and open
`example/index.html`. It is a tiny game (~1 min of gameplay) that showcases all
of frjs features. Opening the file will work as-is with Firefox, you'll need to
spin up a local web server with Chrome (e.g. `python -m SimpleHTTPServer 8000`).


## Features

The engine currently supports:

- first-person view 3D scenes with interactable objects;
- static viewpoints that the player can move between (they are static by
  design: the player can not 'look around');
- an inventory system; picking up & using objects.

The game UI is composed of:

- a 3D scene, with overlay buttons to navigate between viewpoints;
- an inventory.

Interactivity is achieved by clicking on active objects in the 3D scene or the
inventory. Objects can be shown, hidden, put in the inventory and discarded.
Messages to the player can be displayed next to the mouse pointer, upon clicking
or hovering over an active object. Navigation by clicking on an object is also
possible.


## How To Use The Engine

- Getting started: `doc/getting_started.md`;
- Reference documentation: `doc/reference.md`;
- Example showing all features: look under `example/`.


## Roadmap

- support for browser window dynamic resizing (this is a bug).
- support for sound.
- better html integration (currently assumes the whole frame is occupied by the
  frjs 3D scene).
- automatic testing of game files is planned. This explains some design choices
  in the API.


## Development Of frjs Itself

Regenerating the minified files:

    npm install
    npx grunt build

Whenever a new feature is added, make sure to modify the example game to use it.
This game serves as a testbed waiting for an actual test suite. Load
`example-dev.html` in your favorite browser and hack on `src/frjs.js`. Simply
reload the page to test changes.
