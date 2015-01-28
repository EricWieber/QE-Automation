var win = Ti.UI.createWindow({
	backgroundColor: "white"
});

var button = Ti.UI.createButton({
	title: "Button"
});

win.add(button);
win.open();

function clickButton(){
	alert("I was clicked");	
}

button.addEventListener("click", clickButton);

function pass(){
	//Do anything here
	return true;
}

/*************************** Automation ***************************/
var _window = win;
var _actions = [
	["call", clickButton],
	["click", button, {}, 2],
	["screenshot"],
	["call", pass]
];

/***** Set the above. Do not modify the below *****/
var _af = require("automateFunctions");
_af._setup(_actions, _window, arguments[0] || {});
/************************* End Automation *************************/