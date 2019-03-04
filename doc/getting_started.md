# Getting Started

This page gives a short introduction how to get started defining a game with frjs.

Creating a game involves two things: creating a 3D file containing all objects and
viewpoints, and defining all interactivity in a javascript file using the frjs api.
A full example can be found inside the `example/` directory. This file describes
a minimalistic example where you'll learn how to set up a simple navigation between
two viewpoints. This minimalistic example is available under `doc/tutorial_game`.


## Create The 3D File.

For the sake of this example we'll create a file with two objects and two
cameras pointing at them. This step requires a bit of setup, so if you're in a
hurry, you can skip that part and directly use
`doc/tutorial_game/scene/getting_started_scene.gltf`.

Start by **creating a Blender file with two objects** (let's say a cube and Susan).
Call them "cube" and "suzanne" (names are case-sensitive). This will be our scene.
We'll now create two viewpoints.

**Create a camera and an empty**. Call them "cube_view_cam" and
"cube_view_lookat", then link them together:
- select the camera, 'add constraint' > 'track to'
- write the name of the lookat as the name of the target, select `-z` for the `To:`
  direction and `Y` for the `Up:` direction.
- now when you move either the camera or the empty, the camera orientation changes
  to stay pointed in the direction of the lookat.

Arrange the camera and the empty so that the camera looks at the cube. **Now
repeat that with suzanne**. The camera and empty should be called
"suzanne_view_cam" and "suzanne_view_lookat".

**Important: the empty is not just a convenience to place the camera; it is
used by frjs for camera transition.

Finally, **add a custom property "interactive" with a value of 1 to both
objects** (cube and suzanne). It'll be useful later.

You just need to check that there is a light and export the file as gltf (you'll
need to install the
[GLTF exporter](https://github.com/KhronosGroup/glTF-Blender-Exporter)).
Make sure these GLTF exporter options are checked:

- check `embed buffers` to export everything in a single file - otherwise the
  exporter creates an extra `.bin`. file alongside the gltf.
- check `export extras` for custom properties to be saved in the gltf file.
- check `export cameras`
- check `export KHR_Lights` (requires enabling 'experimental glTF export
  settings' in the user preference for the addon). Without this setting no lights
  are exported, including the ambient one.


## Add Interactivity

First we need an html file. Create one with this content (a copy is provided
under `doc/tutorial_game`:

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      body { margin: 0; overflow: hidden;}
      canvas { width: 100%; height: 100% }
    </style>
  </head>
  <body>
    <script src="js/frjs.min.js"></script>    
    <script src="js/tutorial_game.js"></script>
  </body>
</html>
```

Make sure a copy of `frjs.min.js` exists at `js/frjs.min.js`. Then create
`js/tutorial_game.js` with this content:

```javascript
function gameHandlerInit(gh) {
  gh.setInitialView("cube_view");
}

frjs.startGame('scene/getting_started_scene.gltf', gameHandlerInit);
```

This simply tells frjs to load the gltf file and render the view defined by the
camera "cube_view_cam".

Now load `index.html` in your favorite browser (if you're using Chrome, spin up
a local web server with e.g. `python -mSimpleHTTPServer 8000` otherwise things
won't work). You should now see a view of your cube.

This is not very interesting because that's the only thing the current state can
do. Let's add some camera transition.

A first method is to directly define view transitions between cameras. Add those
lines after the call to `setInitialView`:

```javascript
gh.setViewLink("cube_view", {"right": "suzanne_view"});
gh.setViewLink("suzanne_view", {"left": "cube_view"});
```

It asks frjs to show navigation buttons that can be used to switch
back-and-forth between the two viewpoints. Reload `index.html`: you should
now see a button on the right of the 3D scene. Clicking on it will take you
to the other view (and back).

Another way you can use to define navigation is click on objects. To make
a click on either object switch the view to the corresponding camera add
these lines:

```javascript
gh.setSwitchViewAction("cube_view", "suzanne", "suzanne_view", "look");
gh.setSwitchViewAction("suzanne_view", "cube", "cube_view", "look");
```

The first line means: when in view "cube_view", is the player clicks on object
"suzanne", switch to view "suzanne_view" (and similarly for the second line). The
last argument is the text that is shown to the player when the mouse pointer is
over the object.

The game should now show a highlight when the mouse pointer is hovering over
a clickable object, and switch cameras as defined above.

**Important**: object are clickable only if they have the "interactive" custom
property set to 1 in the Blender file. So if the above doesn't seem to work check
your Blender file.

You now have the basics. Look at the `doc/reference.md` documentation and the
extended example under `example/` to learn the rest!


## Some Tips

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
