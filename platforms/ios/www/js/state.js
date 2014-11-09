define(["route", "json!../state.json", "jquery.cookie"], function(route, rules) {
	var state = {};

	// set up the defaults
	for (var param in rules) {
		state[param] = rules[param]['default'];
	}

	function parseQuery(qstring) {
		var result = {}, e, r = /([^&=]+)=?([^&#]*)/g, d = function(s) {
			return decodeURIComponent(s.replace(/\+/g, " "));
		}, q = qstring.substring(1);
		e = r.exec(q);
		while (e) {
			result[d(e[1])] = d(e[2]);
			e = r.exec(q);
		}
		return result;
	}

	function stateUpdate(url) {
		// console.log('url', url);

		// get the old value
		var cookieJson = $.cookie('thr');
		var cookie = $.parseJSON(cookieJson);
		// validate the incoming state from the cookie
		for (var param in cookie) {
			set(param, cookie[param]);
		}

		// update from the query string
		var i = url.indexOf('?');
		if (i > 0) {
			qvals = parseQuery(url.substring(i));
			if (!('p' in qvals)) {
				for (var k in qvals) {
					set(k, qvals[k]);
				}
			}
		}
	}

	function set(key, value) {
		if ( key in rules) {
			var rule = rules[key], pattern = rule.pattern ? new RegExp(rule.pattern) : null, old = state[key];
			if (old !== value) {
				if (!pattern || pattern.test(value)) {
					state[key] = value;
					setCookie();
				} else {
					logEvent('set error', key, value);
				}
			}
		}
	}

	function setCookie() {
		var args = {
			path : '/'
		};
		if (state.lastURL) {
			args.expires = 1;
		}
		$.cookie('thr', JSON.stringify(state), args);
	}

	function dump(msg) {
		console.log('state dump', msg, state);
	}

	function addFavorite(id) {
		var favList = state['favorites'].split(',');
		if ($.inArray(id, favList) === -1) {
			if (favList[0]) {
				favList.push(id);
			} else {
				favList[0] = id;
			}
			set('favorites', favList.join(','));
		}
		set('collection', '');
		// clear collection if favorites changes
	}

	function downloadBook(id) {
		console.log("Step 1");
		window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
		window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, onFileSystemSuccess, errorHandler);
	}

	function onFileSystemSuccess(fileSystem) {
		console.log(fileSystem.name);
		console.log(fileSystem.root.name);
		console.log("Step 2");
		var fileTransfer = new FileTransfer();
		console.log("Step 3");
		var uri = encodeURI("http://tarheelreader.org/cache/images/50/3886224850_00fc0ffc2f.jpg");
		console.log("Step 4: encoded uri " + uri);
		var fileURL = "cdvfile://localhost/persistent/file.jpg";

		fileTransfer.download(uri, fileURL, function(entry) {
			console.log("download complete: " + entry.fullPath);
		}, function(error) {
			console.log("download error source " + error.source);
			console.log("download error target " + error.target);
			console.log("upload error code" + error.code);
		}, false, {
			headers : {
				"Authorization" : "Basic dGVzdHVzZXJuYW1lOnRlc3RwYXNzd29yZA=="
			}
		});
	}

	function errorHandler(e) {
		var msg = '';

		switch (e.code) {
			case FileError.QUOTA_EXCEEDED_ERR:
				msg = 'QUOTA_EXCEEDED_ERR';
				break;
			case FileError.NOT_FOUND_ERR:
				msg = 'NOT_FOUND_ERR';
				break;
			case FileError.SECURITY_ERR:
				msg = 'SECURITY_ERR';
				break;
			case FileError.INVALID_MODIFICATION_ERR:
				msg = 'INVALID_MODIFICATION_ERR';
				break;
			case FileError.INVALID_STATE_ERR:
				msg = 'INVALID_STATE_ERR';
				break;
			default:
				msg = 'Unknown Error';
				break;
		};

		alert('Error: ' + msg);
	}

	function getDownload() {
		console.log("Download Step 1");
		alert("get download");
		/*file.file(function(e) {
		 console.log("called the file func on the file ob");
		 var reader = new FileReader();
		 reader.onloadend = function(evt) {
		 app.log('onloadend');
		 app.log(evt.target.result);
		 };
		 reader.readAsText(e);

		 });*/
		new Ajax().sendRequest("cdvfile://localhost/persistent/file.jpg", {
			method : "GET",
			callback : function(xmlHTTP) {

				var encoded = btoa(unescape(encodeURIComponent(xmlHTTP.responseText)));
				var dataURL = "data:image/jpeg;base64," + encoded;

				document.getElementById("image").src = dataURL;
			}
		});
		//window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, gotFS, fail);
	}

	function removeFavorite(id) {
		var favList = state['favorites'].split(','), index = $.inArray(id, favList);
		if (index !== -1) {
			favList.splice(index, 1);
			set('favorites', favList.join(','));
		}
		set('collection', '');
		// clear collection if favorites changes
	}

	function isFavorite(id) {
		return new RegExp('(^|,)' + id + '(,|$)').test(state['favorites']);
	}

	function favoritesArray() {
		var r = state['favorites'].match(/\d+/g);
		if (!r) {
			r = [];
		}
		return r;
	}

	function favoritesURL() {
		var p = {
			voice : state.voice,
			pageColor : state.pageColor,
			textColor : state.textColor,
			fpage : state.fpage
		};
		if (state.collection) {
			p.collection = state.collection;
		} else {
			p.favorites = state.favorites;
		}
		return '/favorites/?' + $.param(p);
	}

	stateUpdate(window.location.href);

	return {
		get : function(key) {
			return state[key];
		},
		set : set,
		update : stateUpdate,
		dump : dump,
		addFavorite : addFavorite,
		downloadBook : downloadBook,
		getDownload : getDownload,
		removeFavorite : removeFavorite,
		isFavorite : isFavorite,
		favoritesArray : favoritesArray,
		favoritesURL : favoritesURL,
		host : 'http://gbserver3.cs.unc.edu'
	};
});
