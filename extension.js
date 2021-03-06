/*****************************************************************

  This extension has been developed by vibou

  With the help of the gnome-shell community

  Edited by Kvis for gnome 3.8
  Edited by Lundal for gnome 3.18
  Edited by Sergey to add keyboard shortcuts and prefs dialog

 ******************************************************************/

/*****************************************************************
  CONST & VARS
 *****************************************************************/
// Library imports
const St = imports.gi.St;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;
const WindowManager = imports.ui.windowManager;
const MessageTray = imports.ui.messageTray;
const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;
const DND = imports.ui.dnd;
const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;
const Signals = imports.signals;
const Tweener = imports.ui.tweener;
const Workspace = imports.ui.workspace;

// Extension imports
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Extension.imports.settings;
const hotkeys = Extension.imports.hotkeys;

// Globals
const SETTINGS_GRID_SIZES = 'grid-sizes';
const SETTINGS_AUTO_CLOSE = 'auto-close';
const SETTINGS_ANIMATION = 'animation';
const SETTINGS_TOP_PANEL = 'top-panel';
const SETTINGS_BOTTOM_PANEL = 'bottom-panel';
const SETTINGS_GLOBAL_PRESETS = 'global-presets';
const SETTINGS_WINDOW_MARGIN = 'window-margin';
const SETTINGS_INSETS_PRIMARY = 'insets-primary';
const SETTINGS_INSETS_PRIMARY_LEFT = 'insets-primary-left';
const SETTINGS_INSETS_PRIMARY_RIGHT = 'insets-primary-right';
const SETTINGS_INSETS_PRIMARY_TOP = 'insets-primary-top';
const SETTINGS_INSETS_PRIMARY_BOTTOM = 'insets-primary-bottom';
const SETTINGS_INSETS_SECONDARY = 'insets-secondary';
const SETTINGS_INSETS_SECONDARY_LEFT = 'insets-secondary-left';
const SETTINGS_INSETS_SECONDARY_RIGHT = 'insets-secondary-right';
const SETTINGS_INSETS_SECONDARY_TOP = 'insets-secondary-top';
const SETTINGS_INSETS_SECONDARY_BOTTOM = 'insets-secondary-bottom';
const SETTINGS_DEBUG = 'debug';

let status;
let launcher;
let grids;
let monitors;
let nbCols;
let nbRows;
let area;
let tracker;
let focusMetaWindow = false;
let focusWindowActor = false;
let focusMetaWindowConnections = new Array();
let focusMetaWindowPrivateConnections = new Array();
let gridSettings = new Object();
let settings = Settings.get();
let toggleSettingListener;
let keyControlBound = false;
let debug = false;

// Hangouts workaround
let excludedApplications = new Array(
    "Unknown"
);

const key_bindings = {
    'show-toggle-tiling': function() { toggleTiling(); }
};

const key_bindings_tiling = {
    'move-left'       : function() { keyMoveResizeEvent('move'  , 'left' );},    
    'move-right'      : function() { keyMoveResizeEvent('move'  , 'right');},    
    'move-up'         : function() { keyMoveResizeEvent('move'  , 'up'   );},    
    'move-down'       : function() { keyMoveResizeEvent('move'  , 'down' );},
    'resize-left'     : function() { keyMoveResizeEvent('resize', 'left' );},    
    'resize-right'    : function() { keyMoveResizeEvent('resize', 'right');},
    'resize-up'       : function() { keyMoveResizeEvent('resize', 'up'   );},
    'resize-down'     : function() { keyMoveResizeEvent('resize', 'down' );},
    'cancel-tiling'   : function() { keyCancelTiling();},
    'set-tiling'      : function() { keySetTiling()   ;},
    'change-grid-size': function() { keyChangeTiling();}
}

const key_bindings_presets = {
    'preset-resize-1' : function() { presetResize(1)  ;},
    'preset-resize-2' : function() { presetResize(2)  ;},
    'preset-resize-3' : function() { presetResize(3)  ;},
    'preset-resize-4' : function() { presetResize(4)  ;},
    'preset-resize-5' : function() { presetResize(5)  ;},
    'preset-resize-6' : function() { presetResize(6)  ;},
    'preset-resize-7' : function() { presetResize(7)  ;},
    'preset-resize-8' : function() { presetResize(8)  ;},
    'preset-resize-9' : function() { presetResize(9)  ;},
    'preset-resize-10': function() { presetResize(10) ;},
    'preset-resize-11': function() { presetResize(11) ;},
    'preset-resize-12': function() { presetResize(12) ;},
    'preset-resize-13': function() { presetResize(13) ;},
    'preset-resize-14': function() { presetResize(14) ;},
    'preset-resize-15': function() { presetResize(15) ;},
    'preset-resize-16': function() { presetResize(16) ;},
    'preset-resize-17': function() { presetResize(17) ;},
    'preset-resize-18': function() { presetResize(18) ;},
    'preset-resize-19': function() { presetResize(19) ;},
    'preset-resize-20': function() { presetResize(20) ;}
}

function log(log_string) {
    if(debug) {
        global.log("gTile " + log_string);
    }
}

const GTileStatusButton = new Lang.Class({
    Name: 'GTileStatusButton',
    Extends: PanelMenu.Button,

    _init: function(classname) {
        this.parent(0.0, "gTile", false);

        this.actor.add_style_class_name(classname);
        //Done by default in PanelMenuButton - Just need to override the method
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
    },

    reset: function() {
        this.activated = false;
        launcher.actor.remove_style_pseudo_class('activate');
    },

    activate: function() {
        launcher.actor.add_style_pseudo_class('activate');
    },

    deactivate: function() {
        launcher.actor.remove_style_pseudo_class('activate');
    },

    _onButtonPress: function(actor, event) {
        log("Click Toggle Status on system panel");
        toggleTiling();
    },

    _destroy: function() {
        this.activated = null;
    }

});

/*****************************************************************
  SETTINGS
 *****************************************************************/

function parseTuple(format, delimiter) {
    // parsing grid size in format XdelimY, like 6x4 or 1:2
    let gssk = format.split(delimiter);
    if(gssk.length != 2 
        || isNaN(gssk[0]) || gssk[0] < 0 || gssk[0] > 40 
        || isNaN(gssk[1]) || gssk[1] < 0 || gssk[1] > 40) {
	log("Bad format " + format + ", delimiter " + delimiter);
	return {X: Number(-1), Y: Number(-1)};
    }
    //log("Parsed format " + gssk[0] + delimiter + gssk[1]);
    return {X: Number(gssk[0]), Y: Number(gssk[1]) };
}

function initGridSizes(grid_sizes) {
    gridSettings[SETTINGS_GRID_SIZES] = [
	new GridSettingsButton('4x4',4,4),
	new GridSettingsButton('6x4',6,4),
	new GridSettingsButton('8x6',8,6),
    ];  
    let grid_sizes_orig = true;
    let gss = grid_sizes.split(",");
    for (var key in gss) {
        let grid_format = parseTuple(gss[key], "x");
	if(grid_format.X == -1) {
	    continue;
	}
        if(grid_sizes_orig) {
	    gridSettings[SETTINGS_GRID_SIZES] = [];
	    grid_sizes_orig = false;
	}
	gridSettings[SETTINGS_GRID_SIZES].push(new GridSettingsButton(grid_format.X + "x" + grid_format.Y, grid_format.X, grid_format.Y));
    }
}

function getBoolSetting (settings_string) {
    gridSettings[settings_string] = settings.get_boolean(settings_string);
    if(gridSettings[settings_string] === undefined) {
	log("Undefined settings " + settings_string);
        gridSettings[settings_string] = false;
    } else {
        log(settings_string + " set to " + gridSettings[settings_string]);  
    }
}

function getIntSetting (settings_string) {
    let iss = settings.get_int(settings_string);
    if(iss === undefined) { 
	log("Undefined settings " + settings_string);  
	return 0;
    } else {
	log(settings_string + " set to " + iss);  
	return iss;
    }
}

function initSettings() {
    let gridSizes = settings.get_string(SETTINGS_GRID_SIZES);
    log(SETTINGS_GRID_SIZES + " set to " + gridSizes);
    initGridSizes(gridSizes);

    getBoolSetting(SETTINGS_AUTO_CLOSE);
    getBoolSetting(SETTINGS_ANIMATION);
    getBoolSetting(SETTINGS_TOP_PANEL);
    getBoolSetting(SETTINGS_BOTTOM_PANEL);
    getBoolSetting(SETTINGS_GLOBAL_PRESETS);
    getBoolSetting(SETTINGS_DEBUG);

    gridSettings[SETTINGS_WINDOW_MARGIN] = getIntSetting(SETTINGS_WINDOW_MARGIN);

    gridSettings[SETTINGS_INSETS_PRIMARY] = 
        { top:    getIntSetting(SETTINGS_INSETS_PRIMARY_TOP), 
	  bottom: getIntSetting(SETTINGS_INSETS_PRIMARY_BOTTOM), 
	  left:   getIntSetting(SETTINGS_INSETS_PRIMARY_LEFT), 
	  right:  getIntSetting(SETTINGS_INSETS_PRIMARY_RIGHT) }; // Insets on primary monitor
    gridSettings[SETTINGS_INSETS_SECONDARY] = 
        { top:    getIntSetting(SETTINGS_INSETS_SECONDARY_TOP), 
	  bottom: getIntSetting(SETTINGS_INSETS_SECONDARY_BOTTOM), 
	  left:   getIntSetting(SETTINGS_INSETS_SECONDARY_LEFT), 
	  right:  getIntSetting(SETTINGS_INSETS_SECONDARY_RIGHT) }; 

}


/*****************************************************************
  FUNCTIONS
 *****************************************************************/
function init() {

}

function enable() {
    status = false;
    monitors = Main.layoutManager.monitors;
    tracker = Shell.WindowTracker.get_default();

    area = new St.BoxLayout({style_class: 'grid-preview'});
    Main.uiGroup.add_actor(area);

    log("Create Button");
    launcher = new GTileStatusButton('tiling-icon');

    log("Init settings");
    initSettings();
    debug = gridSettings[SETTINGS_DEBUG];

    // initialize these from settings, the first set of sizes
    nbCols = gridSettings[SETTINGS_GRID_SIZES][0].cols;
    nbRows = gridSettings[SETTINGS_GRID_SIZES][0].rows;

    log("Init Grids");
    initGrids();

    log("Starting...");
    //global.display.connect('notify::focus-window', Lang.bind(this, _onFocus));

    Main.panel.addToStatusArea("GTileStatusButton", launcher);

    hotkeys.bind(key_bindings);
    if(gridSettings[SETTINGS_GLOBAL_PRESETS]) {
        hotkeys.bind(key_bindings_presets);
    }

    log("Extention Enabled !");
}

function disable() {
    hotkeys.unbind(key_bindings);
    hotkeys.unbind(key_bindings_presets);
    hotkeys.unbind(key_bindings_tiling);
    destroyGrids();
    launcher.destroy();
    launcher = null;
    resetFocusMetaWindow();
}

function resetFocusMetaWindow() {
    log("resetFocusMetaWindow");
    if (focusMetaWindowConnections.length>0) {
        for (var idx in focusMetaWindowConnections) {
	    log("disconnect focusMetaWindowConnections " + idx);
            focusMetaWindow.disconnect(focusMetaWindowConnections[idx]);
        }
    }

    if (focusMetaWindowPrivateConnections.length>0) {
        let actor = focusMetaWindow.get_compositor_private();
        if (actor) {
            for(var idx in focusMetaWindowPrivateConnections) {
		log("disconnect focusMetaWindowPrivateConnections " + idx);
                actor.disconnect(focusMetaWindowPrivateConnections[idx]);
            }
        }
    }

    focusMetaWindow = false;
    focusMetaWindowConnections = new Array();
    focusMetaWindowPrivateConnections = new Array();
}

function initGrids() {
    log("initGrids");
    grids = new Array();
    for (let monitorIdx in monitors) {
        log("New Grid for monitor " + monitorIdx);

        let monitor = monitors[monitorIdx];

        let grid = new Grid(monitorIdx, monitor, "gTile", nbCols, nbRows);

        let key = getMonitorKey(monitor);
        grids[key] = grid;

        Main.layoutManager.addChrome(grid.actor, { trackFullscreen: true });
        grid.actor.set_opacity(0);
        grid.hide(true);
        grid.connect('hide-tiling', Lang.bind(this, hideTiling));
    }
}

function destroyGrids() {
    for (let monitorIdx in monitors) {
        let monitor = monitors[monitorIdx];
        let key = getMonitorKey(monitor);
        let grid = grids[key];
        grid.hide(true);
        Main.layoutManager.removeChrome(grid.actor);
    }
}

function refreshGrids() {
    log("Refresh");
    for (var gridIdx in grids) {
        let grid = grids[gridIdx];
        grid.refresh();
    }
}

function moveGrids() {
    if (!status) {
        return;
    }

    let window = focusMetaWindow;
    if (window) {
        for (var gridIdx in grids) {
            let grid = grids[gridIdx];
            let pos_x;
            let pos_y;

            let monitor = grid.monitor;
            if (window.get_monitor() == grid.monitor_idx) {
                pos_x = window.get_frame_rect().width / 2  + window.get_frame_rect().x;
                pos_y = window.get_frame_rect().height / 2  + window.get_frame_rect().y;
            }
            else {
                pos_x = monitor.x + monitor.width/2;
                pos_y = monitor.y + monitor.height/2;
            }

            pos_x = Math.floor(pos_x - grid.actor.width / 2);
            pos_y = Math.floor(pos_y - grid.actor.height / 2);

            if (window.get_monitor() == grid.monitor_idx) {
                pos_x = (pos_x < monitor.x) ? monitor.x : pos_x;
                pos_x = ((pos_x + grid.actor.width) >  (monitor.width+monitor.x)) ?  monitor.x + monitor.width - grid.actor.width : pos_x;
                pos_y = (pos_y < monitor.y) ? monitor.y : pos_y;
                pos_y = ((pos_y + grid.actor.height) > (monitor.height+monitor.y)) ? monitor.y + monitor.height - grid.actor.height : pos_y;
            }

            let time = (gridSettings[SETTINGS_ANIMATION]) ? 0.3 : 0.1;

            Tweener.addTween(
                grid.actor, {
                    time: time,
                    x:pos_x,
                    y:pos_y,
                    transition: 'easeOutQuad',
                    /*onComplete:updateRegions*/
                });
        }
    }
}

function updateRegions() {
    /*Main.layoutManager._chrome.updateRegions();*/

    refreshGrids();
    for (let idx in grids) {
        let grid = grids[idx];
        grid.elementsDelegate.reset();
    }
}

function reset_window(metaWindow) {
    metaWindow.unmaximize(Meta.MaximizeFlags.HORIZONTAL);
    metaWindow.unmaximize(Meta.MaximizeFlags.VERTICAL);
    metaWindow.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
}

function _getInvisibleBorderPadding(metaWindow) {
    let outerRect = metaWindow.get_frame_rect();
    let inputRect = metaWindow.get_buffer_rect();
    let borderX = outerRect.x - inputRect.x;
    let borderY = outerRect.y - inputRect.y;

    return [borderX, borderY];
}

function _getVisibleBorderPadding(metaWindow) {
    let clientRect = metaWindow.get_frame_rect();
    let outerRect = metaWindow.get_frame_rect();

    let borderX = outerRect.width - clientRect.width
    let borderY = outerRect.height - clientRect.height;

    return [borderX, borderY];
}

function move_maximize_window(metaWindow, x, y) {
    let borderX,borderY,vBorderX,vBorderY;
    [borderX,borderY] = _getInvisibleBorderPadding(metaWindow);

    x = x - borderX;
    y = y - borderY;


    metaWindow.move_frame(true,x,y);
    metaWindow.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
}

/**
 * Resizes window considering margin settings
 * @param metaWindow
 * @param x
 * @param y
 * @param width
 * @param height
 */
function move_resize_window_with_margins(metaWindow, x, y, width, height){
    move_resize_window(
        metaWindow,
        x + gridSettings[SETTINGS_WINDOW_MARGIN],
        y + gridSettings[SETTINGS_WINDOW_MARGIN],
        width - gridSettings[SETTINGS_WINDOW_MARGIN] * 2,
        height - gridSettings[SETTINGS_WINDOW_MARGIN] * 2
    )
}

function move_resize_window(metaWindow, x, y, width, height) {
    let [borderX,borderY] = _getInvisibleBorderPadding(metaWindow);
    let [vBorderX,vBorderY] = _getVisibleBorderPadding(metaWindow);

    log(metaWindow.get_title() + " " + borderX + "-" + borderY);

    x = x  ;//+ (vBorderX - 1);
    y = y  ;

    width = width - vBorderX;
    height = height - vBorderY ;

    /* To TEST
    win._overviewHint = {
        x: actor.x,
        y: actor.y,
        scale: actor.scale_x
    };
    */

    metaWindow.move_resize_frame(true,x,y,width,height);

    /*
    let actor = metaWindow.get_compositor_private();

    let origX = actor.x;
    let origY = actor.y;

    actor.x = origX;
    actor.y = origY;

    Tweener.addTween(
        actor,{
            time:0.2,
            transition: "easeOutQuad",
            opacity:0,
            onComplete:_onMovedAndResize,
            onCompleteParams: [metaWindow,x,y,width,height]
        });
    */
}

function _isMyWindow(win) {
    //log("meta-window: "+this.focusMetaWindow+" : "+win.meta_window);
    return (this.focusMetaWindow == win.meta_window);
}

function getWindowActor() {
    let windows = global.get_window_actors().filter(this._isMyWindow, this);
    focusWindowActor = windows[0];

    //log("window actor: "+focusWindowActor+":"+focusMetaWindow.get_compositor_private() );
}

function getNotFocusedWindowsOfMonitor(monitor) {
    let windows = global.get_window_actors().filter(function(w) {
        let app = tracker.get_window_app(w.meta_window);

        if (app == null) {
            return false;
        }

        let appName = app.get_name();

        //log("NotFocused - AppName: " + appName);

        return !contains(excludedApplications, appName)
            && w.meta_window.get_window_type() == Meta.WindowType.NORMAL
            && w.meta_window.get_workspace() == global.screen.get_active_workspace()
            && w.meta_window.showing_on_its_workspace()
            && monitors[w.meta_window.get_monitor()] == monitor
            && focusMetaWindow != w.meta_window;
    });

    return windows;
}

function getWindowsOfMonitor(monitor) {
    let windows = global.get_window_actors().filter(function(w) {
        return w.meta_window.get_window_type() != Meta.WindowType.DESKTOP
            && w.meta_window.get_workspace() == global.screen.get_active_workspace()
            && w.meta_window.showing_on_its_workspace()
            && monitors[w.meta_window.get_monitor()] == monitor;
    });

    return windows;
}

function _onFocus() {
    log("_onFocus");
    resetFocusMetaWindow();
    let window = getFocusApp();

    if (window) {
        log("_onFocus, connecting " + window.get_title());
        //log("Connect window: "+window.get_title());
        focusMetaWindow = window;	
        focusMetaWindowConnections.push(focusMetaWindow.connect('notify::title',Lang.bind(this,_onFocus)));

        let actor = focusMetaWindow.get_compositor_private();
        if (actor) {
            focusMetaWindowPrivateConnections.push(focusMetaWindow.connect('size-changed',Lang.bind(this,moveGrids)));
            focusMetaWindowPrivateConnections.push(focusMetaWindow.connect('position-changed',Lang.bind(this,moveGrids)));
        }

        //log("End Connect window: "+window.get_title());

        let app = tracker.get_window_app(focusMetaWindow);
        let title = focusMetaWindow.get_title();

        for (let monitorIdx in monitors) {
            let monitor = monitors[monitorIdx];
            let key = getMonitorKey(monitor);
            let grid = grids[key];
            if (app) {
                grid.topbar._set_app(app,title);
            }
            else {
                grid.topbar._set_title(title);
            }
        }

        moveGrids();
    }
    else {
        log("No focus window, hide tiling");
        hideTiling();
    }
}


function showTiling() {
    log("showTiling");
    focusMetaWindow = getFocusApp();
    //let wm_class = focusMetaWindow.get_wm_class();
    let wm_type = focusMetaWindow.get_window_type();
    let layer = focusMetaWindow.get_layer();

    //log("type:"+wm_type+" class:"+wm_class+" layer:"+layer);
    //log("focus app: "+focusMetaWindow);
    area.visible = true;
    if (focusMetaWindow && wm_type != 1 && layer > 0) {
        for (let monitorIdx in monitors) {
            let monitor = monitors[monitorIdx];
            let key = getMonitorKey(monitor);
            let grid = grids[key];
            //log("ancestor: "+grid.actor.get_parent());

            let window = getFocusApp();
            let pos_x;
            let pos_y;
            if (window.get_monitor() == monitorIdx) {
                pos_x = window.get_frame_rect().width / 2  + window.get_frame_rect().x;
                pos_y = window.get_frame_rect().height / 2  + window.get_frame_rect().y;
            }
            else {
                pos_x = monitor.x + monitor.width/2;
                pos_y = monitor.y + monitor.height/2;
            }

            grid.set_position(
                Math.floor(pos_x - grid.actor.width / 2),
                Math.floor(pos_y - grid.actor.height / 2)
            );

            grid.show();
        }

        _onFocus();
        status = true;
        launcher.activate();
        bindKeyControls();
    }

    moveGrids();
}

function hideTiling() {
    log("hideTiling");
    for (let gridIdx in grids) {
        let grid = grids[gridIdx];
        grid.elementsDelegate.reset();
        grid.hide(false);
    }
    log("After reseting grid");
    area.visible = false;

    resetFocusMetaWindow();

    launcher.deactivate();
    status = false;    
    unbindKeyControls();
}

function toggleTiling() {
    if (status) {
        hideTiling();
    }
    else {
        showTiling();
    }
    return status;
}


function getMonitorKey(monitor) {
    return monitor.x+":"+monitor.width+":"+monitor.y+":"+monitor.height;
}

function contains(a, obj) {
    var i = a.length;
    while (i--) {
        if (a[i] === obj) {
            return true;
        }
    }
    return false;
}

function getFocusApp() {
    if (tracker.focus_app == null) {
        return false;
    }

    let focusedAppName = tracker.focus_app.get_name();

    if (contains(excludedApplications, focusedAppName)) {
        return false;
    }

    let windows = global.screen.get_active_workspace().list_windows();
    let focusedWindow = false;
    for (let i = 0; i < windows.length; ++i) {
        let metaWindow = windows[i];
        if (metaWindow.has_focus()) {
            focusedWindow = metaWindow;
            break;
        }
    }

    return focusedWindow;
}

function isPrimaryMonitor(monitor) {
    return Main.layoutManager.primaryMonitor.x == monitor.x && Main.layoutManager.primaryMonitor.y == monitor.y;
}

function getWorkArea(monitor) {
    let insets = (isPrimaryMonitor(monitor)) ? gridSettings[SETTINGS_INSETS_PRIMARY] : gridSettings[SETTINGS_INSETS_SECONDARY];
    let panelPosition = Main.layoutManager.panelBox.anchor_y == 0 ? St.Side.TOP : St.Side.BOTTOM;
    let topPanelSize = (isPrimaryMonitor(monitor) && gridSettings[SETTINGS_TOP_PANEL]) ? Main.panel.actor.height : 0;
    let bottomPanelSize = (isPrimaryMonitor(monitor) && gridSettings[SETTINGS_BOTTOM_PANEL]) ? Main.panel.actor.height : 0;
  
    return {
        x: monitor.x + insets.left,
        y: panelPosition == St.Side.TOP ? monitor.y + insets.top + topPanelSize : monitor.y + insets.top,
        width: monitor.width - insets.left - insets.right,
        height: monitor.height - insets.top - insets.bottom - topPanelSize - bottomPanelSize
    };
}

function bindKeyControls() {   
    if(!keyControlBound) {
        hotkeys.bind(key_bindings_tiling);
	log("Connect notify:focus-window");
	global.display.connect('notify::focus-window', Lang.bind(this, _onFocus));
	if(!gridSettings[SETTINGS_GLOBAL_PRESETS]) {
	    hotkeys.bind(key_bindings_presets);
	}	
        keyControlBound = true;
    }
}

function unbindKeyControls() {    
    if(keyControlBound) {
	hotkeys.unbind(key_bindings_tiling);
	log("Disconnect notify:focus-window");
	global.display.disconnect('notify::focus-window', Lang.bind(this, _onFocus));
	if(!gridSettings[SETTINGS_GLOBAL_PRESETS]) {
	    hotkeys.unbind(key_bindings_presets);
	}
	keyControlBound = false;
    }
}

function keyCancelTiling() {
    log("Cancel key event");
    hideTiling();
}

function keySetTiling() {
    log("keySetTiling");
    if (focusMetaWindow) {
	let mind = focusMetaWindow.get_monitor();
	let monitor = monitors[mind];
	let mkey = getMonitorKey(monitor);
	let grid = grids[mkey];
	log("In grid " + grid);
	if(grid.elementsDelegate.currentElement) {
	    grid.elementsDelegate.currentElement._onButtonPress();
	}
    }
}

function keyChangeTiling() {
    log("keyChangeTiling");
    let grid_settings_sizes = gridSettings[SETTINGS_GRID_SIZES];
    let next_key = 0;
    let found = false;
    for (let key in grid_settings_sizes) {
        if(found) {
	    next_key = key;
	    break;
	}
	log("Checking grid settings size " + key + " have cols " + grid_settings_sizes[key].cols + " and rows " + grid_settings_sizes[key].rows);
	if(grid_settings_sizes[key].cols == nbCols && grid_settings_sizes[key].rows == nbRows) {
	    found = true;
	}
    }
    log("Found matching grid nbCols " + nbCols + " nbRows " + nbRows + " next key is " + next_key);
    log("New settings will be nbCols " + grid_settings_sizes[next_key].cols + " nbRows " + grid_settings_sizes[next_key].rows);
    grid_settings_sizes[next_key]._onButtonPress();
    log("New settings are nbCols " + nbCols + " nbRows " + nbRows);
    setInitialSelection();
}

function setInitialSelection() {  
    if (!focusMetaWindow) {
        return;
    }
    let mind = focusMetaWindow.get_monitor();
    let monitor = monitors[mind];
    let workArea = getWorkArea(monitor);

    let wx = focusMetaWindow.get_frame_rect().x;
    let wy = focusMetaWindow.get_frame_rect().y;
    let wwidth = focusMetaWindow.get_frame_rect().width;
    let wheight = focusMetaWindow.get_frame_rect().height;
    let mkey = getMonitorKey(monitor);
    let grid = grids[mkey];
    let delegate = grid.elementsDelegate;

    log("Set initial selection");
    log("Focus window position x " + wx + " y " + wy + " width " + wwidth + " height " + wheight); 
    log("Focus monitor position x " + monitor.x + " y " + monitor.y + " width " + monitor.width + " height " + monitor.height); 
    log("Workarea position x " + workArea.x + " y " + workArea.y + " width " + workArea.width + " height " + workArea.height); 
    let wax = Math.max(wx - workArea.x, 0);
    let way = Math.max(wy - workArea.y, 0);
    let grid_element_width = Math.floor(workArea.width / nbCols);
    let grid_element_height = Math.floor(workArea.height / nbRows);
    log("width " + grid_element_width + " height " + grid_element_height);
    let lux = Math.min(Math.floor(wax / grid_element_width), nbCols - 1);
    log("wx " + (wx - workArea.x) + " el_width " + grid_element_width + " max " + (nbCols - 1) + " res " + lux);
    let luy = Math.min(Math.floor(way / grid_element_height), grid.rows - 1);
    log("wy " + (wy - workArea.y) + " el_height " + grid_element_height + " max " + (nbRows - 1) + " res " + luy);
    let rdx = Math.min(Math.floor((wax + wwidth - 1) / grid_element_width), grid.cols - 1);
    log("wx + wwidth " + (wx + wwidth - workArea.x - 1) + " el_width " + grid_element_width + " max " + (nbCols - 1) + " res " + rdx);
    let rdy = Math.min(Math.floor((way + wheight - 1) / grid_element_height), grid.rows - 1);
    log("wy + wheight " + (wy + wheight - workArea.y - 1) + " el_height " + grid_element_height + " max " + (nbRows - 1) + " res " + rdy);
    log("Initial tile selection is " + lux + ":" + luy + " - " + rdx + ":" + rdy);
    
    grid.elements[luy] [lux]._onButtonPress();     
    grid.elements[rdy] [rdx]._onHoverChanged();    

    let cX = delegate.currentElement.coordx;
    let cY = delegate.currentElement.coordy;
    let fX = delegate.first.coordx;
    let fY = delegate.first.coordy;

    log("After initial selection first fX " + fX + " fY " + fY + " current cX " + cX + " cY " + cY);      
}

function keyMoveResizeEvent(type, key) {
    log("Got key event " + type + " " + key);  
    if (!focusMetaWindow) {
        return;
    }
    let mind = focusMetaWindow.get_monitor();
    let monitor = monitors[mind];
    let mkey = getMonitorKey(monitor);
    let grid = grids[mkey];
    let delegate = grid.elementsDelegate;
    
    if(!delegate.currentElement) {
        log("Key event while no mouse activation - set current and second element");
        setInitialSelection();
    } else {
	if(!delegate.first){
	    log("currentElement is there but no first yet");
	    delegate.currentElement._onButtonPress();
	}
    }
    if(!delegate.currentElement) {
	log("gTime currentElement is not set!");
    }
    let cX = delegate.currentElement.coordx;
    let cY = delegate.currentElement.coordy;
    let fX = delegate.first.coordx;
    let fY = delegate.first.coordy;
    
    log("Before move/resize first fX " + fX + " fY " + fY + " current cX " + cX + " cY " + cY);
    log("Grid cols " + nbCols + " rows " + nbRows);
    if(type == 'move') {	 
	switch(key) {
	    case 'right':
		if(fX < nbCols - 1 && cX < nbCols - 1) {
		    delegate.first = grid.elements [fY] [fX + 1];
		    grid.elements[cY] [cX + 1]._onHoverChanged(); 
		}
		break;
	    case 'left':
		if(fX > 0 && cX > 0) {
		    delegate.first = grid.elements [fY] [fX - 1];
		    grid.elements[cY] [cX - 1]._onHoverChanged(); 
		}
		break;
	    case 'up':
		if(fY > 0 && cY > 0) {
		    delegate.first = grid.elements [fY - 1] [fX];
		    grid.elements[cY - 1] [cX]._onHoverChanged(); 
		}
		break;
	    case 'down':
		if(fY < nbRows - 1 && cY < nbRows - 1) {
		    delegate.first = grid.elements [fY + 1] [fX];
		    grid.elements[cY + 1] [cX]._onHoverChanged(); 
		}
		break;
	}      
    } else {
	switch(key) {
	    case 'right':
		if(cX < nbCols - 1) {
		    grid.elements[cY] [cX + 1]._onHoverChanged(); 
		}
		break;
	    case 'left':
		if(cX > 0) {
		    grid.elements[cY] [cX - 1]._onHoverChanged(); 
		}
		break;
	    case 'up':
		if(cY > 0 ) {
		    grid.elements[cY - 1] [cX]._onHoverChanged(); 
		}
		break;
	    case 'down':
		if(cY < nbRows - 1) {
		    grid.elements[cY + 1] [cX]._onHoverChanged(); 
		}
		break;
	}
    }
    
    cX = delegate.currentElement.coordx;
    cY = delegate.currentElement.coordy;
    fX = delegate.first.coordx;
    fY = delegate.first.coordy;
    
    log("After move/resize first fX " + fX + " fY " + fY + " current cX " + cX + " cY " + cY);
    
}

function presetResize(preset) {
    // Expected preset format is XxY x1:y1 x2:y2
    // XxY is grid size like 6x8
    // x1:y1 is left upper corner coordinates in grid tiles, starting from 0
    // x2:y2 is right down corner coordinates in grid tiles

    let window = getFocusApp();
    if (!window) {
        log("No focused window - ignoring keyboard shortcut");
        return;
    }

    reset_window(window);
    
    let preset_string = settings.get_string("resize" + preset);
    log("Preset resize " + preset + "  is " + preset_string);  
    let ps = preset_string.split(" ");
    if(ps.length != 3) {
        log("Bad preset " + preset + " settings " + preset_string);
	return;
    }
    let grid_format = parseTuple(ps[0], "x");
    let luc = parseTuple(ps[1], ":");
    let rdc = parseTuple(ps[2], ":");
    log("Parsed " + grid_format.X + "x" + grid_format.Y + " " 
        + luc.X + ":" + luc.Y + " " + rdc.X + ":" + rdc.Y);
    if  (  grid_format.X < 1 || luc.X < 0 || rdc.X < 0 
        || grid_format.Y < 1 || luc.Y < 0 || rdc.Y < 0 
        || grid_format.X <= luc.X || grid_format.X <= rdc.X 
        || grid_format.Y <= luc.Y || grid_format.Y <= rdc.Y 
        || luc.X > rdc.X || luc.Y > rdc.Y) {
        log("Bad preset " + preset + " settings " + preset_string);
	return;      
    }
    log("Parsed preset " + preset + " " + grid_format.X + "x" + grid_format.Y +
        " " + luc.X + ":" + luc.Y + " " + rdc.X + ":" + rdc.Y);
    
    let mind = window.get_monitor();
    let monitor = monitors[mind];
    let work_area = getWorkArea(monitor);
    let grid_element_width = Math.floor(work_area.width / grid_format.X);
    let grid_element_height = Math.floor(work_area.height / grid_format.Y);
    
    let wx = work_area.x + luc.X * grid_element_width + gridSettings[SETTINGS_WINDOW_MARGIN];
    let wy = work_area.y + luc.Y * grid_element_height + gridSettings[SETTINGS_WINDOW_MARGIN];
    let ww = (rdc.X + 1 - luc.X) * grid_element_width - 2 * gridSettings[SETTINGS_WINDOW_MARGIN];
    let wh = (rdc.Y + 1 - luc.Y) * grid_element_height- 2 * gridSettings[SETTINGS_WINDOW_MARGIN];
    
    log("Resize preset " + preset + " resizing to wx " + wx + " wy " + wy + " ww " + ww + " wh " + wh);    
    window.move_resize_frame(true, wx, wy, ww, wh);
}

/*****************************************************************
  PROTOTYPES
 *****************************************************************/

function TopBar(title) {
    this._init(title);
}

TopBar.prototype = {

    _init: function(title) {
        this.actor = new St.BoxLayout({style_class:'top-box'});
        this._title = title;

        this._stlabel =  new St.Label({style_class: 'grid-title', text: this._title});
        // this._iconBin = new St.Bin({ x_fill: false, y_fill: true });

        this._closebutton = new GTileStatusButton('close-button');
        this._closebutton.container.add_style_class_name('close-button-container');

        //this.actor.add_actor(this._iconBin);
        this.actor.add_actor(this._closebutton.container,{x_fill: false, expand: true, x_align:St.Align.END});
        this.actor.add_actor(this._stlabel,{x_fill: false, expand: false, x_align: St.Align.MIDDLE});

        //log( this._closebutton.actor);
        //this.actor.add_actor(this._closebutton.container,{x_fill: false,expand: true,x_align:
    },

    _set_title: function(title) {
        this._title = title;
        this._stlabel.text = this._title;
    },

    _set_app: function(app, title) {
        this._title = app.get_name()+" - "+title;
        log("title: "+this._title);
        this._stlabel.text = this._title;
        // this._icon = app.create_icon_texture(24);

        //this._iconBin.set_size(24, 24);
        //this._iconBin.child = this._icon;
    },
};

function ToggleSettingsButtonListener() {
    this._init();
};

ToggleSettingsButtonListener.prototype = {
    _init: function() {
        this.actors = new Array();
    },

    addActor: function(actor) {
               actor.connect('update-toggle', Lang.bind(this, this._updateToggle));
               this.actors.push(actor);
    },

    _updateToggle: function() {
        log("_updateToggle");
        for (let actorIdx in this.actors) {
            let actor = this.actors[actorIdx];
            actor._update();
        }
    }
};

function ToggleSettingsButton(text, property) {
    this._init(text,property);
};

ToggleSettingsButton.prototype = {
    _init: function(text, property) {
        this.text = text;
        this.actor = new St.Button({
            style_class: 'settings-button',
            reactive: true,
            can_focus:true,
            track_hover: true
        });
        this.label = new St.Label({style_class: 'settings-label', reactive:true, can_focus:true, track_hover:true, text: this.text});
        this.icon = new St.BoxLayout({style_class: this.text+"-icon", reactive:true, can_focus:true, track_hover:true});
        this.actor.add_actor(this.icon);
        this.property = property;
        this._update();
        this.actor.add_actor(this.icon, {x_fill:true, y_fill:true});
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        this.connect('update-toggle', Lang.bind(this, this._update))
    },

    _update : function() {
        log("_update event");
        if (gridSettings[this.property]) {
            this.actor.add_style_pseudo_class('activate');
        }
        else {
            this.actor.remove_style_pseudo_class('activate');
        }
    },

    _onButtonPress : function() {
        gridSettings[this.property] = !gridSettings[this.property];
        log("" + this.property+": "+gridSettings[this.property]);
        this.emit('update-toggle');
    }
};

Signals.addSignalMethods(ToggleSettingsButton.prototype);

function ActionButton(grid, classname) {
    this._init(grid, classname);
}

ActionButton.prototype = {
    _init: function(grid,classname) {
        this.grid = grid;
        this.actor = new St.Button({style_class: 'settings-button',
            reactive: true,
            can_focus:true,
            track_hover: true
        });

        this.icon = new St.BoxLayout({style_class: classname, reactive:true, can_focus:true, track_hover:true });
        this.actor.add_actor(this.icon);

        this.actor.add_actor(this.icon);
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
    },

    _onButtonPress: function() {
        this.emit('button-press-event');
    }
};

Signals.addSignalMethods(ActionButton.prototype);

function AutoTileMainAndList(grid) {
    this._init(grid,"action-main-list");
}

AutoTileMainAndList.prototype = {
    __proto__: ActionButton.prototype,

    _init: function(grid, classname) {
        ActionButton.prototype._init.call(this, grid, classname);
        this.classname = classname;
        this.connect('button-press-event', Lang.bind(this, this._onButtonPress));
    },

    _onButtonPress: function() {
        if (!focusMetaWindow) {
                return;
        }
        reset_window(focusMetaWindow);

        let monitor = this.grid.monitor;
        let workArea = getWorkArea(monitor);
        let windows = getNotFocusedWindowsOfMonitor(monitor);

        move_resize_window_with_margins(
            focusMetaWindow,
            workArea.x,
            workArea.y,
            workArea.width/2,
            workArea.height);

        let winHeight = workArea.height/windows.length;
        let countWin = 0;

        //log("MonitorHeight: "+monitor.height+":"+windows.length );

        for (let windowIdx in windows) {
            let metaWindow = windows[windowIdx].meta_window;
            /*let wm_type = metaWindow.get_window_type();
            let layer = metaWindow.get_layer();
            log("" + metaWindow.get_title()+" "+wm_type+" "+layer);*/

            let newOffset = workArea.y + (countWin * winHeight);
            //log("newOffset: "+ newOffset);
            reset_window(metaWindow);

            move_resize_window_with_margins(
                metaWindow,
                workArea.x + workArea.width/2,
                newOffset,
                workArea.width/2,
                winHeight
            );
            countWin++;
        }

        this.emit('resize-done');
    }
}

Signals.addSignalMethods(AutoTileMainAndList.prototype);

function AutoTileTwoList(grid) {
    this._init(grid,"action-two-list");
}

AutoTileTwoList.prototype = {
    __proto__: ActionButton.prototype,

    _init : function(grid,classname) {
        ActionButton.prototype._init.call(this, grid, classname);
        this.classname = classname;
        this.connect('button-press-event',Lang.bind(this,this._onButtonPress));
    },

    _onButtonPress: function() {
        if (!focusMetaWindow) {
            return;
        }

        reset_window(focusMetaWindow);

        let monitor = this.grid.monitor;
        let workArea = getWorkArea(monitor);

        let windows = getNotFocusedWindowsOfMonitor(monitor);//getWindowsOfMonitor(monitor);

        let nbWindowOnEachSide = Math.ceil((windows.length + 1) / 2);
        let winHeight = workArea.height/nbWindowOnEachSide;

        let countWin = 0;

        move_resize_window_with_margins(
            focusMetaWindow,
            workArea.x + countWin%2 * workArea.width/2,
            workArea.y + (Math.floor(countWin/2) * winHeight),
            workArea.width/2,
            winHeight
        );

        countWin++;

        // todo make function
        for (let windowIdx in windows) {
            let metaWindow = windows[windowIdx].meta_window;

            reset_window(metaWindow);

            move_resize_window_with_margins(
                metaWindow,
                workArea.x + countWin%2 * workArea.width/2,
                workArea.y + (Math.floor(countWin/2) * winHeight),
                workArea.width/2,
                winHeight
            );
            countWin++;
        }

        this.emit('resize-done');
    }
}

Signals.addSignalMethods(AutoTileTwoList.prototype);

function ActionScale(grid) {
    this._init(grid,"action-scale");
}

ActionScale.prototype = {
    __proto__: ActionButton.prototype,

    _init: function(grid, classname) {
        ActionButton.prototype._init.call(this, grid, classname);
        this.classname = classname;
        this.connect('button-press-event',Lang.bind(this,this._onButtonPress));
    },

    _onButtonPress: function() {
        //log("" + this.classname + "pressed");
    }
}

function GridSettingsButton(text,cols,rows) {
    this._init(text,cols,rows);
}

GridSettingsButton.prototype = {
    _init: function(text, cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.text = text;

        this.actor = new St.Button({style_class: 'settings-button',
        reactive: true,
        can_focus:true,
        track_hover: true});

        this.label = new St.Label({style_class: 'settings-label', reactive:true, can_focus:true, track_hover:true, text:this.text});

        this.actor.add_actor(this.label);

        this.actor.connect('button-press-event', Lang.bind(this,this._onButtonPress));
    },

    _onButtonPress: function() {
        nbCols = this.cols;
        nbRows = this.rows;

        refreshGrids();
    }
};

function Grid(monitor_idx,screen,title,cols,rows) {
    this._init(monitor_idx,screen,title,cols,rows)
}

Grid.prototype = {
    _init: function(monitor_idx,monitor,title,cols,rows) {
        let workArea = getWorkArea(monitor);

        this.tableWidth = 320;
        this.tableHeight = (this.tableWidth / workArea.width) * workArea.height;
        this.borderwidth = 2;

        this.actor = new St.BoxLayout({ vertical:true,
            style_class: 'grid-panel',
            reactive:true,
            can_focus:true,
            track_hover:true
        });

        this.actor.connect('enter-event',Lang.bind(this,this._onMouseEnter));
        this.actor.connect('leave-event',Lang.bind(this,this._onMouseLeave));

        this.topbar = new TopBar(title);

        this.bottombarContainer = new St.Bin({ style_class: 'bottom-box-container',
            reactive:true,
            can_focus:true,
            track_hover:true
        });

        this.bottombar = new St.Widget({
            style_class: 'bottom-box',
            can_focus: true,
            track_hover: true,
            reactive: true,
            width:this.tableWidth-20,
            height:36,
            layout_manager: new Clutter.TableLayout()
        });
        this.bottombar_table_layout = this.bottombar.layout_manager;

        this.bottombarContainer.add_actor(this.bottombar,{x_fill:true,y_fill:true})

        this.veryBottomBarContainer = new St.Bin({ style_class: 'very-bottom-box-container',
            reactive:true,
            can_focus:true,
            track_hover:true
        });

        this.veryBottomBar = new St.Widget({
            style_class: 'very-bottom-box',
            can_focus: true,
            track_hover: true,
            reactive: true,
            width:this.tableWidth-20,
            height:36,
            layout_manager: new Clutter.TableLayout()
        });
        this.veryBottomBar_table_layout = this.veryBottomBar.layout_manager;

        this.veryBottomBarContainer.add_actor(this.veryBottomBar,{x_fill:true,y_fill:true})

        let rowNum = 0;
        let colNum = 0;
        let maxPerRow = 4;

        let gridSettingsButton = gridSettings[SETTINGS_GRID_SIZES];

        for (var index=0; index<gridSettingsButton.length;index++) {
            if (colNum>= 4) {
                colNum = 0;
                rowNum += 2;
            }

            let button = gridSettingsButton[index];
            button = new GridSettingsButton(button.text,button.cols,button.rows);
            this.bottombar_table_layout.pack(button.actor, colNum, rowNum);
            button.actor.connect('notify::hover',Lang.bind(this,this._onSettingsButton));
            colNum++;
        }

        this.tableContainer = new  St.Bin({ style_class: 'table-container',
            reactive:true,
            can_focus:true,
            track_hover:true
        });

        this.table = new St.Widget({
            style_class: 'table',
            can_focus: true,
            track_hover: true,
            reactive: true,
            height:this.tableHeight,
            width:this.tableWidth-2,
            layout_manager: new Clutter.TableLayout()
        });
        this.table_table_layout = this.table.layout_manager;

        this.tableContainer.add_actor(this.table,{x_fill:true,y_fill:true})

        this.actor.add_actor(this.topbar.actor,{x_fill:true});
        this.actor.add_actor(this.tableContainer,{x_fill:true});
        this.actor.add_actor(this.bottombarContainer,{x_fill:true});
        this.actor.add_actor(this.veryBottomBarContainer,{x_fill:true});


        this.monitor = monitor;
        this.monitor_idx = monitor_idx;
        this.rows = rows;
        this.title = title;
        this.cols = cols;
	
        this.isEntered = false;

        if (true) {
            let nbTotalSettings = 4;

            if (!toggleSettingListener) {
                toggleSettingListener = new ToggleSettingsButtonListener();
            }

            let toggle = new ToggleSettingsButton("animation",SETTINGS_ANIMATION);
            this.veryBottomBar_table_layout.pack(toggle.actor, 0, 0);
            toggleSettingListener.addActor(toggle);

            toggle = new ToggleSettingsButton("auto-close",SETTINGS_AUTO_CLOSE);
            this.veryBottomBar_table_layout.pack(toggle.actor, 1, 0);
            toggleSettingListener.addActor(toggle);

            let action = new AutoTileMainAndList(this);
            this.veryBottomBar_table_layout.pack(action.actor, 2, 0);
            action.connect('resize-done', Lang.bind(this,this._onResize));

            action = new AutoTileTwoList(this);
            this.veryBottomBar_table_layout.pack(action.actor, 3, 0);
            action.connect('resize-done', Lang.bind(this,this._onResize));

            /*action = new ActionScale(this);
            action.actor.width = (this.tableWidth / nbTotalSettings) - this.borderwidth*2;
            this.veryBottomBar.add(action.actor,{row:0, col:4,x_fill:false,y_fill:false});   */
        }


        this.x = 0;
        this.y = 0;

        this.interceptHide = false;
        this._displayElements();

        this.normalScaleY = this.actor.scale_y;
        this.normalScaleX = this.actor.scale_x;
    },

    _displayElements: function() {
        this.elements = new Array();

        let width = (this.tableWidth / this.cols);// - 2*this.borderwidth;
        let height = (this.tableHeight / this.rows);// - 2*this.borderwidth;

        this.elementsDelegate = new GridElementDelegate();
        this.elementsDelegate.connect('resize-done', Lang.bind(this, this._onResize));
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (c == 0) {
                    this.elements[r] = new Array();
                }

                let element = new GridElement(this.monitor,width,height,c,r);

                this.elements[r][c] = element;
                element.actor._delegate = this.elementsDelegate;
                this.table_table_layout.pack(element.actor, c, r);
                element.show();
            }
        }
    },

    refresh: function() {
        this.table.destroy_all_children();
        this.cols = nbCols;
        this.rows = nbRows;
        this._displayElements();
    },

    set_position: function (x, y) {
        this.x = x;
        this.y = y;
        this.actor.set_position(x, y);
    },

    show: function() {
        this.interceptHide = true;
        this.elementsDelegate.reset();
        let time = (gridSettings[SETTINGS_ANIMATION]) ? 0.3 : 0 ;

        this.actor.raise_top();
        Main.layoutManager.removeChrome(this.actor);
        Main.layoutManager.addChrome(this.actor);
        //this.actor.y = 0 ;
        this.actor.scale_y= 0;
        //this.actor.scale_x= 0;
        if (time > 0 ) {
            Tweener.addTween(this.actor, {
                time: time,
                opacity: 255,
                visible: true,
                transition: 'easeOutQuad',
                scale_y: this.normalScaleY,
                onComplete: this._onShowComplete
            });
        }
        else {
            this.actor.opacity = 255;
            this.actor.visible = true;
            this.actor.scale_y = this.normalScaleY;
        }

        this.interceptHide = false;
    },

    hide: function(immediate) {
      log("hide " + immediate);
        this.elementsDelegate.reset();
        let time = (gridSettings[SETTINGS_ANIMATION] && !immediate) ? 0.3 : 0;
        //log("" + time);
        if (time > 0) {
            Tweener.addTween(this.actor, {
                time: time,
                opacity: 0,
                visible: false,
                scale_y:0,
                transition: 'easeOutQuad',
                onComplete: this._onHideComplete
            });
        }
        else {
            this.actor.opacity = 0;
            this.actor.visible = false;
            //this.actor.y = 0;
            this.actor.scale_y = 0;
        }
    },

    _onHideComplete: function() {
        if(!this.interceptHide && this.actor) {
            Main.layoutManager.removeChrome(this.actor);
        }
    },

    _onShowComplete: function() {

    },

    _onResize: function(actor, event) {
        log("resize-done: "+actor);
        updateRegions();
        if (gridSettings[SETTINGS_AUTO_CLOSE]) {
            this.emit('hide-tiling');
        }
    },

    _onMouseEnter: function() {
        log("onMouseEnter");
        if (!this.isEntered) {
            this.elementsDelegate.reset();
            this.isEntered = true;
        }
    },

    _onMouseLeave: function() {
        log("onMouseLeave");
        let [x, y, mask] = global.get_pointer();
        if ( this.elementsDelegate && (x <= this.actor.x || x>= (this.actor.x+this.actor.width)) || (y <=this.actor.y || y >= (this.actor.y+this.height)) ) {
            this.isEntered = false;
            this.elementsDelegate.reset();
            refreshGrids();
        }
    },

    _onSettingsButton: function() {
        this.elementsDelegate.reset();
    },

    _destroy: function() {
        for (let r in this.elements) {
            for (let c in this.elements[r]) {
                this.elements[r][c]._destroy();
            }
        }

        this.elementsDelegate._destroy();
        this.topbar._destroy();

        this.monitor = null;
        this.rows = null;
        this.title = null;
        this.cols = null;
    }
};

Signals.addSignalMethods(Grid.prototype);

function GridElementDelegate(rows, cols, width, height) {
    this._init();
}

GridElementDelegate.prototype = {

    _init: function() {
        this.activated = false;
        this.first = false;
        this.currentElement = false;
        this.activatedActors=false;
    },

    _allSelected: function() {
        return (this.activatedActors.length == (nbCols * nbRows));
    },

    _onButtonPress: function(gridElement) {
        if(!this.currentElement) {
	    this.currentElement = gridElement;
	}
        if (this.activated==false) {
            this.activated = true;
            gridElement.active = true;
            this.activatedActors= new Array();
            this.activatedActors.push(gridElement);
            this.first = gridElement;
        }
        else {
            log("resize");
            //Check this.activatedActors if equals to nbCols * nbRows
            //before doing anything with the window it must be unmaximized
            //if so move the window then maximize instead of change size
            //if not move the window and change size

            reset_window(focusMetaWindow);

            //focusMetaWindow.move_anchor_point_from_gravity(Clutter.Gravity.CENTER);

            let areaWidth,areaHeight,areaX,areaY;
            [areaX,areaY,areaWidth,areaHeight] = this._computeAreaPositionSize(this.first,gridElement);

            if (this._allSelected()) {
                move_maximize_window(focusMetaWindow,areaX,areaY);
            }
            else {
                move_resize_window_with_margins(focusMetaWindow,areaX,areaY,areaWidth,areaHeight);
            }
            //focusMetaWindow.configure_notify();

            this._resizeDone();
        }
    },

    _resizeDone: function() {
        log("resizeDone, emitting signal");
        this.emit('resize-done');
    },

    reset: function() {
        this._resetGrid();

        this.activated = false;
        this.first = false;
        this.currentElement = false;
    },

    _resetGrid: function() {
        this._hideArea();
        if (this.currentElement) {
            this.currentElement._deactivate();
        }

        for (var act in this.activatedActors) {
            this.activatedActors[act]._deactivate();
        }
        this.activatedActors = new Array();
    },

    _getVarFromGridElement: function(fromGridElement, toGridElement) {
        let minX = Math.min(fromGridElement.coordx, toGridElement.coordx);
        let maxX = Math.max(fromGridElement.coordx, toGridElement.coordx);

        let minY = Math.min(fromGridElement.coordy, toGridElement.coordy);
        let maxY = Math.max(fromGridElement.coordy, toGridElement.coordy);

        return [minX,maxX,minY,maxY];
    },

    refreshGrid: function(fromGridElement, toGridElement) {
        this._resetGrid();
        let [minX,maxX,minY,maxY] = this._getVarFromGridElement(fromGridElement, toGridElement);

        let key = getMonitorKey(fromGridElement.monitor);
        let grid = grids[key];
        for (let r=minY; r <= maxY; r++) {
            for (let c=minX; c <= maxX; c++) {
                let element = grid.elements[r][c];
                element._activate();
                this.activatedActors.push(element);
            }
        }

        this._displayArea(fromGridElement, toGridElement);
    },

    _computeAreaPositionSize: function(fromGridElement, toGridElement) {
        let [minX,maxX,minY,maxY] = this._getVarFromGridElement(fromGridElement,toGridElement);

        let monitor = fromGridElement.monitor;
        let workArea = getWorkArea(monitor);

        let areaWidth = (workArea.width/nbCols)*((maxX-minX)+1);
        let areaHeight = (workArea.height/nbRows)*((maxY-minY)+1);

        let areaX = workArea.x + (minX*(workArea.width/nbCols));
        let areaY = workArea.y + (minY*(workArea.height/nbRows));

        return [areaX,areaY,areaWidth,areaHeight];
    },

    _displayArea: function(fromGridElement, toGridElement) {
        let areaWidth,areaHeight,areaX,areaY;
        [areaX,areaY,areaWidth,areaHeight] = this._computeAreaPositionSize(fromGridElement,toGridElement);

        area.add_style_pseudo_class('activate');

        if (gridSettings[SETTINGS_ANIMATION]) {
            Tweener.addTween(area, {
                time: 0.2,
                x:areaX,
                y:areaY,
                width:areaWidth,
                height: areaHeight,
                transition: 'easeOutQuad'
            });
        }
        else {
            area.width = areaWidth;
            area.height = areaHeight;
            area.x = areaX;
            area.y = areaY;
        }
    },

    _hideArea: function() { 
        area.remove_style_pseudo_class('activate');
    },

    _onHoverChanged: function(gridElement) {
        if(this.activated) {
            this.refreshGrid(this.first,gridElement);
            this.currentElement = gridElement;
        }
        else if (!this.currentElement || gridElement.id != this.currentElement.id) {
            if (this.currentElement) {
                this.currentElement._deactivate();
            }

            this.currentElement = gridElement;
            this.currentElement._activate();	    
            this._displayArea(gridElement,gridElement);	    
        }
    },

    _destroy: function() {
        this.activated = null;
        this.first = null;
        this.currentElement = null;
        this.activatedActors=null;
    }
};

Signals.addSignalMethods(GridElementDelegate.prototype);

function GridElement(monitor, width, height, coordx, coordy) {
    this._init(monitor, width, height, coordx, coordy);
}

GridElement.prototype = {

    _init: function(monitor,width,height,coordx,coordy) {
        this.actor = new St.Button({style_class: 'table-element',reactive: true,can_focus:true,track_hover: true})

        this.actor.visible = false;
        this.actor.opacity = 0;
        this.monitor = monitor;
        this.coordx = coordx;
        this.coordy = coordy;
        this.width = width;
        this.height = height;

        this.id =  getMonitorKey(monitor)+":"+coordx+":"+coordy;

        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        this.actor.connect('notify::hover', Lang.bind(this, this._onHoverChanged));

        this.active = false;
    },

    show: function () {
        this.actor.opacity = 255;
        this.actor.visible = true;
    },

    hide: function () {
        this.actor.opacity = 0;
        this.actor.visible = false;
    },

    _onButtonPress: function() {
        log("onButtonPress "+this.id);
        this.actor._delegate._onButtonPress(this);
    },

    _onHoverChanged: function() {
        log("onHoverChanged "+this.id);
        this.actor._delegate._onHoverChanged(this);
    },

    _activate: function() {
        log("activate "+this.id);

        this.actor.add_style_pseudo_class('activate');
    },

    _deactivate: function() {
        log("deactivate "+this.id);
        this.actor.remove_style_pseudo_class('activate');
    },

    _clean: function() {
        Main.uiGroup.remove_actor(area);
    },

    _destroy: function() {
        this.monitor = null;
        this.coordx = null;
        this.coordy = null;
        this.width = null;
        this.height = null;

        this.active = null;
    }
};
