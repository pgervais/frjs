function gameHandlerInit(gh) {
  gh.setInitialView("cube_view");

  // Navigation with UI buttons.
  gh.setViewLink("cube_view", {"right": "suzanne_view"});
  gh.setViewLink("suzanne_view", {"left": "cube_view"});

  // Navigation by clicking on objects.
  gh.setSwitchViewAction("cube_view", "suzanne", "suzanne_view", "look");
  gh.setSwitchViewAction("suzanne_view", "cube", "cube_view", "look");
}

frjs.startGame('scene/getting_started_scene.gltf', gameHandlerInit);
