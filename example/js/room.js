// Definition of a simple test / tutorial game.

const i18n = window.i18n();

i18n.setMessages('messages', 'fr', {
  "look at box": "regarder la boîte",
  "look at padlock": "regarder le cadenas",
  "look at vase": "regarder le vase",
  "take key": "prendre la clé",
  "open padlock": "ouvrir le cadenas",
  "padlock is locked": "le cadenas est fermé",
  "open box": "ouvrir la boîte",
  "box is locked": "la boîte est fermée",
  "close box": "fermer la boîte",
  "take axe": "prendre la hache",
  "break the door": "casser la porte",
  "door is locked": "la porte est fermée",
  "You win!": "Gagné !"
}, 'nplurals=2; plural=n>1;');

i18n.setLocale(navigator.language);

function gameHandlerInit(gh) {
  gh.setInitialView("door");

  // Center view: door.
  gh.setViewLink("door", {"right": "box",
                          "left": "vases"});
  gh.setViewLink("box", {"left": "door"});
  gh.setViewLink("vases", {"right": "door"});

  gh.setSwitchViewAction(
    "door", "box_top_closed", "box", i18n.gettext('look at box'));
  gh.setSwitchViewAction(
    "door", "box_top_open", "box", i18n.gettext("look at box"));
  gh.setSwitchViewAction(
    "door", "box_bottom", "box", i18n.gettext("look at box"));

  gh.setSwitchViewAction(
    "door", "padlock_closed", "box", i18n.gettext("look at padlock"));

  gh.setAction("door", "door_closed", ["axe", "door_open"],
               function(viewName, door_closed, axe, door_open) {
                 if (axe.selectedInInventory()) {
                   return i18n.gettext("break the door");
                 }
                 return " ";
               },
               function(viewName, door_closed, axe, door_open) {
                 if (axe.selectedInInventory()) {
                   axe.drop();
                   door_closed.hide();
                   door_open.show();
                   this.finishGame(i18n.gettext("You win!"));
                 } else {
                   this.showMessage(i18n.gettext("door is locked"));
                 }
               });

  // Left corner: vases
  gh.setViewLink("vase1", {"bottom": "vases", "right": "door"});
  gh.setViewLink("vase2", {"bottom": "vases", "right": "door"});
  gh.setViewLink("vase3", {"bottom": "vases", "right": "door"});

  gh.setSwitchViewAction("vase1", "vase2", "vase2", i18n.gettext("look at vase"));
  gh.setSwitchViewAction("vase1", "vase3", "vase3", i18n.gettext("look at vase"));

  gh.setSwitchViewAction("vase2", "vase1", "vase1", i18n.gettext("look at vase"));
  gh.setSwitchViewAction("vase2", "vase3", "vase3", i18n.gettext("look at vase"));

  gh.setSwitchViewAction("vase3", "vase1", "vase1", i18n.gettext("look at vase"));
  gh.setSwitchViewAction("vase3", "vase2", "vase2", i18n.gettext("look at vase"));

  gh.setSwitchViewAction("vases", "vase1", "vase1", i18n.gettext("look at vase"));
  gh.setSwitchViewAction("vases", "vase2", "vase2", i18n.gettext("look at vase"));
  gh.setSwitchViewAction("vases", "vase3", "vase3", i18n.gettext("look at vase"));

  gh.setTakeObjectAction("vase1", "key", i18n.gettext("take key"));

  // Right corner: box
  gh.setAction("box", "padlock_closed", ["key", "padlock_open"],
               function (viewName, padlock_closed, key, padlock_open) {
                 if (key.selectedInInventory()) {
                   return i18n.gettext("open padlock");
                 }
                 return " ";
               },
               function (viewName, padlock_closed, key, padlock_open) {
                 if (!key.selectedInInventory()) {
                   this.showMessage(i18n.gettext("padlock is locked"));
                   return;
                 }
                 padlock_open.show();
                 padlock_closed.hide();
                 key.drop();
               });

  gh.setAction("box", "box_top_closed", ["padlock_closed", "box_top_open"],
               function (viewName, box_top_closed, padlock_closed, box_top_open) {
                 if (padlock_closed.isVisible()) {
                   return " ";
                 }
                 return i18n.gettext("open box");
               },
               function (viewName, box_top_closed, padlock_closed, box_top_open) {
                 if (padlock_closed.isVisible()) {
                   this.showMessage(i18n.gettext("box is locked"));
                   return;
                 }
                 if (box_top_closed.isVisible()) {
                   box_top_open.show();
                   box_top_closed.hide();
                 }
               });

  gh.setAction("box", "box_top_open", ["box_top_closed"],
               i18n.gettext("close box"),
               function (viewName, box_top_open, box_top_closed) {
                 if (box_top_open.isVisible()) {
                   box_top_open.hide();
                   box_top_closed.show();
                 }
               });

  gh.setTakeObjectAction("box", "axe", i18n.gettext("take axe"));


  if (gh.debug) {
    gh.debugDump();
  }
  return;
}

frjs.startGame('scene/room.gltf', gameHandlerInit);
