# Frjs


## What Is frjs?

**frjs is a minimalistic engine to create escape-the-room type games**, in the style
of [Crimson Room](https://escapefan.com/crimson-room/). By design the engine only
enables very simple user interaction: clicking on/picking up an object, moving the
viewpoint and selecting an object in the inventory. Viewpoints are statically
defined and the player can not 'look around'.

Interested in seeing frjs in action? Check out the code and open
`example/index.html`. It is a tiny game (~1 min of gameplay) that showcases all
of frjs features. Opening the file will work as-is with Firefox, you'll need to
spin up a local web server with Chrome.

Creating a game involves two things: creating a 3D file containing all objects and
viewpoints, and defining all interactivity in a javascript file using the frjs api.
Look inside the `example/` directory, or keeping reading for the reference
documentation.


### frjs Features

The game UI is composed of:

- a 3D scene, with overlay buttons to navigate between viewpoints.
- an inventory.

Interactivity is achieved by clicking on active objects in the 3D scene or the
inventory. Objects can be shown, hidden, put in the inventory and discarded.
Messages to the player can be displayed next to the mouse pointer, upon clicking
or hovering over an active object. Navigation by clicking on an object is also
possible.


Missing features / bugs:

- support for browser window dynamic resizing (this is a bug).
- support for sound.
- better html integration (currently assumes the whole frame is occupied by the
  frjs 3D scene).
- automatic testing of game files is planned. This explains some design choices
  in the API.


## 3D World Definition

frjs reads a single [gltf](https://www.khronos.org/gltf/) file, that is assumed to
have been produced by [Blender](https://www.blender.org) using the
[gltf exporter](https://github.com/KhronosGroup/glTF-Blender-Exporter). Support for
other 3D software can be added, contributions welcome (the author doesn't have access
to another 3D suite than Blender at the moment).

Currenly, the only way to change the environment within a frjs game is to show or
hide objects. Thus the 3D file must contain all possible objects in all possible
states.

Example: if the game requires the player to open a door, both the open and closed
versions of the door must be present in the file. Opening the door is achieved by
hiding the 'closed' version and showing the 'open' one. Objects can also be marked
as collectible, so that clicking on them moves them to the inventory.

In the following we use the word 'object' to refer to a 3D object in the file - for
ex. the closed door or the open door. The concept of 'door' as seen by the player is
not understood by frjs at all.

In detail:

- all objects must have a distinct name (ex: 'door_closed', 'door_open'). It is
  convenient to use a structure like `<object_name>_<state>`, but the naming is
  entirely up to you (but see below).
- in-game viewpoints are defined using two objects: a camera and a "lookats".
  Cameras are regular blender cameras ; lookats are `empty` objects that define
  what the camera should look at.
  frjs uses lookats to do smooth viewpoint transitions. Camera objects are only
  used to determine a camera's _location_, lookats are used to determine their
  orientation. For consistency, it is thus recommended to constraint Blender cameras
  to look at their corresponding lookat (see below). Cameras names must end with
  "_cam", and lookats with "_lookat". Matching between cameras and lookats is done
  on the remaining part of their names. For example, a camera looking at a door
  could be named "door_cam", and it's corresponding lookat "door_lookat".
- objects that can be collected in the inventory must have the `interactive`
  custom property with a non-zero value set up on the Blender object (not the mesh).
- objects that are initially invisible (like the open door object if the door is
  initially closed) must have a `init_invisible` custom property with a non-zero
  value. Whether the object is visible or not in Blender doesn't matter.
- lights must be set up in the gltf file, including the ambient one. If no lights
  are present in the 3D file, the 3D scene will be entirely black.

Linking a lookat and a camera in Blender:

- create the camera and the lookat, name them appropriately.
- select the camera, 'add constraint' > 'track to'
- write the name of the lookat as the name of the target, select `-z` for the `To:`
  direction and `Y` for the `Up:` direction.
- now when you move either the camera or the empty, the camera orientation changes to
  stay pointed in the direction of the lookat.


### Blender GLTF Exporter Options

These GLTF exporter options are recommended for frjs:

- check `embed buffers` to export everything in a single file - otherwise the
  exporter creates an extra `.bin`. file alongside the gltf.
- check `export extras` for the custom properties to be saved in the gltf file.
- check `apply modifiers` if the file uses any modifier.
- check `export cameras`
- check `export KHR_Lights` (requires enabling 'experimental glTF export
  settings' in the user preference for the addon). Without this setting no lights
  are exported, including the ambient one.

## frjs API Reference

The overall structure of the js file defining the game interactivity is as follows:

```
function gameHandlerInit(gh) {
  // ... game definition
}

frjs.startGame('path/to/scene.gltf', gameHandlerInit);
```

frjs exposes a single function: `startGame`, which is passed a path to
the gltf file used and a callback. The callback has the following signature:

```
function gameHandlerInit(gh) {}
```

`gh` is a `GameHandler` object whose methods are used to define all interactions.
See `example/js/room.js` for a complete example. The reference documentation
follows.


### GameHandler Reference

In the following a 'view' is the name of a camera/lookat pair, without the '_cam'
or '_lookat' suffix.

Here is the list of methods on `GameHandler`.

```
GameHandler.setInitialView(viewName) {}
```

Specifies the name of the view the game should start on.


```
GameHandler.setViewLink(viewName, {action: destviewName}) {}
```

Defines which navigation buttons are displayed in view `viewName`, and their
destination. `action` is one of 'top', 'bottom', 'left', 'right'. `destviewName`
is the name of the view the button leads to. The navigation is one-way: if you want
the player to be able to come back to the original view, you have to specify a
connection starting from the destination view. Example of two-way navigation
between 'centralView' and 'rightView', and one-way between 'centralView' and
'leftView':

```
gh.setViewLink('centralView', {'right': 'rightView', 'left': 'leftView'});
gh.setViewLink('rightView', {'left': 'centralView'});
```

```
GameHandler.setAction(viewName, objectName, dependencyObjects,
                      messageCallback, clickCallback) {}
```
Use `setAction` to define possible interactions with objects in the 3D world.

- `viewName` is the view the game should be in for the action to be possible.
- `objectName` is the name of the object that is clicked/hovered over.
- `dependencyObjects` is a list of object names. These are all the other objects
  whose state must be queried or modified when the main object is clicked.
  Explicitly listing dependencies will make it easier to build testing tools (not
  implemented yet, as of 2019-02-24).
- `messageCallback` can be a string or a function returning a string. In both cases
  the string is displayed next to the mouse pointer when it's hovering over the
  object. It is called whenever the mouse pointer if hovering over the object.
  See below for details.
- `clickCallback` is called whenever the player clicks on the object in the 3D view.
  This function is not called when the object is in the inventory.

The two callbacks have the following signatures:

```
function messageCallback(viewName, obj, dependencyobj1, dependencyobj2, ...) {
  // returns a string
}

function clickCallback(viewName, obj, dependencyObj1, dependencyObj2, ...) {
  // return value is ignored
}
```

`viewName` is the first argument passed to `setAction`, `obj` is a `GameObject`
object corresponding to parameter `objectName` of `setAction`. All the remaining
arguments are also `GameObject` objects, corresponding to the list of names given
in `dependencyObject`, in the same order (see below for the full description).

Code inside the click callback can use these methods from `this`:

```
// Navigates to another view.
this.switchToView(destinationViewName) {}

// Shows the string `message` next to the pointer for `frames` frames. The latter
// defaults to 80. A typical use case for this method is when the users clicks on
// an object and the action is not possible (ex: "door is locked").
this.showMessage(message, frames) {}

// This terminates the game and displays string `message` to the user. After calling
// this method the game is frozen and no further interaction is possible (this might
// change in the future).
this.finishGame(message) {}
```


It is possible to access all frjs features using just only `setinitialView`,
`setViewLink`, and `setAction`. To reduce repetition for often-used actions and
shorten the code, some convenience methods are also available. It is recommended
to try to use them first before using the more complex `setAction`.

```
GameHandler.setSwitchViewAction(viewName, objectName, destinationView, message) {}
```

Defines a navigation action that happens when clicking on an object. Switches from
`viewName` to `destinationView` when the player clicks on object `objectName` when
in view `viewName`. `message` has the same meaning as for `setAction` (string or
function, see above).

```
GameHandler.setTakeObjectAction(viewName, objectName, message) {}
```

Puts object `objectName` in the inventory when the player clicks on it when in view
`viewName`. `message` has the same meaning as for `setAction`.


These are provided for debugging purposes:

```
// Read-only property telling whether the game is running in debug mode (currently
// always false).
GameHandler.debug

// Prints a dump of all elements found in the gltf file in the browser's console.
// Useful to check that the exporter has been set up properly. The list contains
// interactive and non-interactive objects, as well as lights, cameras and lookats.
GameHandler.debugDump() {}

// Prints a list of all interactive objects. Use this to check for typos in object
// names and make sure they've been exported properly (if at all).
GameHandler.objectDump() {}
```


### GameObject Reference

Each object marked 'interactive' in the gltf file has an associated `GameObject`
object, through which its state is queried and modified. Its methods are:

```
// Querying the state
GameObject.isVisible() { // returns a bool }

GameObject.selectedInInventory() { // returns a bool }

// Changing the state
GameObject.hide() { // no return value }

GameObject.show() { // no return value }

GameObject.putInInventory() { // no return value }

GameObject.drop()  { // no return value }
```

Each object state follows a simple state machine with these states:

- In the 3D scene, either visible or hidden. Use `show()` and `hide()` to switch
  between the two states, and `isVisible()` to query which state the object is in.
- In the inventory. Switching to this state happens when `putInInventory()` is
  called. The object can be selected or deselected. Switching between the states
  happens because of user interaction (not method to do it in code). Use
  `selectedInInventory()` to distinguish between the two states.
- Dropped: the object is invisible to the player. This state is final. An object
  can be dropped starting from any other state (in the inventory or not).

Constraints:
- the transition to the 3D world to the inventory is one way. It is not possible to
  put an object back in the 3D world once it has been taken into the inventory.
- there is no predicate to tell whether an object is in the inventory. It is only
  possible to know that it's selected _and_ in the inventory. The former predicate
  may be added in the future if it proves useful.


### Tips / FAQ

- if the engine complains that an object doesn't exist in the file, you can:
  - check for the name in the gltf file itself (it's a json file).
  - call `GameHandler.objectDump()` to get the full list of known objects.
  - double-check that if the object can be interacted with it has the `interactive`
    custom property and it's present in the gltf file.

- if the game fails to load the gltf file with an error about `viewIndex`.
  - double-check that the Blender exporter settings are correct (see above).

- the 3D scene is entirely black. What happens?
  - check that lights are defined in Blender and that they're exported. You can
    check by looking for the string 'light' in the gltf file.


## Development Of frjs Itself

Regenerating the minified files:

    npm install
    npx grunt build

Whenever a new feature is added, make sure to modify the example game to use it.
This game serves as a testbed waiting for an actual test suite. Load
`example-dev.html` in your favorite browser and hack on `src/frjs.js`. Simply
reload the page to test changes.
