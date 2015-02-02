/////////// DO NOT MODIFY THIS FILE ///////////
/////////// DO NOT MODIFY THIS FILE ///////////
var infoStrings = require("infoStrings");
var pause = false;
var oldVersion = false;

// Executes the commands in a test's actions array, updates the listView in index, and calls the next test
// actions: actions array from the test; commands to be executed
// window: main window of the test being run; used to close the test upon completion 
// relaunchA: boolean; should test be re-launched
function automate(actions, window, args) {
	var index = 0; 					// index of actions array
	var action;						// array; action being processed
	var count = null; 				// null/int; counter for timeout
	var run = true;					// boolean; should another action be run
	var result = null;				// any; result of the action
	var tempResult = null;			// any; temp holding of action result for processing
	var retest = false;				// boolean; should test be re-run by user
	var relaunch = args.relaunch;	// boolean; should test be re-launched
	var timeout = null;				// timeout to keep track of waits
	
	var timer = setInterval(function() {
		action = actions[index];

		if (run == true) {
			run = false;
			if (typeof action[0] == "string") {
				// ARRAY METHOD (OLD)
				if (!oldVersion) {
					Ti.API.warn("Actions in "+args.test+" are using v1 syntax");
					//When removing this check, can also remove passed test property in controller creation, from index.
					oldVersion = true;
				}
				if (count === null) {
					count = 10;
				}
				if (action[0] !== "screenshot")
					Alloy.Globals.alert = null;
				switch(action[0]) {
					case "call":
						try {
							switch(action.length) {
								case 4:
									tempResult = typeof action[2] == "object" ? action[1].apply(this, action[2] || []) : action[1](action[2] || []);
									count = action[3] > 240 ? action[3]/500 : action[3]*2;
									break;
								case 3:
									tempResult = typeof action[2] == "object" ? action[1].apply(this, action[2] || []) : action[1](action[2] || []);
									break;
								default:
									tempResult = action[1]();
									break;
							}
						} catch (error) {retest = true; Ti.API.error(error);}
						break;
					case "screenshot":
						count = index == actions.length-1 ? 4 : 3;
						setTimeout(function() {
							try {Alloy.Globals.window.fireEvent("screenshot", {image:action.length==2?action[1].toImage(null, true):null});} catch (error) {retest = true; Ti.API.error(error);}
						}, index==0?1000:0);
						break;
					case "relaunch":
						if (!relaunch) {
							result = "relaunch";
							index = actions.length;
						}
						relaunch = !relaunch;
						count = 0;
						break;
					case "restart":
						if (!relaunch)
							Ti.App._restart();
						relaunch = false;
						count = 0;
						break;
					case "wait":
						count = action[1] > 240 ? action[1]/500 : action[1]*2;
						break;
					case "background":
						if (OS_IOS) {
							if (Ti.Platform.canOpenURL("qeahelper://")) {					
								Ti.Platform.openURL("qeahelper://?time="+(action[2] > 240 ? action[2]/500 : action[2]*2));
							}
						} else if (OS_ANDROID) {
							var	myIntent = Ti.Android.createIntent({
								action:	Ti.Android.ACTION_MAIN,
								packageName: "com.appc.qeautomatorhelper",
								className: "com.appc.qeautomatorhelper.qeautomatorhelper",
								flags: Ti.Android.FLAG_ACTIVITY_NEW_TASK,
								url: "qeahelper://?time="+(action[2] > 240 ? action[2]/500 : action[2]*2)
							});
							myIntent.addCategory(Ti.Android.CATEGORY_LAUNCHER);
							Ti.Android.currentActivity.startActivity(myIntent);
						}
						count = 2;
						pause = action[1] === true ? true : false;
						break;
					case "log":
						if (Alloy.Globals.log.indexOf(action[1]) == -1)
							tempResult = false;
						count = (action[2] || 1) > 240 ? action[2]/500 : (action[2] || 1)*2;
						break;
					default:
						// Fire an event
						if (action.length == 4) {
							action[1].fireEvent(action[0], action[2]);
							count = action[3] > 240 ? action[3]/500 : action[3]*2;
						} else { // Call a method
							action[1][action[0]]();
							count = (action[2] || 2) > 240 ? action[2]/500 : (action[2] || 1)*2;
						}
						break;
				}
			} else {
				//OBJECT METHOD (NEW)
				if (typeof action.runs == "undefined" || Alloy.Globals.launches < action.runs) {
					if (typeof action.time != "undefined")
						count = action.time > 240 ? action.time/500 : action.time*2;
					else
						count = 10;
					if (typeof action.call != "undefined") {
						try{
							tempResult = typeof action.args == "object" ? action.call.apply(this, action.args) : action.call(action.args);
						} catch (error) {retest = true; Ti.API.error(error);}
					} else if (typeof action.event != "undefined") {
						action.object.fireEvent(action.event, action.args || {});
					} else if (typeof action.method != "undefined") {
						if (action.args)
							action.object[action.method](action.args);
						else
							action.object[action.method](); 
					} else if (typeof action.screenshot != "undefined") {
						if (typeof action.time == "undefined" && typeof action.call == "undefined" && typeof action.event == "undefined" && typeof action.method == "undefined")
							count = 0;
					} else if (typeof action.wait != "undefined") {
						if (action.wait === true && typeof action.until != "undefined" && typeof action.object != "undefined") {
							Alloy.Globals.wait = true;
							action.object.addEventListener(action.until, callback);
							if (action.time)
							timeout = setTimeout(function(){ callback(); }, action.time > 240 ? action.time/500 : action.time*2);
						}
					} else if (typeof action.relaunch != "undefined") {
						if (Alloy.Globals.launches < action.relaunch) {
							result = "relaunch";
							index = actions.length;
							relaunch = true;
							Alloy.Globals.launches++;
						} else
							relaunch = false;
						count = 0;
					} else if (typeof action.restart != "undefined") {
						if (Alloy.Globals.launches < action.restart) {
							Alloy.Globals.launches++;
							Ti.App._restart();
						}
						relaunch = 0;
						count = 0;
					} else if (typeof action.background != "undefined") {
						if (OS_IOS) {
							if (Ti.Platform.canOpenURL("qeahelper://")) {					
								Ti.Platform.openURL("qeahelper://?time="+(action.time > 240 ? action.time/500 : action.time*2));
							}
						} else if (OS_ANDROID) {
							var	myIntent = Ti.Android.createIntent({
								action:	Ti.Android.ACTION_MAIN,
								packageName: "com.appc.qeautomatorhelper",
								className: "com.appc.qeautomatorhelper.qeautomatorhelper",
								flags: Ti.Android.FLAG_ACTIVITY_NEW_TASK,
								url: "qeahelper://?time="+(action.time > 240 ? action.time/500 : action.time*2)
							});
							myIntent.addCategory(Ti.Android.CATEGORY_LAUNCHER);
							Ti.Android.currentActivity.startActivity(myIntent);
						}
						count = 2;
						pause = action.background;
					} else if (typeof action.log != "undefined") {
						_log(action.log);
					} else if (typeof action.checkLog != "undefined") {
						tempResult = _checkLog(action.checkLog);
						count = (action.time || 1) > 240 ? action.time/500 : (action.time || 1)*2;
					}
				}
			}
		}
		if (tempResult !== null)
			count = 0;
		if (tempResult === false || tempResult === "skip") {
			index = actions.length;
			relaunch = false;
		}
		
		if (!pause)
			count--;
		if (count <= 0 && !Alloy.Globals.wait) {
			if (tempResult !== null && tempResult !== undefined)
				result = tempResult;
			tempResult = null;
			var wt = typeof action.wait;
			if (wt === "number") {			//Wait added to action (wait after execution)
				count = action.wait > 240 ? action.wait/500 : action.wait*2;;
				action.wait = undefined;
			} else {
				if (wt === "boolean") {
					try {action.object.removeEventListener(action.until, callback);} catch (error) {Ti.API.warn("Improper 'wait' action");}
					clearTimeout(timeout);
				}
				count = null;
				if (typeof action.screenshot != "undefined" && action.screenshot) {			//Screenshot added to action (screenshot after execution)
					count = index == actions.length-1 ? 4 : 3;
					setTimeout(function() {
						try {Alloy.Globals.window.fireEvent("screenshot", {object:action.screenshot, image:action.screenshot===true?null:action.screenshot.toImage(null, true)});} catch (error) {retest = true; Ti.API.error(error);}
						action.screenshot = false;
					}, index==0?1000:0);
				} else {
					run = true;
					index++;
					if (index >= actions.length) {
						clearInterval(timer);
						Alloy.Globals.window.fireEvent("updateItem", {result:result, retest:retest});
						window.close();
						Alloy.Globals.window.fireEvent("runNext", {relaunch:relaunch});
					}
				}
			}
		}
	}, 500);
}
exports.automate = automate;

var callback = function(){
	Alloy.Globals.wait = false;
};

// Listen for the resumed event and set pause to false. Used for backgrounding
Ti.App.addEventListener('resumed', function() {
	pause = false;
});

// Displays the information for the current test, set in infoStrings.js
// test: String of current test name
function infoClick(test) {
	var info = infoStrings.info;
		    
    var infoWin = Ti.UI.createWindow({});
    	infoWin.add(Ti.UI.createView({backgroundColor:"#000", opacity:0.5}));
    var infoView = Ti.UI.createScrollView({height:"50%", top:"50%", borderColor:"#000", borderRadius:"10dp", backgroundColor:"#eee"});
    var txt = test || "this test";
    var infoText = Ti.UI.createTextArea({height:"100%", width:"95%", value:"No info for "+txt, backgroundColor:"transparent", editable:false});
    
    if (info[test]) {
    	infoText.value=info[test];
    }
    infoWin.addEventListener("click", function(e) {
    	if (e.source == "[object TiUIView]")
    		infoWin.close();
    });
    infoView.add(infoText);
    infoWin.add(infoView);
    infoWin.open();  
}
exports.infoClick=infoClick;

//Places the close and info buttons on the test and starts the automation process
// actions: Actions array from the test
// window: _window variable from the test
// args: Arguments passed into the test. used to control automation, relaunching, etc.
function setup(actions, window, args) {
	if (args.automate)
		automate(actions, window, args);
		
	var view = Ti.UI.createView({height:35, bottom:0});
	
	var info = Ti.UI.createButton({backgroundImage:"info.png", bottom:0, left:0, width:35});
	info.addEventListener("click", function() { infoClick(args.test); });
	
	var close = Ti.UI.createButton({title: "Close", right:0, bottom:0});
	close.addEventListener("click", function() { window.close(); });
	
	view.add(info);
	view.add(close);
	window.add(view);
}
exports._setup=setup;
