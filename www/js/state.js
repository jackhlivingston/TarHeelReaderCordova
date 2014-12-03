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

	var ajaxPath;
	var ajaxData;
	var fileURL = "cdvfile://localhost/persistent/tarheelreaderapp";
	function downloadBook(id) {
		console.log("Step 1");
		$.get("https://tarheelreader.org/book-as-json/?slug=" + id, function(data) {
			console.log("Download: ", data);
			ajaxData = data;
			window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
			window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, gotFS, fail);
		});
	}

	function gotFS(fileSystem) {
		console.log('gotFS');
		console.log("AjaxData ID: " + ajaxData.ID);
		fileSystem.root.getDirectory("tarheelreaderapp", {
			create : true,
			exclusive : false
		}, success, fail);
		fileSystem.root.getDirectory("tarheelreaderapp/json", {
			create : true,
			exclusive : false
		}, success, fail);
		fileSystem.root.getFile("tarheelreaderapp/json/" + ajaxData.ID + ".json", {
			create : true,
			exclusive : false
		}, gotFileEntryJSON, fail);
		var pages = ajaxData.pages;

		for (var i = 0; i < pages.length; i++) {
			var jsonFile = pages[i].url.split(".")[0] + ".json";
			var fileTransfer = new FileTransfer();
			urlArray = jsonFile.split("/");

			console.log(i + ": JSON File: " + jsonFile + ".  URL: " + urlArray);
			var newDirectory = "";
			for ( j = 1; j < urlArray.length - 1; j++) {
				newDirectory += "/";
				newDirectory += urlArray[j];
				console.log(j + ": New Directory = " + newDirectory);
				fileSystem.root.getDirectory("tarheelreaderapp" + newDirectory, {
					create : true,
					exclusive : false
				}, success, fail);
			}
			fileSystem.root.getFile("tarheelreaderapp" + jsonFile, {
				create : true,
				exclusive : false
			}, gotFileEntryImages, fail);
			(function(i) {
				$.get(fileURL + jsonFile, function(data) {
					if (data.count <= 1) {
						var uri = encodeURI("https://tarheelreader.org" + pages[i].url);
						fileTransfer.download(uri, fileURL + pages[i].url, function(entry) {
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
				});
			})(i);
		}
	}

	function gotFileEntryJSON(fileEntry) {
		console.log('gotFileEntry for JSON');
		fileEntry.createWriter(gotFileWriterJSON, fail);
	}

	function gotFileEntryImages(fileEntry) {
		fileEntry.createWriter(gotFileWriterImage, fail);
	}

	function fileRead(file) {
		var $def = $.Deferred();
		var reader = new FileReader();
		reader.onloadend = function(evt) {
			var result = evt.target.result;
			$def.resolve(result);
		};
		reader.readAsText(file);
		return $def;
	}

	function gotFileWriterJSON(writer) {
		console.log('gotFileWriter JSON');
		console.log('Step 2: writing to file');
		writer.write(JSON.stringify(ajaxData));
	}

	function gotFileWriterImage(writer) {
		$.get(writer.localURL, function(data) {
			console.log("Writer Data: ", data);
			var count;
			if (data == null) {
				count = 0;
			} else {
				count = data.count;
			}
			count++;
			writer.write('{"count" : ' + count + '}');
		});
	}

	function saveImage() {

	}

	function fail(error) {
		console.log('fail: ' + error.code);
	}

	var dataID = null;
	function deleteBook(id) {
		console.log("Deleting Book: ", id);
		dataID = id;
		if (dataID != null) {
			window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, gotFSForDeletion, fail);
		}
	}

	function gotFSForDeletion(fileSystem) {
		console.log('gotFS');
		var fileJSON = "/json/" + dataID + ".json";
		console.log("File JSON: " + fileURL + fileJSON);
		$.get(fileURL + fileJSON, function(data) {
			console.log(data);
			var pages = data.pages;
			for (var i = 0; i < pages.length; i++) {
				(function(i) {
					var imagePath = pages[i].url.split(".")[0] + ".json";
					$.get(fileURL + imagePath, function(data2) {
						console.log("Inside Function: " + i + ": Data 2: " + data2.count);
						if (data2.count <= 1) {
							console.log("Deleting image:  tarheelreaderapp" + pages[i].url);
							fileSystem.root.getFile("tarheelreaderapp" + pages[i].url, {
								create : true,
								exclusive : false
							}, gotFileEntryForDeletion, fail);
							console.log("Deleting image json:  tarheelreaderapp" + imagePath);
							fileSystem.root.getFile("tarheelreaderapp" + imagePath, {
								create : true,
								exclusive : false
							}, gotFileEntryForDeletion, fail);
						} else {
							fileSystem.root.getFile("tarheelreaderapp" + imagePath, {
								create : true,
								exclusive : false
							}, gotFileEntryForDeletionImages, fail);
						}
					});
				})(i);
			}
		});
	}

	function gotFileEntryForDeletion(fileEntry) {
		console.log('gotFileEntry');
		fileEntry.remove(success, fail);
	}

	function gotFileEntryForDeletionImages(fileEntry) {
		console.log('gotFileEntry for Deletion Images');
		fileEntry.createWriter(gotFileWriterDeleteImage, fail);
	}

	function gotFileWriterDeleteImage(writer) {
		$.get(writer.localURL, function(data) {
			console.log("Writer Data before delete: ", data);
			var count = data.count;
			count--;
			writer.write('{"count" : ' + count + '}');
		});
	}

	function success(entry) {
		console.log("Success");
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

	var networkState = navigator.connection.type !== Connection.NONE;
	set("connectivity", networkState);
	function onOffline() {
		set("connectivity", false);
	}

	function onOnline() {
		set("connectivity", true);
	}

	document.addEventListener("offline", onOffline, false);
	document.addEventListener("online", onOnline, false);

	return {
		get : function(key) {
			return state[key];
		},
		set : set,
		update : stateUpdate,
		dump : dump,
		addFavorite : addFavorite,
		downloadBook : downloadBook,
		deleteBook : deleteBook,
		removeFavorite : removeFavorite,
		isFavorite : isFavorite,
		favoritesArray : favoritesArray,
		favoritesURL : favoritesURL,
		host : 'http://gbserver3.cs.unc.edu'
	};
});
