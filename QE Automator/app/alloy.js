if (OS_ANDROID)
    Alloy.Globals.url = Ti.Android.currentActivity.intent.data;

Alloy.Globals.window = null;
Alloy.Globals.alert = null;
Alloy.Globals.wait = false;
Alloy.Globals.log = [];

// Override the alert proxy to auto-dismiss if test is not running manually
function alert(message, title, ok) {
	var a = Ti.UI.createAlertDialog({
		message : message,
		title : title || L('alert_title', 'Alert'),
		buttonNames : [ok || L('alert_ok', 'OK')],
		cancel : 0
	});
	a.show();
	Alloy.Globals.wait = true;
	if (Alloy.Globals.alert !== false){
		Ti.Media.takeScreenshot(function(event) {
			if (event.media)
				Alloy.Globals.alert = event.media;
		});
		setTimeout(function() {
			a.hide();
			Alloy.Globals.wait = false;
		}, 1000);
	}
}

// Save a message to a log variable
// message: String to save
function _log(message) {
	Ti.API.info(message);
	Alloy.Globals.log.push(message);
}

// Check the log variable for the message
// message: String to search log for
function _checkLog(message){
	return (Alloy.Globals.log.indexOf(message) > -1);
}