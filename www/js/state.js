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
		/*
		 * String 'id' is passed from find.js when a book is favorited.
		 * id is the slug of the book.  We use this slug below to get the books JSON
		 * and then call the gotFS method.
		 */
		console.log("Step 1");
		$.get("https://tarheelreader.org/book-as-json/?slug=" + id, function(data) {
			console.log("Download: ", data);
			ajaxData = toJSON(data);
			window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
			window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, gotFS, fail);
		});
	}

	function gotFS(fileSystem) {
		/*
		 * Below we use the File Cordova Plugin to create two directories 
		 * (if they don't exist) and a file.  The directories created are the
		 * tarheelreaderapp and tarheelreaderapp/json directories.  We create these
		 * in order to create the JSON that stores the information about the downloaded
		 * book because you cannot create a File using the Cordova plugin if the
		 * parent directory doesn't exist.
		 */
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
		fileSystem.root.getFile("tarheelreaderapp/json/" + ajaxData.slug + ".json", {
			create : true,
			exclusive : false
		}, gotFileEntryJSON, fail);
		var pages = ajaxData.pages;

		for (var i = 0; i < pages.length; i++) {
			/*
			 * We propogate through each page in order to store images and image json
			 * objects.  First we create directories (for the same reasons as above), then
			 * we create a JSON file used to keep track of image use count and finally 
			 * we transfer images using fileTransfer.
			 */
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

	function gotFileWriterJSON(writer) {
		/*
		 * Write the JSON data for the entire book to JSON directory.
		 */
		console.log('gotFileWriter JSON');
		console.log('Step 2: writing to file');
		writer.write(JSON.stringify(ajaxData));
	}

	function gotFileWriterImage(writer) {
		/*
		 * Write the count of image use to JSON file in directory with referenced image.
		 * If the JSON file is empty because the image has not been used, it sets the
		 * count at 1.  Otherwise it adds to the existing count.
		 */
		$.get(writer.localURL, function(data) {
			console.log("Writer Data: ", data);
			data = toJSON(data);
			var count;
			if (data == null || data.count == null || data == "" || data == " ") {
				count = 0;
			} else {
				count = data.count;
			}
			console.log(count);
			count++;
			writer.write('{"count" : ' + count + '}');
		});
	}

	function fail(error) {
		console.log('fail: ' + error);
	}

	var dataSlug = null;
	function deleteBook(id) {
		/*
		 * Delete is called from Find and passes a books slug.
		 * This slug is able to reference a JSON file in
		 * tarheelreader/json/ and deletes recursively from there.
		 */
		console.log("Deleting Book: ", id);
		dataSlug = id;
		if (dataSlug != null) {
			window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, gotFSForDeletion, fail);
		}
	}

	function gotFSForDeletion(fileSystem) {
		/*
		 * Uses an ajax call to get the book that is to be downloaded.
		 */
		console.log('gotFS');
		var fileJSON = "/json/" + dataSlug + ".json";
		console.log("File JSON: " + fileURL + fileJSON);
		$.get(fileURL + fileJSON, function(data) {
			console.log(data);
			data = toJSON(data);
			var pages = data.pages;
			for (var i = 0; i < pages.length; i++) {
				/*
				 * Using the JSON object we can iterate through each page
				 * and find the count of the books use.  This will inform us on whether
				 * it is to be deleted or not.  We use the (function(i){...})(i); to
				 * handle asynchronous irregularities that arise from the for loop and ajax.
				 */
				(function(i) {
					var imagePath = pages[i].url.split(".")[0] + ".json";
					$.get(fileURL + imagePath, function(data2) {
						data2 = JSON.parse(data2);
						console.log("Inside Function: " + i + ": Data 2: " + data2);
						if (data2.count <= 1) {
							/*
							 * If this image is used 1 or less times, the image and the
							 * json managing its count is to be deleted.
							 */
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
							/*
							 * If the image is used more than 1 times the JSON handling its count
							 * is subtracted by 1.
							 */
							fileSystem.root.getFile("tarheelreaderapp" + imagePath, {
								create : true,
								exclusive : false
							}, gotFileEntryForDeletionImages, fail);
						}
					});
				})(i);
			}
			/*
			 * After deleting images or subtracting from the count, JSON managing the book
			 * is deleted.
			 */
			fileSystem.root.getFile("tarheelreaderapp/json/" + dataSlug + ".json", {
				create : true,
				exclusive : false
			}, gotFileEntryForDeletion, fail);
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
		/*
		 * Write the count of image use to JSON file in directory with referenced image.
		 * Calls the JSON count that already exists and subtracts the count from that.
		 */
		$.get(writer.localURL, function(data) {
			console.log("Writer Data before delete: ", data);
			data = toJSON(data);
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
	//set("connectivity",false);
	function onOffline() {
		set("connectivity", false);
		//controller.stateChange();
	}

	function onOnline() {
		set("connectivity", true);
		//controller.stateChange();
		//set("connectivity",false);
	}

	document.addEventListener("offline", onOffline, false);
	document.addEventListener("online", onOnline, false);

	function bookSaved(slug) {
		/*
		 * This function is called by find.js and serves as a way to check if a
		 * book is downloaded by looking it up by its slug.  By doing so it allows 
		 * the find page to append the save icon while Find is being rendered.  By
		 * doing so it helps prevent downloading the same image more than once.
		 */
		var returnVal = true;
		var http = new XMLHttpRequest();
		http.open('HEAD', fileURL + "/json/" + slug + ".json", false);
		http.send();
		if (http.status != 404) {
			returnVal = true;
		} else {
			returnVal = false;
		}
		return returnVal;
	}

	function toJSON(data) {
		/*
		 * This function resolves an ios/android issue.
		 * On ios, when we call ajax locally it will return our json
		 * files contents as a json object.  On android it will return them
		 * as a string.  So if the data variable passed into this function
		 * is of type string, it will parse it for JSON (unless it is empty
		 * 	and then it will be undefined).
		 */
		var newVal;
		if ( typeof data === "string") {
			console.log("Data is String");
			if (!data){
				newVal = undefined;
			}
			else{
				newVal = JSON.parse(data);
			}
		} else {
			console.log("Data is not String");
			newVal = data;
		}
		return newVal;
	}
       
       

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
		bookSaved : bookSaved,
		host : 'http://gbserver3.cs.unc.edu',
		fileURL : fileURL,
	};
});
