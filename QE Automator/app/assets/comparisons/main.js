$(function(){
	function onComplete(data){
		var time = Date.now();
		var diffImage = new Image();
		diffImage.src = data.getImageDataUrl();

		$('#image-diff').attr('src', diffImage.src);

		$('#loading').hide();
		if(data.misMatchPercentage == 0){
			$('#thesame').show();
		} else {
			$('#mismatch').text(data.misMatchPercentage);
			$('#havediffs').show();
		}
		Ti.App.fireEvent('CompareComplete', { name: name, image: diffImage.src, diff: data.misMatchPercentage });
	}

	var file1 = f1 || "";
	var file2 = f2 || "";
	var resembleControl;

	(function(){
		var xhr = new XMLHttpRequest();
		var xhr2 = new XMLHttpRequest();
		var done = $.Deferred();
		var dtwo = $.Deferred();

		xhr.open('GET', file1, true);
		xhr.responseType = 'blob';
		xhr.onload = function(e) {
			done.resolve(this.response);
		};
		xhr.send();

		xhr2.open('GET', file2, true);
		xhr2.responseType = 'blob';
		xhr2.onload = function(e) {
			dtwo.resolve(this.response);
		};
		xhr2.send();

		resemble.outputSettings({
			errorColor: {
				red: 255,
				green: 100,
				blue: 100,
				transparency: 0.6,
				errorType: 'flatDifferenceIntensity'
			}
		});
		
		$.when(done, dtwo).done(function(fileA, fileB){
			resembleControl = resemble(file1).compareTo(file2).onComplete(onComplete);
		});

	}());

});
