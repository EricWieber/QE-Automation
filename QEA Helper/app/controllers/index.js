var platform = Ti.Platform.name;
var args;
var time = "Loading...";

$.index.open();

function urlToObject(url) {
	if (url) {
		var returnObj = {};
		url = url.replace('qeahelper://?', '');
		var params = url.split('&');

		params.forEach(function(param) {
			var keyAndValue = param.split('=');
			returnObj[keyAndValue[0]] = decodeURI(keyAndValue[1]);
		});
		time = returnObj["time"]/2 || 0;

		return returnObj;
	}
}

function checkForImportURL() {
	if (OS_ANDROID) {
		var activity = Ti.Android.currentActivity;
		var data = activity.getIntent().getData();

		if (data) {
			args = urlToObject(data);
		}

	} else if (OS_IOS) {
		if (Ti.App.getArguments().url) {
			args = urlToObject(Ti.App.getArguments().url);
		}
	}
	countDown();
}

Ti.App.addEventListener('resumed', function(e) {
	$.label.text = "Loading...";
	checkForImportURL();
});

checkForImportURL();

function countDown() {
	var timer = setInterval(function() {
		$.label.text = time;
		if (time > 0) {
			time--;
		} else {
			clearInterval(timer);
			if (OS_IOS) {
				if (Ti.Platform.canOpenURL("qeautomator://")) {
					Ti.Platform.openURL("qeautomator://?");
				}
			} else if (OS_ANDROID) {
				var myIntent = Ti.Android.createIntent({
					action : Ti.Android.ACTION_MAIN,
					packageName : "com.appc.qeautomator",
					className : "com.appc.qeautomator.qeautomator",
					flags : Ti.Android.FLAG_ACTIVITY_NEW_TASK,
					url : "qeautomator://?"
				});
				myIntent.addCategory(Ti.Android.CATEGORY_LAUNCHER);
				Ti.Android.currentActivity.startActivity(myIntent);
			}
			$.label.text = "Done";
		}
	}, 1000);
}
