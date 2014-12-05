define(["state"], function(state) {
	var URLmap = [
		{"re": /^\/find\/(\?.*)?$/, "action": findBooks},
		{"re": /^\/book-as-json\/(\?.*)?$/, "action" : getBook}
	];
	
	function get(request){
		console.log("in connection handler getting url: ",request.url);
        var online = state.get("connectivity");
		if (online){
			request.url = state.host + request.url;
			$.ajax(request);
		}
		else{
			/*
			 * request has the variables:
			 * url,
			 * data (ignore this),
			 * dataType (ignore this),
			 * timeout (ignore this),
			 * success
			 */
			var i = 0;
			while (i < URLmap.length){
				candidate = URLmap[i];
				var match = candidate.re.exec(request.url);
				if (null!=match){
					candidate.action(request);
					break;
				}
				i++;
			}
		}
	}
	
	function setImageLocation(image){
		var online = state.get("connectivity");
		if (!online){
			image.url = state.fileURL + image.url.replace(state.host,"").replace(state.fileURL,"");
		}
	}
	
	function getBook(request){
		function fail(){
			console.log("there was an error find books");
		}
		console.log("getting a book from the connection handler");
		var book;
		window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, gotFS, fail);

		function gotFS(fileSystem) {
			console.log("got the file system");
	        fileSystem.root.getFile("tarheelreaderapp/json/"+request.data.slug+".json",{create: false, exclusive: false}, gotFile, fail);
	    }

		function gotFile(fileEntry){
			console.log("got the file: ", JSON.stringify(fileEntry));
			fileEntry.file(function(file){
				var reader = new FileReader();
				reader.onloadend = function(evt){
					console.log("got the book");
					book = JSON.parse(evt.target.result);
					request.success(book);
				};
				reader.readAsText(file);
			},fail);
		}
	}
	
	function findBooks(request){
		function fail(){
			console.log("there was an error find books");
		}
		console.log("finding books from the connection handler");
		var books = [];
		window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, gotFS, fail);

		function gotFS(fileSystem) {
	        fileSystem.root.getDirectory("tarheelreaderapp/json", {create: true, exclusive: false}, gotDE, fail);
	    }
		function gotDE(dirEntry){
			var directoryReader = dirEntry.createReader();
			directoryReader.readEntries(gotEntries,fail);
		}
		function gotEntries(entries){
			/*for (i=0; i<entries.length; i=i+1){
				if (entries[i].file){
					entries[i].file(readFile, fail);
				}
			}*/
			gotEntriesHelper(entries, 0);
		}
		function gotEntriesHelper(entries, index){
			if (index<entries.length){
				if (entries[index].file){
					entries[index].file(function(file){
							readFile(file).then(function(){gotEntriesHelper(entries,index+1);});
						},fail);
				}else{
					gotEntriesHelper(entries,index+1);
				}
			}else{
				console.log("returning books: ", JSON.stringify(books));
				request.success({"books":books,"more":false},"success",null);
			}
		}
		function readFile(file){
			var $def = $.Deferred();
			var reader = new FileReader();
			console.log("got the file: ", JSON.stringify(file));
	        reader.onloadend = function(evt) {
	        	var book = JSON.parse(evt.target.result);
	        	book.cover = book.pages[0];
	        	book.rating = {
	                "icon": "images/"+book.rating_value+"stars_t.png",
	                "img": "images/"+book.rating_value+"stars.png",
	                "text": book.rating_value+" stars"
	        	};
	        	book.pages = book.pages.length;
		    	books.push(book);
				$def.resolve();
	        };
	        reader.readAsText(file);
	        return $def;
		}
	}
	
	return {
		get: get,
		setImageLocation: setImageLocation,
	};
});