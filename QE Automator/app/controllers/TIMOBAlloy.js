function clickButton(){
	alert("I was clicked");	
}

/*************************** Automation ***************************/
var _window = $.window;
var _actions = [
	{call:clickButton},
	{event:"click", object:$.button, time:2},
	{screenshot:true}
];

/***** Set the above. Do not modify the below *****/
var _af = require("automateFunctions");
_af._setup(_actions, _window, arguments[0] || {});
/************************* End Automation *************************/