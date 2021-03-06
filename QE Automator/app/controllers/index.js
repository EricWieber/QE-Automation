/*************************************************************************
					QE AUTOMATOR APP
This app is used to automate Alloy and Classic tests.
To add a test to the project:
	1. Create a controller for the test
		a. If Alloy, also create a view (style is optional)
		b. If Classic, treat the controller as the app.js
	2. Add the automation block to the bottom of the controller
		a. The block can be found at the top of the README
	3. Configure the automation block
		a. Set the _window var to the test's main window
		b. Add actions to the _actions array
			1. Examples can be found in the README
	4. Add the test to the tests array, below
		a. Examples can be found in the README
	5. Add the test's info to the app/lib/infoStrings/js file
		a. Examples are provided in the file
	
Documentation: https://wiki.appcelerator.org/display/qe/QE+Automation+App
*************************************************************************/
var tests = [
	{name:"TIMOBClassic"},
	{name:"TIMOBAlloy"},
	{name:"TIMOBInvalid", only:"nothing"}
];

////////////// DO NOT MODIFY BELOW THIS LINE //////////////

// Sort the tests by name
function sortTests() {
	for (x in tests)
		tests[x].name = tests[x].name.replace(/--/g, '-');
	tests.sort(function(a, b) { return parseInt(a.name.replace(/\D/g,'')) - parseInt(b.name.replace(/\D/g,'')); });
}
sortTests();

var Cloud = require('ti.cloud');
//Cloud.debug = true;

// Log in user for image upload/comparisons
Cloud.Users.login({
    login: 'qeautomator@appcelerator.com',
    password: '<PASSWORD HERE>'
}, function (e) {
    if (e.success)
        Ti.API.info("Connected to DB");
    else
        Ti.API.warn("Cannot connect to DB");
});

var run = [];
var curTest = null;
var rows = [];
var images = [];

// Create directory for test images
// Load existing images into the images array
(function(){
	var d = Titanium.Filesystem.getFile(Titanium.Filesystem.tempDirectory, 'testRunImages');
	if (!d.exists())
		d.createDirectory();
		
	var temps = Ti.Filesystem.getFile(Ti.Filesystem.tempDirectory, "testRunImages").getDirectoryListing();
	for (x in temps) {
		var fn = temps[x].replace('.png', '').split('--');
		if (typeof images[fn[0]] == "undefined")
			images[fn[0]] = [];
		images[fn[0]][fn[1]] = Ti.Filesystem.getFile(Ti.Filesystem.tempDirectory, "testRunImages/"+temps[x]);
	}
})();

Alloy.Globals.window = $.indexWindow;

loadList();

// Save the state of the app when closing teh main window
$.indexWindow.addEventListener("close", function() {
	Ti.App.Properties.setObject("data", {run:run, curTest:curTest, rows:JSON.stringify(rows), log:Alloy.Globals.log, launches:Alloy.Globals.launches});
});

// Restore the state of the app if opening ofter a close
$.indexWindow.addEventListener("open", function() {
	var data = Ti.App.Properties.getObject("data", null);
	if (data === null)
		return;
	run = data.run || [];
	curTest = data.curTest || null;
	rows = JSON.parse(data.rows) || [];
	Alloy.Globals.log = data.log || [];
	Alloy.Globals.launches = data.launches || 0;
	
	for (x in rows) {
		var item = rows[x].item;
		item.image.image = typeof images[item.title.text] != 'undefined' ? images[item.title.text][0] : '/appicon.png';
		for (y in $.view.sections[rows[x].sec].items)
			if ($.view.sections[rows[x].sec].items[y].title.text == item.title.text)
				$.view.sections[rows[x].sec].updateItemAt(y, item);
	}
	
	if (curTest !== null)
		Alloy.Globals.window.fireEvent("runNext", {relaunch:true});
});
$.indexWindow.open();

var imageClicked = false;
var playClicked = false;
var infoClicked = false;

var autoTimer = null;

if (Ti.Platform.name == "android")
	$.search.softKeyboardOnFocus = Ti.UI.Android.SOFT_KEYBOARD_HIDE_ON_FOCUS;

// Load the tests into the ListView, separating them by section and valid platforms/OSs
function loadList() {
	var sections = [];
	var secItems = [];
	
	for (x in tests) {
		if (typeof tests[x].section == 'undefined')
			continue;
				
		sections.push(createSection(tests[x].section, true));
		secItems[tests[x].section] = [];
	}
	sections.push(createSection("Valid", true));
	sections.push(createSection("Do Not Run", false));
	secItems["Valid"] = [];
	secItems["Do Not Run"] = [];
	
	for (y in tests) {
		var runnable = isValid(tests[y]);
			
		var item = {
			id: tests[y].name,
			title:{text:tests[y].name},
			subtitle:{text:runnable == true ? "Not Run" : "Invalid", backgroundColor:"transparent"},
			image:{image:(images == [] || typeof images[tests[y].name] == 'undefined') ? "/appicon.png" : images[tests[y].name][0]},
			properties: {searchableText:tests[y].name, selectionStyle:Ti.Platform.name == "iPhone OS"?Titanium.UI.iPhone.ListViewCellSelectionStyle.NONE:""}
		};
		if (runnable) {
			if (typeof tests[y].section != 'undefined')
				secItems[tests[y].section].push(item);
			else
				secItems["Valid"].push(item);
		} else
			secItems["Do Not Run"].push(item);
	}
	for (z in secItems) {
		sections[findSec(sections, z)].setItems(secItems[z]);
	}

	$.view.setSections(sections);
}

// Creates a section in the ListView
// s: String of the section's name
// rsbutton: Boolean if there should be a "run section" button on the section
function createSection(s, rsbutton) {
	var hdr = Ti.UI.createView({backgroundColor: "#eee"});
	var lbl = Ti.UI.createLabel({text:s, left:"10dp"});
	if (rsbutton) {
		var btn = Ti.UI.createButton({title:"Run Section", right:"10dp", sec:s});
		btn.addEventListener("click", function(e) {sectionClick(e.source.sec);});
		hdr.add(btn);
	}
	hdr.add(lbl);
	
	var section = Ti.UI.createListSection({id:s, headerView:hdr});
	return section;
}

// Find a section by id and return its index in it's parent's array. Returns the location of the "Valid" section if not found.
// sections: Array of sections to search through; parent array
// name: String of section name to find
function findSec(sections, name) {
	for (x in sections)
		if (sections[x].id == name)
			return x;
	return sections[sections.length-2];
}

// Is the test valid for the current platform/OS
// test: Test to validate
function isValid(test) {
	var ex = typeof test.exclude == 'undefined' ? false : true;
	var on = typeof test.only == 'undefined' ? false : true;
	
	var os = Ti.Platform.name == "iPhone OS" ? "ios" : Ti.Platform.name.toLowerCase();
	
	if (ex === true) {
		ex = test.exclude.indexOf(os);
		if (ex >= 0 || on === -1) return false;
		
		ex = test.exclude.indexOf(Ti.Platform.osname.toLowerCase());
		if (ex >= 0 || on === -1) return false;
		
		ex = test.exclude.indexOf("simulator");
		if (Ti.Platform.model === "Simulator" && ex >= 0) return false;
		
		ex = test.exclude.indexOf("emulator");
		if (Ti.Platform.model.indexOf('sdk') !== -1 && ex >= 0) return false;
	}
	
	if (on === true) {
		on = test.only.indexOf(os);
		if (on !== -1) return true;
		
		on = test.only.indexOf(Ti.Platform.osname.toLowerCase());
		if (on !== -1) return true;
		
		on = test.only.indexOf("simulator");
		if (Ti.Platform.model === "Simulator" && on !== -1) return true;
		
		on = test.only.indexOf("emulator");
		if (Ti.Platform.model.indexOf('sdk') !== -1 && on !== -1) return true;
		
		return false;
	}
	
	return true;
}

// Click on a row to manually run the test
// e: Row clicked
function rowClick(e) {
	if (imageClicked || playClicked || infoClicked) {
		imageClicked = playClicked = infoClicked = false;
		return;
	}
	
    var item = e.section.getItemAt(e.itemIndex);
    curTest = item.title.text;
    
    Alloy.Globals.alert = false;
	var winx = Alloy.createController(item.title.text, {test:curTest, automate:false}).getView();
    try { winx.open();} catch (error) {Ti.API.debug("Window already opened from controller "+curTest);};
}

// Click on a row's info button to view the description and expectations of a test
// Pulls from the JIRA ticket if able, otherwise loads from infoStrings array
// e: Row clicked
function infoClick(e) {
	var infoStrings = require("infoStrings");
	infoClicked = true;
	
    var item = e.section.getItemAt(e.itemIndex);
    
    var infoWin = Ti.UI.createWindow({});
    	infoWin.add(Ti.UI.createView({backgroundColor:"#000", opacity:0.5}));
    var infoView = Ti.UI.createView({height:"85%", top:"5%", width:"95%", borderColor:"#000", borderRadius:"10dp", backgroundColor:"#eee"});
    var close = Ti.UI.createButton({id:"close", title:"Close", top:"90%", color:"white"});
    	infoWin.add(close);
	    
	var infoWeb = Ti.UI.createWebView({willHandleTouches: false, html: "Info has not been set for "+item.title.text+"<hr>JIRA TICKET:<br>Loading..."});
	infoView.add(infoWeb);
	
	if (infoStrings.info[item.title.text])
    	infoWeb.html=infoStrings.info[item.title.text].replace(/\n/g, "<br>")+"<hr>JIRA TICKET:<br>Loading...";
	    	
    var xhr = Ti.Network.createHTTPClient({timeout: 4000});
    xhr.onload = function() {
    	var doc = this.responseXML.documentElement;
    	var items = doc.getElementsByTagName("item");
		
		infoWeb.html = infoWeb.html.replace("<br>Loading...", "<br>")+
			items.item(0).getElementsByTagName("title").item(0).text+"\n\n"+
    		items.item(0).getElementsByTagName("environment").item(0).text+"\n\n"+
    		items.item(0).getElementsByTagName("description").item(0).text;
    };
    xhr.onerror = function(e) {
    	setTimeout(function() {
	    	infoWeb.html = infoWeb.html.replace("<br>Loading...", "<br>Cannot load JIRA ticket");
    	}, 250);
    };
    
    var pos = item.title.text.search(/\d/);
    var test = [item.title.text.slice(0, pos), "-", item.title.text.slice(pos)].join("");
    xhr.open('GET', "https://jira.appcelerator.org/si/jira.issueviews:issue-xml/"+test+"/"+test+".xml");
    xhr.send();
    
    infoWin.addEventListener("click", function(e) { if (e.source != "[object WebView]") infoWin.close(); });
    
    infoWin.add(infoView);
    infoWin.open();  
}

// Click on a row's image to view the screenshots taken during automation
// e: Row clicked
function imageClick(e) {
	imageClicked = true;
	var item = e.section.getItemAt(e.itemIndex);
	
	var win = Ti.UI.createWindow({backgroundColor:"#eee"});
	var viewImages = [];
	for (x in images[item.title.text]) {
		var image = Ti.UI.createImageView({image:images[item.title.text][x], borderColor:"#000"});
		viewImages.push(image);
	}
	if (viewImages.length == 0) {
		viewImages.push(Ti.UI.createImageView({borderColor:"#000", width:"100%", height:"100%"}));
	}
	var scroll = Ti.UI.createScrollableView({views:viewImages, showPagingControl:true, pagingControlHeight:"10dp",
		borderColor:"#000", width:"90%", height:"90%", top:"4%", backgroundColor:"#fff"});
	var title = Ti.UI.createLabel({text:item.title.text, bottom:0, left:"5dp", height:"6%"});
	var status = Ti.UI.createLabel({text:item.subtitle.text, backgroundColor:item.subtitle.backgroundColor, bottom:0, right:0, height:"5%", font: { fontSize: 14 }});
	var options = Ti.UI.createButton({title:"Options", bottom: 0, height:"5%"});
	
	// Options button
	options.addEventListener("click", function() {
		var dialog = Ti.UI.createOptionDialog({
			cancel: 4,
			options: ['Check Differences from run', 'Upload Image for Comparisons', 'Clear Image from DB', 'Change test result', 'Cancel'],
			selectedIndex: 4,
			destructive: 2,
			title: 'Options'
		});
		
		dialog.addEventListener("click", function(e1) {
			var file = Ti.Filesystem.getFile(Ti.Filesystem.tempDirectory, "testRunImages/"+item.title.text+"--"+scroll.getCurrentPage()+
				Ti.Platform.model+
				Ti.Platform.version+
				Ti.Platform.displayCaps.density+
				Ti.Platform.displayCaps.dpi+
				Ti.Platform.displayCaps.platformWidth+
				Ti.Platform.displayCaps.platformHeight+
				".png"
			);
			switch (e1.index) {
				case 0:
					var checkWindow = Ti.UI.createWindow({backgroundColor:'white'});
					if (file.exists())
						checkWindow.backgroundImage = file.resolve();
					else
						checkWindow.add(Ti.UI.createLabel({text:"There was no image on the DB for this action, during the last run"}));
					
					checkWindow.addEventListener("click", function() {
						checkWindow.close();
					});
					
					checkWindow.open();					
					break;
				case 1:
					Cloud.Photos.query({
					    limit: 1,
					    where: { 'title': file.name }
					}, function (e) {
					    if (e.success) {
					    	if (e.photos.length == 1) {
						        Cloud.Photos.update({
								    photo_id: e.photos[0].id,
								    photo: Ti.Filesystem.getFile(Ti.Filesystem.tempDirectory, "testRunImages/"+item.title.text+"--"+scroll.getCurrentPage()+".png")
								}, function (e2) {
								    if (e2.success)
								        alert("Image uploaded");
								    else {
								 		alert("Unable to upload image");
								 		Ti.API.error("Update: "+e2.message);
								 	}
								});
							} else {
								Cloud.Photos.create({
								    photo: Ti.Filesystem.getFile(Ti.Filesystem.tempDirectory, "testRunImages/"+item.title.text+"--"+scroll.getCurrentPage()+".png"),
								    title: file.name
								}, function (e2) {
									if (e2.success) 
										alert("Image uploaded");
									else {
										alert("Unable to upload image");
										Ti.API.error("Create: "+e2.message);
									}
								});
							}
					    } else {
					        alert("Unable to upload image!");
					        Ti.API.error(e.message);
					    }
					});
					break;
				case 2:
					var subdialog = Ti.UI.createOptionDialog({
						cancel: 1,
						options: ['Yes', 'No'],
						selectedIndex: 1,
						destructive: 0,
						title: 'Are you sure you want to remove the results image for this action from the DB?'
					});	
					
					subdialog.addEventListener("click", function(e2) {
						if (e2.index == 0){
							Cloud.Photos.query({
							    limit: 1,
							    where: { 'title': file.name }
							}, function (e) {
							    if (e.success) {
							    	for (x in e.photos) {
								        Cloud.Photos.remove({
										    photo_id: e.photos[x].id,
										}, function (e2) {
										    if (e2.success)
										        alert("Image removed");
										    else {
										 		alert("Unable to remove image");
										 		Ti.API.error(e2.message);
										 	}
										});
									}
							    } else {
							        alert("Unable to remove image!");
							        Ti.API.error(e.message);
							    }
							});	
						}
					});
					subdialog.show();	
					break;
				case 3:
					var subdialog = Ti.UI.createOptionDialog({
						cancel: 4,
						options: ['Pass', 'Check', 'Fail', 'Clear', 'Cancel'],
						selectedIndex: 0,
						destructive: 3,
						title: 'Change result status to:'
					});	
					
					subdialog.addEventListener("click", function(e2) {
						switch (e2.index) {
							case 0:
								item.subtitle.text = " Passed; "+getTime();
								item.subtitle.backgroundColor = "green";
								status.text = item.subtitle.text;
								status.backgroundColor = item.subtitle.backgroundColor;
								break;
							case 1:
								item.subtitle.text = " Check; "+getTime();
								item.subtitle.backgroundColor = "yellow";
								status.text = item.subtitle.text;
								status.backgroundColor = item.subtitle.backgroundColor;
								break;
							case 2:
								item.subtitle.text = " Failed; "+getTime();
								item.subtitle.backgroundColor = "red";
								status.text = item.subtitle.text;
								status.backgroundColor = item.subtitle.backgroundColor;
								break;
							case 3:
								item.subtitle.text = " Not Run ";
								item.subtitle.backgroundColor = "transparent";
								status.text = item.subtitle.text;
								status.backgroundColor = item.subtitle.backgroundColor;
								break;
						}
						e.section.updateItemAt(e.itemIndex, item);
						
					    for (x in rows){
					    	if (rows[x].sec == e.sectionIndex && rows[x].ind == e.itemIndex)
					    		rows.splice(x, 1);
					   	}
					    rows.push({sec:e.sectionIndex, ind:e.itemIndex, item:item});
					    Ti.App.Properties.setObject("data", {run:run, curTest:curTest, rows:JSON.stringify(rows), log:Alloy.Globals.log, launches:Alloy.Globals.launches});
					});
					subdialog.show();
					break;
			}
		});
		dialog.show();
	});
	
	// Window construction
	win.addEventListener("click", function(e) {
		if (e.source != "[object TiUIButton]")
			win.close();
	});
	
	win.add(scroll);
	win.add(options);
	win.add(title);
	win.add(status);
	win.open();
}

// Save the comparison image
Ti.App.addEventListener('CompareComplete', function(e) {
	var file = Ti.Filesystem.getFile(Ti.Filesystem.tempDirectory, "testRunImages/"+e.name+
		Ti.Platform.model+
		Ti.Platform.version+
		Ti.Platform.displayCaps.density+
		Ti.Platform.displayCaps.dpi+
		Ti.Platform.displayCaps.platformWidth+
		Ti.Platform.displayCaps.platformHeight+
		".png"
	);
	file.write(Ti.Utils.base64decode(e.image.replace(/^data:image\/(png|jpg);base64,/, "")));
});

// Click on a row's play button to automate a single test
// e: Row clicked
function playClick(e) {
	playClicked = true;
	
    var item = e.section.getItemAt(e.itemIndex);
    run = [item.title.text];
    curTest = run[0];
    
    var temps = Ti.Filesystem.getFile(Ti.Filesystem.tempDirectory, "testRunImages").getDirectoryListing();
    for (x in temps) {
    	if (temps[x].indexOf(curTest) > -1) {
    		Ti.Filesystem.getFile(Ti.Filesystem.tempDirectory, "testRunImages/"+temps[x]).deleteFile();
    	}
    }
    delete images[curTest];
    Alloy.Globals.log = [];
    
    Alloy.Globals.alert = null;
	try { var winx = Alloy.createController(curTest, {automate:true, relaunch:false, test:curTest}).getView(); } catch (error) {Ti.API.error(error); $.indexWindow.fireEvent("runNext"); return;}
    try { winx.open();} catch (error) {Ti.API.debug("Window already opened from controller "+curTest);};
}

// Click on a 'Run Section' button to automate all tests in a section
// sec: The name of the section to automate
function sectionClick(sec) {
	run = [];   
	var ind = findSec($.view.sections, sec); 
	for (x in $.view.sections[ind].items)
		run.push($.view.sections[ind].items[x].title.text);
    curTest = run[0];
    
    var temps = Ti.Filesystem.getFile(Ti.Filesystem.tempDirectory, "testRunImages").getDirectoryListing();
    for (y in run) {
    	for (x in temps) {
    		if (temps[x].indexOf(run[y]) > -1)
    			Ti.Filesystem.getFile(Ti.Filesystem.tempDirectory, "testRunImages/"+temps[x]).deleteFile();
    	}
    	delete images[run[y]];
    }
    Alloy.Globals.log = [];
        
    Alloy.Globals.alert = null;
	try { var winx = Alloy.createController(curTest, {automate:true, relaunch:false, test:curTest}).getView(); } catch (error) {Ti.API.error(error); $.indexWindow.fireEvent("runNext"); return;}
    try { winx.open();} catch (error) {Ti.API.debug("Window already open from controller "+curTest);};
}

// Click on the 'Run All Tests' button to automate all tests
function runClick() {  
	run = [];  	
	for (i = 0, j = $.view.sections.length; i<j-1; i++) {
		for (x in $.view.sections[i].items)
			run.push($.view.sections[i].items[x].title.text);
	}
    curTest = run[0];
    
    var temps = Ti.Filesystem.getFile(Ti.Filesystem.tempDirectory, "testRunImages").getDirectoryListing();
    for (x in temps) {
    	Ti.Filesystem.getFile(Ti.Filesystem.tempDirectory, "testRunImages/"+temps[x]).deleteFile();
    }
    images = [];
    Alloy.Globals.log = [];
     
    Alloy.Globals.alert = null;
	try { var winx = Alloy.createController(curTest, {automate:true, relaunch:false, test:curTest}).getView(); } catch (error) {Ti.API.error(error); $.indexWindow.fireEvent("runNext"); return;}
    try { winx.open();} catch (error) {Ti.API.debug("Window already open from controller "+curTest);};
}

function optionsClick() {
	var dialog = Ti.UI.createOptionDialog({
		cancel: 2,
		options: ['Toggle auto-run', "Clear all test info", 'Cancel'],
		selectedIndex: 3,
		destructive: 1,
		title: 'Options'
	});	
	
	dialog.addEventListener("click", function(e) {
		switch (e.index) {
			case 0:
				autoRun();
				break;
			case 1:
				var subdialog = Ti.UI.createOptionDialog({
					cancel: 1,
					options: ['Yes', 'No'],
					selectedIndex: 1,
					destructive: 0,
					title: 'Are you sure you want to remove all results data?'
				});	
				
				subdialog.addEventListener("click", function(e2) {
					if (e2.index == 0){
						run = [];
						curTest = null;
						rows = [];
						images = [];
						Alloy.Globals.log = [];
						Alloy.Globals.launches = 0;
						var d = Titanium.Filesystem.getFile(Titanium.Filesystem.tempDirectory, 'testRunImages');
						d.deleteDirectory(true);
						d.createDirectory();
						Ti.App.Properties.setObject("data", {run:run, curTest:curTest, rows:JSON.stringify(rows), log:Alloy.Globals.log, launches:Alloy.Globals.launches});
						while ($.view.sections.length > 0)
							$.view.deleteSectionAt(0, {animated:false});
						loadList();
					}
				});
				subdialog.show();
				break;
		}
	});
	dialog.show();
}

// Click on the autorun button and toggle the automatic execution of tests
function autoRun() {
	if ($.nextRun.text != "" && $.nextRun.text != null) {
		clearInterval(autoTimer);
		$.nextRun.text = "";
	} else {
		autoTimer = setInterval(function() {
			$.nextRun.text = "Next: "+getTime(1);
			runClick();
		}, 3600000);
		$.nextRun.text = "Next: "+getTime(1);
	}
};

// Run the next test in tests array or relaunch the same test if relaunch is true
$.indexWindow.addEventListener('runNext', function(e) {
	setTimeout(function() {
		var index = run.indexOf(curTest);
		if (!e.relaunch) {
			index++;
			Alloy.Globals.log = [];
			Alloy.Globals.launches = 0;
		}
		
		if (index < 0 || index >= run.length) {
			curTest = null;
			Alloy.Globals.alert = false;
			Ti.App.Properties.setObject("data", {run:run, curTest:curTest, rows:JSON.stringify(rows), log:Alloy.Globals.log, launches:Alloy.Globals.launches});
			return;
		}
	
	    curTest = run[index];
	    
	    Alloy.Globals.alert = null;
	    try { var winx = Alloy.createController(curTest, {automate:true, relaunch:e.relaunch, test:curTest}).getView(); } catch (error) {Ti.API.error(error); $.indexWindow.fireEvent("runNext"); return;}
	    try { winx.open();} catch (error) {Ti.API.debug("Window already open from controller "+curTest);};
	}, 500);
});

// Update the current test's row in the ListView and set the status of the result (if any)
$.indexWindow.addEventListener('updateItem', function(e) {
	var ind;
	var item;
	var sec;
	for (x in $.view.sections) {
		for (y in $.view.sections[x].items) {
			if ($.view.sections[x].items[y].title.text == curTest) {
				ind = y;
				item = $.view.sections[x].items[y];
				sec = x;
				break;
			}
		}
	}

	if (curTest != null && typeof images[curTest] != 'undefined')
		item.image.image = Ti.Filesystem.getFile(Ti.Filesystem.tempDirectory, "testRunImages/"+curTest+"--0.png");
	else
		item.image.image = "/appicon.png";
			
	if (e.retest) {
		item.subtitle.text = " Error: Try Retest? ";
		item.subtitle.backgroundColor = "#66f";
	} else{
		switch (e.result) {
			case true:
				item.subtitle.text = " Passed; "+getTime();
				item.subtitle.backgroundColor = "green";
				break;
			case false:
				item.subtitle.text = " Failed; "+getTime();
	    		item.subtitle.backgroundColor = "red";
	    		break;
	    	case "skip":
	    		item.subtitle.text = " Skip test ";
	    		item.subtitle.backgroundColor = "silver";
	    		break;
	    	case "relaunch":
	    		item.subtitle.text = " Relaunching ";
	    		item.subtitle.backgroundColor = "#ffe";
	    		break;
	    	default:
	    		item.subtitle.text = " Check; "+getTime(); 
	    		item.subtitle.backgroundColor = "yellow";
	    		break; 
		}
	}
       	
    $.view.sections[sec].updateItemAt(ind, item);
    for (x in rows)
    	if (rows[x].sec == sec && rows[x].ind == ind)
    		rows.splice(x, 1);
    rows.push({sec:sec, ind:ind, item:item});
    Ti.App.Properties.setObject("data", {run:run, curTest:curTest, rows:JSON.stringify(rows), log:Alloy.Globals.log, launches:Alloy.Globals.launches});
});

// Take a screenshot of a specified view/window or from the system level
$.indexWindow.addEventListener('screenshot', function(e) {
	Alloy.Globals.wait = true;
	if (Alloy.Globals.alert != null && e.object === "alert") {
		if (typeof images[curTest] == 'undefined')
			images[curTest] = [];
			
		var file = Ti.Filesystem.getFile(Ti.Filesystem.tempDirectory, "testRunImages/"+curTest+"--"+images[curTest].length+".png");
		file.write(Alloy.Globals.alert);
		images[curTest][images[curTest].length] = file;
		Alloy.Globals.alert = null;
		
		if (e.compare !== false) {
			compare(file);
		} else {
			Alloy.Globals.wait = false;
		}
		
		return;
	}
	
	if (curTest === null)
		return;
		
	if (e.image != null) {
		var blob = Ti.Platform.osname == "android" ? e.image.media : e.image;

		if (typeof images[curTest] == 'undefined')
			images[curTest] = [];
			
		var file = Ti.Filesystem.getFile(Ti.Filesystem.tempDirectory, "testRunImages/"+curTest+"--"+images[curTest].length+".png");
		file.write(blob);
		images[curTest][images[curTest].length] = file;
		
		if (e.compare !== false) {
			compare(file);
		} else {
			Alloy.Globals.wait = false;
		}
	} else {
		Ti.Media.takeScreenshot(function(event) {
			if (event.media) {
				var blob = event.media;
		
				if (typeof images[curTest] == 'undefined')
					images[curTest] = [];
					
				var file = Ti.Filesystem.getFile(Ti.Filesystem.tempDirectory, "testRunImages/"+curTest+"--"+images[curTest].length+".png");
				file.write(blob);
				images[curTest][images[curTest].length] = file;
				
				if (e.compare !== false) {
					compare(file);
				} else {
					Alloy.Globals.wait = false;
				}
			}
		});
	}
});

// Compare an image with the saved image on the DB for the same test action
// pic: image to compare
function compare(pic){
	var webview = Ti.UI.createWebView({url: "/comparisons/index.html", visible:false});
	var webwindow = Ti.UI.createWindow();
	
	var f1 = pic.resolve().replace("file://","");
	var fstr = pic.name.replace(".png", "")+
		Ti.Platform.model+
		Ti.Platform.version+
		Ti.Platform.displayCaps.density+
		Ti.Platform.displayCaps.dpi+
		Ti.Platform.displayCaps.platformWidth+
		Ti.Platform.displayCaps.platformHeight+
		".png";
	var f2 = "";
	
	webview.addEventListener('beforeload',function() {
		webview.evalJS("var f1='"+f1+"'; var f2='"+f2+"'; var name='"+pic.name.replace(".png", "")+"';");
	});
	
	Cloud.Photos.query({
	    limit: 1,
	    where: { 'title': fstr }
	}, function (e) {
	    if (e.success && e.photos.length == 1) {
	    	f2 = e.photos[0].urls['original'];
	    	webwindow.add(webview);
			webwindow.open();
	    } else
	    	Alloy.Globals.wait = false;
	});
	
	Ti.App.addEventListener("CompareComplete", function(e) {
		Alloy.Globals.wait = false;
		webwindow.close();
	});
}

// Get the current time in HH:MM:SS format
// add: Integer added to hours. Used for "Next Run"
function getTime(add) {
    var currentTime = new Date();
    var hours = currentTime.getHours()+(add || 0);
    if (hours > 12)
    	hours -= 12;
    var minutes = currentTime.getMinutes();
    if (minutes < 10)
    	minutes = "0"+minutes;
    var seconds = currentTime.getSeconds();
    if (seconds < 10)
    	seconds = "0"+seconds;
 
    return hours+":"+minutes+":"+seconds+" ";
}

// Click listener for Android to show kayboard on searchbar
$.search.addEventListener("click", function() {
	$.search.softKeyboardOnFocus = Ti.UI.Android.SOFT_KEYBOARD_SHOW_ON_FOCUS;
    $.search.focus();
});
